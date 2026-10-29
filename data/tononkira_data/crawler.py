"""Orchestration de la collecte : pages de liste, pages de chansons, revérifications.

Chaque étape signale sa progression par `on_event(dict)` : la ligne de commande les
écrit en JSON (option --events) pour que l'API d'administration suive une tâche.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from typing import Protocol

from .compare import compare_songs
from .http import DisallowedByRobots, FetchError
from .models import SongRef
from .sources import Source
from .state import DONE, CrawlState, utc_now

log = logging.getLogger(__name__)

EventHandler = Callable[[dict], None]


def _ignore(_event: dict) -> None:
    pass


class TextFetcher(Protocol):
    def get_text(self, url: str) -> str | None: ...


@dataclass
class ListReport:
    pages: int = 0
    skipped: int = 0
    found: int = 0
    new: int = 0
    last_page: int | None = None


@dataclass
class SongReport:
    total: int = 0
    saved: int = 0
    gone: int = 0
    errors: int = 0


@dataclass
class RefreshResult:
    url: str
    status: str  # new | updated | unchanged | gone | error
    changes: list[str] = field(default_factory=list)
    stats: list[str] = field(default_factory=list)
    song: dict | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RecheckReport:
    total: int = 0
    new: int = 0
    updated: int = 0
    unchanged: int = 0
    gone: int = 0
    errors: int = 0


def last_page_key(source: str) -> str:
    return f"{source}:last_page"


def crawl_lists(
    source: Source,
    client: TextFetcher,
    state: CrawlState,
    *,
    start: int = 1,
    end: int | None = None,
    skip_done: bool = True,
    stop_when_known: bool = False,
    on_event: EventHandler = _ignore,
) -> ListReport:
    """Parcourt les pages de liste de `start` jusqu'à `end` (ou la dernière page
    annoncée par la pagination). La première page est toujours lue pour connaître
    le nombre de pages ; les suivantes déjà lues sont sautées si `skip_done`."""
    report = ListReport()
    done = state.list_pages_done(source.name) if skip_done else set()
    limit = end
    page = start
    on_event({"event": "phase", "phase": "lists", "from": start, "to": end})

    while limit is None or page <= limit:
        if page != start and page in done:
            report.skipped += 1
            page += 1
            continue

        html = client.get_text(source.list_page_url(page))
        if html is None:
            log.info("Page %d introuvable : fin de la liste.", page)
            break
        listing = source.parse_list_page(html)
        if not listing.songs:
            log.info("Page %d vide : fin de la liste.", page)
            break

        new = state.add_refs(source.name, listing.songs)
        state.record_list_page(source.name, page, len(listing.songs))
        report.pages += 1
        report.found += len(listing.songs)
        report.new += new

        if listing.last_page is not None:
            detected = max(listing.last_page, page)
            report.last_page = detected
            state.set_meta(last_page_key(source.name), str(detected))
            limit = detected if end is None else min(end, detected)
        log.info(
            "Liste page %d/%s : %d chansons, %d nouvelles",
            page,
            limit if limit is not None else "?",
            len(listing.songs),
            new,
        )
        on_event(
            {
                "event": "list_page",
                "page": page,
                "last": limit,
                "found": len(listing.songs),
                "new": new,
            }
        )
        if stop_when_known and new == 0:
            log.info("Aucune nouvelle chanson page %d : arrêt de la mise à jour.", page)
            break
        page += 1

    return report


def crawl_songs(
    source: Source,
    client: TextFetcher,
    state: CrawlState,
    *,
    limit: int | None = None,
    retry_errors: bool = False,
    now: Callable[[], str] = utc_now,
    progress_every: int = 25,
    on_event: EventHandler = _ignore,
) -> SongReport:
    urls = state.pending(source.name, limit=limit, include_errors=retry_errors)
    report = SongReport(total=len(urls))
    log.info("%d chansons à récupérer.", report.total)
    on_event({"event": "phase", "phase": "songs", "total": report.total})

    for index, url in enumerate(urls, start=1):
        try:
            html = client.get_text(url)
            if html is None:
                state.mark_gone(url)
                report.gone += 1
            else:
                song = source.parse_song_page(html, url, now())
                state.save_song(url, song.to_dict())
                report.saved += 1
        except (FetchError, DisallowedByRobots, ValueError) as exc:
            state.mark_error(url, f"{type(exc).__name__}: {exc}")
            report.errors += 1
            log.warning("Échec %s : %s", url, exc)

        on_event({"event": "song", "index": index, **asdict(report)})
        if index % progress_every == 0 or index == report.total:
            log.info(
                "Chansons %d/%d (%.1f %%) — %d enregistrées, %d disparues, %d erreurs",
                index,
                report.total,
                100 * index / report.total,
                report.saved,
                report.gone,
                report.errors,
            )
    return report


def refresh_song(
    source: Source,
    client: TextFetcher,
    state: CrawlState,
    url: str,
    *,
    now: Callable[[], str] = utc_now,
) -> RefreshResult:
    """Relit une page de chanson et la compare à la version enregistrée.

    - contenu modifié (titre, artistes, paroles…) : la nouvelle version remplace l'ancienne ;
    - contenu identique : seules les statistiques (vues, mentions) sont mises à jour,
      les paroles enregistrées ne bougent pas ;
    - page disparue : marquée `gone` (les données déjà collectées sont gardées).
    """
    previous = state.get_song(url)
    try:
        html = client.get_text(url)
        if html is None:
            if previous:
                state.mark_gone(url)
            return RefreshResult(url, "gone")
        song = source.parse_song_page(html, url, now()).to_dict()
    except (FetchError, DisallowedByRobots, ValueError) as exc:
        message = f"{type(exc).__name__}: {exc}"
        # Une chanson déjà collectée garde son statut : un échec ponctuel ne doit pas
        # la retirer de l'export.
        if previous and previous["status"] != DONE:
            state.mark_error(url, message)
        return RefreshResult(url, "error", error=message)

    if previous is None:
        ref = SongRef(url=url, artist_slug=song["artist_slug"], slug=song["slug"], title=song["title"])
        state.add_refs(source.name, [ref])
    old = previous["data"] if previous else None
    if old is None:
        state.save_song(url, song, changed=True)
        return RefreshResult(url, "new", song=song)

    comparison = compare_songs(old, song)
    if comparison.content:
        state.save_song(url, song, changed=True)
        return RefreshResult(url, "updated", comparison.content, comparison.stats, song)

    stats = {"views": song["views"], "likes": song["likes"]}
    state.mark_checked(url, stats)
    return RefreshResult(url, "unchanged", [], comparison.stats, {**old, **stats})


def recheck_songs(
    source: Source,
    client: TextFetcher,
    state: CrawlState,
    *,
    limit: int | None = None,
    now: Callable[[], str] = utc_now,
    progress_every: int = 25,
    on_event: EventHandler = _ignore,
) -> RecheckReport:
    """Revérifie les chansons déjà collectées, en commençant par les moins récemment vérifiées."""
    urls = state.to_recheck(source.name, limit=limit)
    report = RecheckReport(total=len(urls))
    log.info("%d chansons à revérifier.", report.total)
    on_event({"event": "phase", "phase": "recheck", "total": report.total})

    for index, url in enumerate(urls, start=1):
        result = refresh_song(source, client, state, url, now=now)
        setattr(report, _REPORT_FIELD[result.status], getattr(report, _REPORT_FIELD[result.status]) + 1)
        if result.status == "updated":
            log.info("Modifiée : %s (%s)", url, ", ".join(result.changes))
        elif result.status == "error":
            log.warning("Échec %s : %s", url, result.error)
        on_event({"event": "recheck", "index": index, **asdict(report)})
        if index % progress_every == 0 or index == report.total:
            log.info(
                "Revérification %d/%d — %d modifiées, %d inchangées, %d disparues, %d erreurs",
                index,
                report.total,
                report.updated,
                report.unchanged,
                report.gone,
                report.errors,
            )
    return report


_REPORT_FIELD = {
    "new": "new",
    "updated": "updated",
    "unchanged": "unchanged",
    "gone": "gone",
    "error": "errors",
}
