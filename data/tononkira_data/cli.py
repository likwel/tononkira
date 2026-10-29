"""Ligne de commande : `python -m tononkira_data <commande>`.

Avec --events, la progression est écrite en JSON (une ligne par événement) sur la
sortie standard, et le journal reste sur la sortie d'erreur : c'est ce que lit l'API
d'administration quand elle lance une tâche.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from .crawler import (
    EventHandler,
    crawl_lists,
    crawl_songs,
    last_page_key,
    recheck_songs,
    refresh_song,
)
from .export import export_jsonl
from .http import DEFAULT_USER_AGENT, PoliteClient
from .sources import SOURCES, get_source
from .state import CrawlState

OUTPUT_DIR = Path(__file__).resolve().parents[1] / "output"
DEFAULT_STATE = OUTPUT_DIR / "state.sqlite3"
DEFAULT_EXPORT = OUTPUT_DIR / "songs.jsonl"

log = logging.getLogger("tononkira_data")


def build_parser() -> argparse.ArgumentParser:
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--source", default="serasera", choices=sorted(SOURCES))
    common.add_argument("--state", type=Path, default=DEFAULT_STATE, help="base SQLite de reprise")
    common.add_argument(
        "--events", action="store_true", help="progression en JSON sur la sortie standard"
    )
    common.add_argument("-v", "--verbose", action="store_true")

    network = argparse.ArgumentParser(add_help=False)
    network.add_argument(
        "--delay", type=float, default=1.5, help="secondes minimum entre deux requêtes (défaut 1.5)"
    )
    network.add_argument("--user-agent", default=DEFAULT_USER_AGENT)

    output = argparse.ArgumentParser(add_help=False)
    output.add_argument("--out", type=Path, default=DEFAULT_EXPORT, help="fichier JSONL exporté")
    output.add_argument("--no-export", action="store_true", help="ne pas régénérer le JSONL")

    parser = argparse.ArgumentParser(
        prog="tononkira_data", description="Collecte des paroles de chansons malagasy."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    crawl = sub.add_parser(
        "crawl",
        parents=[common, network, output],
        help="collecte : pages de liste, puis paroles, puis export",
    )
    crawl.add_argument("--from", dest="start", type=int, default=1, help="première page de liste")
    crawl.add_argument("--to", dest="end", type=int, help="dernière page (défaut : la dernière)")
    crawl.add_argument("--limit", type=int, help="nombre maximum de chansons à récupérer")
    crawl.add_argument("--lists-only", action="store_true", help="ne lire que les pages de liste")
    crawl.add_argument("--songs-only", action="store_true", help="ne lire que les chansons en attente")
    crawl.add_argument(
        "--refresh-lists", action="store_true", help="relire les pages de liste déjà lues"
    )
    crawl.add_argument(
        "--retry-errors", action="store_true", help="retenter les chansons en erreur"
    )

    sub.add_parser(
        "update",
        parents=[common, network, output],
        help="ajouts récents : lit les listes depuis la page 1 jusqu'à une page sans nouveauté",
    )

    recheck = sub.add_parser(
        "recheck",
        parents=[common, network, output],
        help="revérifie les chansons déjà collectées (les moins récemment vérifiées d'abord)",
    )
    recheck.add_argument("--limit", type=int, help="nombre maximum de chansons à revérifier")

    refresh = sub.add_parser(
        "refresh", parents=[common, network], help="relit une page de chanson et détecte les changements"
    )
    refresh.add_argument("--url", required=True, help="URL de la page de chanson")
    refresh.add_argument("--json", action="store_true", help="résultat en JSON")

    sub.add_parser("export", parents=[common, output], help="exporter les chansons en JSONL")
    stats = sub.add_parser("stats", parents=[common], help="afficher l'avancement")
    stats.add_argument("--json", action="store_true")
    sub.add_parser("retry", parents=[common], help="remettre les erreurs en attente")
    return parser


def _emitter(enabled: bool) -> EventHandler:
    if not enabled:
        return lambda _event: None

    def emit(event: dict) -> None:
        print(json.dumps(event, ensure_ascii=False), flush=True)

    return emit


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    source = get_source(args.source)
    emit = _emitter(args.events)

    with CrawlState(args.state) as state:
        try:
            if args.command == "crawl":
                _crawl(args, source, state, emit)
            elif args.command == "update":
                _update(args, source, state, emit)
            elif args.command == "recheck":
                _recheck(args, source, state, emit)
            elif args.command == "refresh":
                return _refresh(args, source, state)
            elif args.command == "export":
                _export(args, state, emit)
            elif args.command == "stats":
                _print_stats(source.name, state, as_json=args.json)
            elif args.command == "retry":
                print(f"{state.reset_errors(source.name)} chansons remises en attente.")
        except KeyboardInterrupt:
            log.warning("Interrompu. Relancer la même commande reprend là où elle s'est arrêtée.")
            emit({"event": "interrupted"})
            return 130
    return 0


def _client(args: argparse.Namespace) -> PoliteClient:
    return PoliteClient(user_agent=args.user_agent, delay=args.delay)


def _crawl(args: argparse.Namespace, source, state: CrawlState, emit: EventHandler) -> None:
    with _client(args) as client:
        if not args.songs_only:
            report = crawl_lists(
                source,
                client,
                state,
                start=args.start,
                end=args.end,
                skip_done=not args.refresh_lists,
                on_event=emit,
            )
            log.info(
                "Listes : %d pages lues, %d sautées, %d chansons repérées dont %d nouvelles.",
                report.pages,
                report.skipped,
                report.found,
                report.new,
            )
            emit({"event": "lists_done", **vars(report)})
        if not args.lists_only:
            report = crawl_songs(
                source,
                client,
                state,
                limit=args.limit,
                retry_errors=args.retry_errors,
                on_event=emit,
            )
            log.info(
                "Chansons : %d enregistrées, %d disparues, %d erreurs.",
                report.saved,
                report.gone,
                report.errors,
            )
            emit({"event": "songs_done", **vars(report)})
    if not args.no_export:
        _export(args, state, emit)


def _update(args: argparse.Namespace, source, state: CrawlState, emit: EventHandler) -> None:
    with _client(args) as client:
        lists = crawl_lists(
            source, client, state, start=1, skip_done=False, stop_when_known=True, on_event=emit
        )
        log.info("Mise à jour : %d nouvelles chansons repérées.", lists.new)
        emit({"event": "lists_done", **vars(lists)})
        songs = crawl_songs(source, client, state, on_event=emit)
        emit({"event": "songs_done", **vars(songs)})
    if not args.no_export:
        _export(args, state, emit)


def _recheck(args: argparse.Namespace, source, state: CrawlState, emit: EventHandler) -> None:
    with _client(args) as client:
        report = recheck_songs(source, client, state, limit=args.limit, on_event=emit)
    emit({"event": "recheck_done", **vars(report)})
    if not args.no_export:
        _export(args, state, emit)


def _refresh(args: argparse.Namespace, source, state: CrawlState) -> int:
    with _client(args) as client:
        result = refresh_song(source, client, state, args.url)
    if args.json:
        print(json.dumps(result.to_dict(), ensure_ascii=False))
    else:
        detail = ", ".join(result.changes) or result.error or ""
        print(f"{result.status} {args.url} {detail}".rstrip())
    return 1 if result.status == "error" else 0


def _export(args: argparse.Namespace, state: CrawlState, emit: EventHandler) -> None:
    count = export_jsonl(state, args.out, args.source)
    log.info("%d chansons exportées dans %s", count, args.out)
    emit({"event": "exported", "count": count, "path": str(args.out)})


def _print_stats(source: str, state: CrawlState, *, as_json: bool) -> None:
    stats = state.stats(source)
    last_page = state.get_meta(last_page_key(source))
    if as_json:
        print(json.dumps({**stats, "last_page": int(last_page) if last_page else None}))
        return
    total = stats["pending"] + stats["done"] + stats["error"] + stats["gone"]
    print(f"Source            : {source}")
    print(f"Pages de liste    : {stats['list_pages']} / {last_page or '?'}")
    print(f"Chansons repérées : {total}")
    print(f"  enregistrées    : {stats['done']}")
    print(f"  en attente      : {stats['pending']}")
    print(f"  en erreur       : {stats['error']}")
    print(f"  disparues (404) : {stats['gone']}")


if __name__ == "__main__":
    sys.exit(main())
