"""Détection des modifications d'une chanson entre deux collectes."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

CONTENT_LABELS = {
    "title": "titre",
    "artists": "artistes",
    "lyrics": "paroles",
    "contributor": "contributeur",
    "published_at": "date",
    "image_url": "image",
    "audio_url": "audio",
}
STATS_LABELS = {"views": "vues", "likes": "mentions j'aime"}

# La source insère dans chaque page quelques mots aléatoires, différents à chaque
# chargement : deux collectes d'une page inchangée diffèrent donc de quelques mots.
# Jusqu'à ce nombre de mots ajoutés ou retirés (structure identique), les paroles
# sont considérées comme inchangées.
WORD_TOLERANCE = 4


def _structure(lyrics: str) -> list[int]:
    """Nombre de lignes de chaque strophe."""
    stanzas = re.split(r"\n\s*\n", lyrics.strip())
    return [len([line for line in s.split("\n") if line.strip()]) for s in stanzas if s.strip()]


def lyrics_changed(old: str, new: str, tolerance: int = WORD_TOLERANCE) -> bool:
    if _structure(old) != _structure(new):
        return True
    before, after = Counter(old.split()), Counter(new.split())
    removed = sum((before - after).values())
    added = sum((after - before).values())
    return removed > tolerance or added > tolerance


@dataclass
class Comparison:
    content: list[str] = field(default_factory=list)
    stats: list[str] = field(default_factory=list)


def compare_songs(old: dict, new: dict) -> Comparison:
    """Champs modifiés, en libellés lisibles : contenu d'un côté, statistiques de l'autre."""
    result = Comparison()
    for key, label in CONTENT_LABELS.items():
        if key == "lyrics":
            changed = lyrics_changed(old.get("lyrics") or "", new.get("lyrics") or "")
        else:
            changed = old.get(key) != new.get(key)
        if changed:
            result.content.append(label)
    for key, label in STATS_LABELS.items():
        if old.get(key) != new.get(key):
            result.stats.append(label)
    return result
