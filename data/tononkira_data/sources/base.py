"""Interface commune aux sources de paroles. Ajouter une source = écrire une classe
qui respecte ce protocole et l'enregistrer dans `sources/__init__.py`."""

from __future__ import annotations

from typing import Protocol

from ..models import ListPage, Song


class Source(Protocol):
    name: str

    def list_page_url(self, page: int) -> str: ...

    def parse_list_page(self, html: str) -> ListPage: ...

    def parse_song_page(self, html: str, url: str, scraped_at: str) -> Song: ...
