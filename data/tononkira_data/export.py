"""Export JSONL des chansons collectées (format : `contracts/song.example.json`)."""

from __future__ import annotations

import json
import os
from pathlib import Path

from .state import CrawlState


def export_jsonl(state: CrawlState, out_path: Path | str, source: str | None = None) -> int:
    """Écrit une chanson par ligne. Le fichier final n'est remplacé qu'une fois
    l'écriture terminée, pour qu'un import concurrent ne lise jamais un fichier tronqué."""
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.name + ".tmp")
    count = 0
    with tmp.open("w", encoding="utf-8") as handle:
        for song in state.iter_songs(source):
            handle.write(json.dumps(song, ensure_ascii=False) + "\n")
            count += 1
    os.replace(tmp, out)
    return count
