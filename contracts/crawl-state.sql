-- Schéma de la base de collecte (data/output/state.sqlite3).
-- Écrit par data/ (tononkira_data/state.py, constante SCHEMA), lu en lecture seule par l'API
-- d'administration. Les deux doivent rester identiques : data/tests/test_contract.py le vérifie.
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
