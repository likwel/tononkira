"""État de la collecte dans SQLite : pages de liste lues, chansons repérées et leur
statut. Chaque résultat est enregistré aussitôt, donc une collecte interrompue
reprend là où elle s'est arrêtée.

L'API lit cette base (en lecture seule) pour l'interface d'administration : le schéma
est recopié dans contracts/crawl-state.sql et un test vérifie qu'ils restent identiques.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable, Iterator
from datetime import UTC, datetime
from pathlib import Path

from .models import SongRef

PENDING, DONE, ERROR, GONE = "pending", "done", "error", "gone"

SCHEMA = """
CREATE TABLE IF NOT EXISTS list_pages (
    source      TEXT    NOT NULL,
    page        INTEGER NOT NULL,
    song_count  INTEGER NOT NULL,
    fetched_at  TEXT    NOT NULL,
    PRIMARY KEY (source, page)
);
CREATE TABLE IF NOT EXISTS songs (
    url           TEXT PRIMARY KEY,
    source        TEXT    NOT NULL,
    artist_slug   TEXT    NOT NULL,
    slug          TEXT    NOT NULL,
    title         TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'pending',
    attempts      INTEGER NOT NULL DEFAULT 0,
    error         TEXT,
    data          TEXT,
    discovered_at TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL,
    checked_at    TEXT,
    changed_at    TEXT
);
CREATE INDEX IF NOT EXISTS songs_status_idx ON songs (source, status);
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""

# Colonnes apparues après la première version : ajoutées aux bases existantes à l'ouverture.
_ADDED_COLUMNS = {"checked_at": "TEXT", "changed_at": "TEXT"}


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


class CrawlState:
    def __init__(self, path: Path | str) -> None:
        in_memory = str(path) == ":memory:"
        if not in_memory:
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        # timeout : une collecte et une vérification ponctuelle peuvent écrire en même temps.
        self._db = sqlite3.connect(str(path), timeout=30)
        self._db.row_factory = sqlite3.Row
        if not in_memory:
            # WAL : l'API lit la base pendant qu'une collecte écrit.
            self._db.execute("PRAGMA journal_mode=WAL")
        self._db.executescript(SCHEMA)
        self._migrate()

    def _migrate(self) -> None:
        existing = {row["name"] for row in self._db.execute("PRAGMA table_info(songs)")}
        with self._db:
            for name, sql_type in _ADDED_COLUMNS.items():
                if name not in existing:
                    self._db.execute(f"ALTER TABLE songs ADD COLUMN {name} {sql_type}")

    def close(self) -> None:
        self._db.close()

    def __enter__(self) -> CrawlState:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # --- Métadonnées -----------------------------------------------------------

    def set_meta(self, key: str, value: str) -> None:
        with self._db:
            self._db.execute(
                "INSERT INTO meta (key, value) VALUES (?, ?)"
                " ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                (key, value),
            )

    def get_meta(self, key: str) -> str | None:
        row = self._db.execute("SELECT value FROM meta WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None

    # --- Pages de liste --------------------------------------------------------

    def record_list_page(self, source: str, page: int, song_count: int) -> None:
        with self._db:
            self._db.execute(
                "INSERT INTO list_pages (source, page, song_count, fetched_at) VALUES (?, ?, ?, ?)"
                " ON CONFLICT (source, page) DO UPDATE SET"
                " song_count = excluded.song_count, fetched_at = excluded.fetched_at",
                (source, page, song_count, utc_now()),
            )

    def list_pages_done(self, source: str) -> set[int]:
        rows = self._db.execute("SELECT page FROM list_pages WHERE source = ?", (source,))
        return {row["page"] for row in rows}

    # --- Chansons ------------------------------------------------------------

    def add_refs(self, source: str, refs: Iterable[SongRef]) -> int:
        """Enregistre les chansons repérées ; retourne le nombre de nouvelles."""
        now = utc_now()
        with self._db:
            cursor = self._db.executemany(
                "INSERT OR IGNORE INTO songs"
                " (url, source, artist_slug, slug, title, discovered_at, updated_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                [(r.url, source, r.artist_slug, r.slug, r.title, now, now) for r in refs],
            )
        return cursor.rowcount

    def get_song(self, url: str) -> dict | None:
        row = self._db.execute(
            "SELECT url, source, status, data, checked_at, changed_at FROM songs WHERE url = ?",
            (url,),
        ).fetchone()
        if row is None:
            return None
        song = dict(row)
        song["data"] = json.loads(row["data"]) if row["data"] else None
        return song

    def pending(
        self,
        source: str,
        *,
        limit: int | None = None,
        include_errors: bool = False,
        max_attempts: int = 3,
    ) -> list[str]:
        sql = "SELECT url FROM songs WHERE source = ? AND (status = ?"
        params: list = [source, PENDING]
        if include_errors:
            sql += " OR (status = ? AND attempts < ?)"
            params += [ERROR, max_attempts]
        sql += ") ORDER BY discovered_at, rowid"
        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)
        return [row["url"] for row in self._db.execute(sql, params)]

    def to_recheck(self, source: str, *, limit: int | None = None) -> list[str]:
        """Chansons déjà collectées, jamais vérifiées d'abord, puis les plus anciennes."""
        sql = (
            "SELECT url FROM songs WHERE source = ? AND status = ?"
            " ORDER BY checked_at IS NOT NULL, checked_at, updated_at, rowid"
        )
        params: list = [source, DONE]
        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)
        return [row["url"] for row in self._db.execute(sql, params)]

    def save_song(self, url: str, data: dict, *, changed: bool = True) -> None:
        """Enregistre le contenu collecté. `changed` : le contenu diffère du précédent."""
        now = utc_now()
        with self._db:
            self._db.execute(
                "UPDATE songs SET status = ?, data = ?, title = ?, error = NULL,"
                " updated_at = ?, checked_at = ?,"
                " changed_at = CASE WHEN ? THEN ? ELSE changed_at END"
                " WHERE url = ?",
                (DONE, json.dumps(data, ensure_ascii=False), data.get("title") or "", now, now,
                 changed, now, url),
            )

    def mark_checked(self, url: str, stats: dict) -> None:
        """Page revérifiée sans changement de contenu : seules les statistiques changent."""
        song = self.get_song(url)
        data = {**(song["data"] or {}), **stats} if song else stats
        now = utc_now()
        with self._db:
            self._db.execute(
                "UPDATE songs SET status = ?, data = ?, error = NULL, updated_at = ?, checked_at = ?"
                " WHERE url = ?",
                (DONE, json.dumps(data, ensure_ascii=False), now, now, url),
            )

    def mark_gone(self, url: str) -> None:
        now = utc_now()
        with self._db:
            self._db.execute(
                "UPDATE songs SET status = ?, error = NULL, updated_at = ?, checked_at = ?"
                " WHERE url = ?",
                (GONE, now, now, url),
            )

    def mark_error(self, url: str, message: str) -> None:
        with self._db:
            self._db.execute(
                "UPDATE songs SET status = ?, error = ?, attempts = attempts + 1, updated_at = ?"
                " WHERE url = ?",
                (ERROR, message[:500], utc_now(), url),
            )

    def reset_errors(self, source: str) -> int:
        with self._db:
            cursor = self._db.execute(
                "UPDATE songs SET status = ?, attempts = 0 WHERE source = ? AND status = ?",
                (PENDING, source, ERROR),
            )
        return cursor.rowcount

    def iter_songs(self, source: str | None = None) -> Iterator[dict]:
        sql = "SELECT data FROM songs WHERE status = ? AND data IS NOT NULL"
        params: list = [DONE]
        if source:
            sql += " AND source = ?"
            params.append(source)
        for row in self._db.execute(sql + " ORDER BY rowid", params):
            yield json.loads(row["data"])

    def stats(self, source: str) -> dict[str, int]:
        counts = {PENDING: 0, DONE: 0, ERROR: 0, GONE: 0}
        rows = self._db.execute(
            "SELECT status, COUNT(*) AS n FROM songs WHERE source = ? GROUP BY status", (source,)
        )
        for row in rows:
            counts[row["status"]] = row["n"]
        counts["list_pages"] = len(self.list_pages_done(source))
        return counts
