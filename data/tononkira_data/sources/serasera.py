"""Source tononkira.serasera.org.

Pages lues :
- liste : https://tononkira.serasera.org/hira?page=N (20 chansons par page) ;
- chanson : https://tononkira.serasera.org/hira/<artiste>/<chanson>.
"""

from __future__ import annotations

import re
from datetime import datetime
from urllib.parse import parse_qs, urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

from ..models import ArtistRef, ListPage, Song, SongRef
from ..text import clean_inline, first_int, lyrics_from_html

BASE_URL = "https://tononkira.serasera.org"
# Heure de Madagascar (EAT), sans changement d'heure.
SITE_UTC_OFFSET = "+03:00"

_SONG_PATH = re.compile(r"^/hira/([^/]+)/([^/?#]+)/?$")
_ARTIST_PATH = re.compile(r"^/mpihira/([^/?#]+)/?$")
_EMPTY_PARENS = re.compile(r"\s*\(\s*[,;&/+\s]*\)\s*$")
_LYRICS_ID = re.compile(r"^[0-9a-f]{8,}$")

# Libellés de la fiche « Momba ny hira » (interface malagasy, avec repli fr/en).
_LABELS = {
    "artists": {"mpihira", "chanteur", "chanteurs", "artiste", "artistes", "singer", "artist"},
    "views": {"vangy", "vues", "views"},
    "likes": {"mpankafy", "fans", "likes"},
    "contributor": {"nampiditra", "ajouté par", "contributeur", "added by"},
    "date": {"daty", "date"},
}


def song_path_parts(url: str) -> tuple[str, str] | None:
    match = _SONG_PATH.match(urlsplit(url).path)
    return (match.group(1), match.group(2)) if match else None


def artist_slug(url: str) -> str | None:
    match = _ARTIST_PATH.match(urlsplit(url).path)
    return match.group(1) if match else None


def parse_site_datetime(text: str | None) -> str | None:
    """« 17/09/2026 12:16 » → « 2026-09-17T12:16:00+03:00 »."""
    match = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?", text or "")
    if not match:
        return None
    day, month, year, hour, minute = match.groups()
    try:
        moment = datetime(int(year), int(month), int(day), int(hour or 0), int(minute or 0))
    except ValueError:
        return None
    return moment.isoformat() + SITE_UTC_OFFSET


def _artists_in(node: Tag, base: str) -> list[ArtistRef]:
    artists: list[ArtistRef] = []
    seen: set[str] = set()
    for link in node.find_all("a", href=True):
        slug = artist_slug(urljoin(base, link["href"]))
        name = clean_inline(link.get_text())
        if slug and name and slug not in seen:
            seen.add(slug)
            artists.append(ArtistRef(slug=slug, name=name))
    return artists


class SeraseraSource:
    name = "serasera"

    def __init__(self, base_url: str = BASE_URL) -> None:
        self.base_url = base_url.rstrip("/")

    def list_page_url(self, page: int) -> str:
        return f"{self.base_url}/hira?page={page}"

    # --- Page de liste -------------------------------------------------------

    def parse_list_page(self, html: str) -> ListPage:
        soup = BeautifulSoup(html, "lxml")
        main = soup.select_one("#main") or soup
        songs: list[SongRef] = []
        seen: set[str] = set()

        for row in main.select("div.border.p-2"):
            song_link = None
            likes = None
            for link in row.find_all("a", href=True):
                href = urljoin(self.base_url, link["href"])
                path = urlsplit(href).path
                if path.endswith("/ankafizo"):
                    likes = first_int(link.get_text())
                elif song_link is None and song_path_parts(href):
                    song_link = (href, clean_inline(link.get_text()))
            if not song_link:
                continue
            url, title = song_link
            url = url.split("?")[0].split("#")[0].rstrip("/")
            if url in seen:
                continue
            seen.add(url)
            artist, slug = song_path_parts(url)  # type: ignore[misc]
            songs.append(
                SongRef(
                    url=url,
                    artist_slug=artist,
                    slug=slug,
                    title=title,
                    artists=tuple(_artists_in(row, self.base_url)),
                    likes=likes,
                )
            )

        return ListPage(songs=songs, last_page=self._last_page(soup))

    def _last_page(self, soup: BeautifulSoup) -> int | None:
        pages: list[int] = []
        for link in soup.select("ul.pagination a[href]"):
            values = parse_qs(urlsplit(link["href"]).query).get("page")
            if values and values[0].isdigit():
                pages.append(int(values[0]))
        return max(pages) if pages else None

    # --- Page de chanson -----------------------------------------------------

    def parse_song_page(self, html: str, url: str, scraped_at: str) -> Song:
        soup = BeautifulSoup(html, "lxml")
        parts = song_path_parts(url)
        if not parts:
            raise ValueError(f"URL de chanson inattendue : {url}")
        artist_slug_, slug = parts

        column = self._lyrics_column(soup)
        if column is None:
            raise ValueError(f"Bloc des paroles introuvable : {url}")

        heading = column.find("h2")
        heading_artists = _artists_in(heading, self.base_url) if heading else []
        title = self._title_from_heading(heading) if heading else ""

        lyrics_node = self._lyrics_node(column)
        lyrics = lyrics_from_html(lyrics_node) if lyrics_node else ""

        facts = self._facts(soup)
        artists = facts.get("artists") or heading_artists
        if not artists:
            artists = [ArtistRef(slug=artist_slug_, name=artist_slug_.replace("-", " ").title())]

        info_box = self._info_box(soup)
        image = info_box.find("img", src=True) if info_box else None
        audio = soup.select_one("#box-hira-audio audio[src]")

        return Song(
            source=self.name,
            source_url=url,
            artist_slug=artist_slug_,
            slug=slug,
            title=title or slug.replace("-", " "),
            artists=artists,
            lyrics=lyrics,
            views=facts.get("views") or 0,
            likes=facts.get("likes") or 0,
            contributor=facts.get("contributor"),
            published_at=facts.get("date"),
            image_url=urljoin(self.base_url, image["src"]) if image else None,
            audio_url=audio["src"] if audio else None,
            scraped_at=scraped_at,
        )

    def _lyrics_column(self, soup: BeautifulSoup) -> Tag | None:
        for column in soup.select("#main div.col-md-8"):
            if column.find("h2"):
                return column
        return None

    def _lyrics_node(self, column: Tag) -> Tag | None:
        # Le bloc des paroles porte un identifiant hexadécimal aléatoire.
        for div in column.find_all("div", id=True, recursive=False):
            if _LYRICS_ID.match(div["id"]):
                return div
        marker = column.select_one("div.print")
        return marker.find_next_sibling("div") if marker else None

    @staticmethod
    def _title_from_heading(heading: Tag) -> str:
        clone = BeautifulSoup(str(heading), "lxml").find("h2")
        for link in clone.find_all("a"):
            link.decompose()
        return _EMPTY_PARENS.sub("", clean_inline(clone.get_text()))

    def _info_box(self, soup: BeautifulSoup) -> Tag | None:
        for box in soup.select("#main div.col-md-4 > div.border"):
            if box.find("b"):
                return box
        return None

    def _facts(self, soup: BeautifulSoup) -> dict:
        """Lit les paires « <b>Libellé :</b> valeur » de la fiche de la chanson."""
        box = self._info_box(soup)
        if box is None:
            return {}
        facts: dict = {}
        for label_tag in box.find_all("b"):
            label = clean_inline(label_tag.get_text()).rstrip(":").strip().lower()
            key = next((k for k, names in _LABELS.items() if label in names), None)
            if key is None:
                continue
            value = BeautifulSoup("", "lxml").new_tag("span")
            for sibling in list(label_tag.next_siblings):
                if isinstance(sibling, Tag) and sibling.name in {"b", "h5", "div", "img"}:
                    break
                value.append(sibling.__copy__() if isinstance(sibling, Tag) else str(sibling))
            text = clean_inline(value.get_text())
            if key == "artists":
                facts[key] = _artists_in(value, self.base_url)
            elif key in {"views", "likes"}:
                facts[key] = first_int(text)
            elif key == "contributor":
                facts[key] = text or None
            elif key == "date":
                facts[key] = parse_site_datetime(text)
        return facts
