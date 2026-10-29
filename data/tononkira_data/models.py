"""Structures de données échangées entre les sources, l'état de collecte et l'export.

La forme de `Song.to_dict()` est le contrat avec l'API : voir `contracts/song.example.json`.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class ArtistRef:
    slug: str
    name: str


@dataclass(frozen=True)
class SongRef:
    """Une chanson repérée dans une page de liste (pas encore ses paroles)."""

    url: str
    artist_slug: str
    slug: str
    title: str
    artists: tuple[ArtistRef, ...] = ()
    likes: int | None = None


@dataclass(frozen=True)
class ListPage:
    songs: list[SongRef]
    last_page: int | None


@dataclass
class Song:
    source: str
    source_url: str
    artist_slug: str
    slug: str
    title: str
    artists: list[ArtistRef]
    lyrics: str
    views: int = 0
    likes: int = 0
    contributor: str | None = None
    published_at: str | None = None
    image_url: str | None = None
    audio_url: str | None = None
    scraped_at: str = field(default="")

    def to_dict(self) -> dict:
        data = asdict(self)
        data["artists"] = [asdict(a) for a in self.artists]
        return data
