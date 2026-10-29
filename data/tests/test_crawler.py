from tononkira_data.crawler import crawl_lists, crawl_songs
from tononkira_data.http import FetchError
from tononkira_data.models import ListPage, Song, SongRef
from tononkira_data.state import CrawlState


class FakeSource:
    """Source factice : la page N liste les chansons N-1 et N-2, 3 pages au total."""

    name = "fake"

    def list_page_url(self, page: int) -> str:
        return f"list:{page}"

    def parse_list_page(self, html: str) -> ListPage:
        if html == "empty":
            return ListPage(songs=[], last_page=None)
        page = int(html)
        songs = [
            SongRef(url=f"song:{page}-{i}", artist_slug="a", slug=f"s{page}{i}", title="t")
            for i in (1, 2)
        ]
        return ListPage(songs=songs, last_page=3)

    def parse_song_page(self, html: str, url: str, scraped_at: str) -> Song:
        if html == "broken":
            raise ValueError("Bloc des paroles introuvable")
        return Song(
            source=self.name,
            source_url=url,
            artist_slug="a",
            slug=url,
            title=html,
            artists=[],
            lyrics="la",
            scraped_at=scraped_at,
        )


class FakeClient:
    def __init__(self, pages: dict[str, object]):
        self.pages = pages
        self.calls: list[str] = []

    def get_text(self, url: str):
        self.calls.append(url)
        value = self.pages.get(url)
        if isinstance(value, Exception):
            raise value
        return value


LIST_PAGES = {"list:1": "1", "list:2": "2", "list:3": "3"}


def test_listes_parcourues_jusqua_la_derniere_page_annoncee():
    state = CrawlState(":memory:")
    client = FakeClient(LIST_PAGES | {"list:4": "4"})

    report = crawl_lists(FakeSource(), client, state)

    assert client.calls == ["list:1", "list:2", "list:3"]
    assert (report.pages, report.found, report.new, report.last_page) == (3, 6, 6, 3)


def test_listes_bornees_par_to_et_reprise_sans_relire_les_pages_lues():
    state = CrawlState(":memory:")
    crawl_lists(FakeSource(), FakeClient(LIST_PAGES), state, start=1, end=2)

    client = FakeClient(LIST_PAGES)
    report = crawl_lists(FakeSource(), client, state, start=1)

    assert client.calls == ["list:1", "list:3"]
    assert report.skipped == 1


def test_listes_arretees_sur_page_vide_ou_absente():
    state = CrawlState(":memory:")
    client = FakeClient({"list:1": "empty"})
    assert crawl_lists(FakeSource(), client, state).pages == 0

    client = FakeClient({})
    assert crawl_lists(FakeSource(), client, state).pages == 0


def test_mise_a_jour_arretee_a_la_premiere_page_sans_nouveaute():
    state = CrawlState(":memory:")
    crawl_lists(FakeSource(), FakeClient(LIST_PAGES), state, end=1)

    client = FakeClient(LIST_PAGES)
    report = crawl_lists(FakeSource(), client, state, skip_done=False, stop_when_known=True)

    assert client.calls == ["list:1"]
    assert report.new == 0


def test_chansons_enregistrees_disparues_ou_en_erreur():
    state = CrawlState(":memory:")
    crawl_lists(FakeSource(), FakeClient(LIST_PAGES), state, end=2)
    client = FakeClient(
        {
            "song:1-1": "Titre 1",
            "song:1-2": None,
            "song:2-1": FetchError("HTTP 403"),
            "song:2-2": "broken",
        }
    )

    report = crawl_songs(FakeSource(), client, state, now=lambda: "T")

    assert (report.total, report.saved, report.gone, report.errors) == (4, 1, 1, 2)
    songs = list(state.iter_songs("fake"))
    assert [(s["title"], s["scraped_at"]) for s in songs] == [("Titre 1", "T")]
    assert state.stats("fake")["error"] == 2


def test_limite_du_nombre_de_chansons():
    state = CrawlState(":memory:")
    crawl_lists(FakeSource(), FakeClient(LIST_PAGES), state)
    client = FakeClient({f"song:{p}-{i}": "x" for p in (1, 2, 3) for i in (1, 2)})

    assert crawl_songs(FakeSource(), client, state, limit=2).saved == 2
    assert len(state.pending("fake")) == 4


def test_progression_signalee_et_derniere_page_memorisee():
    state = CrawlState(":memory:")
    events = []
    crawl_lists(FakeSource(), FakeClient(LIST_PAGES), state, end=2, on_event=events.append)
    crawl_songs(
        FakeSource(),
        FakeClient({"song:1-1": "x"}),
        state,
        limit=1,
        on_event=events.append,
    )

    assert events[0] == {"event": "phase", "phase": "lists", "from": 1, "to": 2}
    assert events[1] == {"event": "list_page", "page": 1, "last": 2, "found": 2, "new": 2}
    assert {"event": "phase", "phase": "songs", "total": 1} in events
    assert events[-1] == {"event": "song", "index": 1, "total": 1, "saved": 1, "gone": 0, "errors": 0}
    assert state.get_meta("fake:last_page") == "3"
