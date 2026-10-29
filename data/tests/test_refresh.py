"""Vérification d'une page déjà collectée (bouton « Vérifier » de l'administration)."""

import json

from tononkira_data.crawler import recheck_songs, refresh_song
from tononkira_data.http import FetchError
from tononkira_data.models import ArtistRef, ListPage, Song, SongRef
from tononkira_data.state import CrawlState

URL = "https://x.org/hira/mpihira/hira"
LYRICS = "Andalana voalohany\nAndalana faharoa\n\nRef: Fiverenany"


class JsonSource:
    """Source factice : le « HTML » est le JSON des champs de la chanson."""

    name = "fake"

    def list_page_url(self, page: int) -> str:
        return f"list:{page}"

    def parse_list_page(self, html: str) -> ListPage:
        return ListPage(songs=[], last_page=None)

    def parse_song_page(self, html: str, url: str, scraped_at: str) -> Song:
        fields = json.loads(html)
        return Song(
            source=self.name,
            source_url=url,
            artist_slug="mpihira",
            slug="hira",
            title=fields.get("title", "Hira"),
            artists=[ArtistRef("mpihira", "Mpihira")],
            lyrics=fields.get("lyrics", LYRICS),
            views=fields.get("views", 10),
            likes=0,
            scraped_at=scraped_at,
        )


class FakeClient:
    def __init__(self, response):
        self.response = response

    def get_text(self, url):
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


def page(**fields) -> str:
    return json.dumps(fields)


def collected_state() -> CrawlState:
    state = CrawlState(":memory:")
    refresh_song(JsonSource(), FakeClient(page()), state, URL, now=lambda: "T0")
    return state


def test_page_inconnue_collectee_comme_nouvelle():
    state = CrawlState(":memory:")
    result = refresh_song(JsonSource(), FakeClient(page()), state, URL, now=lambda: "T0")
    assert result.status == "new"
    assert state.get_song(URL)["status"] == "done"
    assert state.get_song(URL)["changed_at"] is not None


def test_page_identique_aux_mots_pres_ne_change_que_les_statistiques():
    state = collected_state()
    noisy = LYRICS.replace("voalohany", "voalohany qwxyz")
    result = refresh_song(JsonSource(), FakeClient(page(lyrics=noisy, views=15)), state, URL, now=lambda: "T1")

    assert result.status == "unchanged"
    assert result.stats == ["vues"]
    stored = state.get_song(URL)["data"]
    assert stored["lyrics"] == LYRICS  # les paroles enregistrées ne bougent pas
    assert stored["views"] == 15
    assert stored["scraped_at"] == "T0"


def test_page_modifiee_remplace_la_version_enregistree():
    state = collected_state()
    result = refresh_song(
        JsonSource(), FakeClient(page(title="Hira nohitsiana")), state, URL, now=lambda: "T1"
    )
    assert result.status == "updated"
    assert result.changes == ["titre"]
    assert state.get_song(URL)["data"]["title"] == "Hira nohitsiana"
    assert result.song["scraped_at"] == "T1"


def test_page_disparue_garde_les_donnees():
    state = collected_state()
    result = refresh_song(JsonSource(), FakeClient(None), state, URL)
    assert result.status == "gone"
    song = state.get_song(URL)
    assert song["status"] == "gone"
    assert song["data"]["title"] == "Hira"


def test_echec_ponctuel_ne_retire_pas_une_chanson_collectee():
    state = collected_state()
    result = refresh_song(JsonSource(), FakeClient(FetchError("HTTP 503")), state, URL)
    assert result.status == "error"
    assert "HTTP 503" in result.error
    assert state.get_song(URL)["status"] == "done"
    assert len(list(state.iter_songs())) == 1


def test_echec_sur_une_chanson_en_attente_est_enregistre():
    state = CrawlState(":memory:")
    state.add_refs("fake", [SongRef(URL, "mpihira", "hira", "Hira")])
    refresh_song(JsonSource(), FakeClient(FetchError("HTTP 500")), state, URL)
    assert state.get_song(URL)["status"] == "error"


def test_revérification_par_lot_compte_et_signale_la_progression():
    state = collected_state()
    other = "https://x.org/hira/mpihira/hafa"
    refresh_song(JsonSource(), FakeClient(page()), state, other)
    events = []

    report = recheck_songs(
        JsonSource(), FakeClient(page(title="Vaovao")), state, limit=5, on_event=events.append
    )

    assert (report.total, report.updated, report.unchanged) == (2, 2, 0)
    assert events[0] == {"event": "phase", "phase": "recheck", "total": 2}
    assert events[-1]["index"] == 2
    assert events[-1]["updated"] == 2
