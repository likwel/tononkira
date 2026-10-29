from tononkira_data.models import SongRef
from tononkira_data.state import CrawlState


def ref(n: int) -> SongRef:
    return SongRef(url=f"https://x.org/hira/a/s{n}", artist_slug="a", slug=f"s{n}", title=f"S{n}")


def test_ajout_idempotent_et_compte_des_nouvelles():
    state = CrawlState(":memory:")
    assert state.add_refs("src", [ref(1), ref(2)]) == 2
    assert state.add_refs("src", [ref(2), ref(3)]) == 1
    assert state.pending("src") == [ref(1).url, ref(2).url, ref(3).url]


def test_cycle_de_vie_des_statuts():
    state = CrawlState(":memory:")
    state.add_refs("src", [ref(1), ref(2), ref(3)])
    state.save_song(ref(1).url, {"title": "S1"})
    state.mark_gone(ref(2).url)
    state.mark_error(ref(3).url, "HTTP 500")

    assert state.pending("src") == []
    assert state.pending("src", include_errors=True) == [ref(3).url]
    assert list(state.iter_songs("src")) == [{"title": "S1"}]
    assert state.stats("src") == {"pending": 0, "done": 1, "error": 1, "gone": 1, "list_pages": 0}


def test_erreurs_abandonnees_apres_trop_de_tentatives_puis_remises_en_attente():
    state = CrawlState(":memory:")
    state.add_refs("src", [ref(1)])
    for _ in range(3):
        state.mark_error(ref(1).url, "timeout")
    assert state.pending("src", include_errors=True, max_attempts=3) == []

    assert state.reset_errors("src") == 1
    assert state.pending("src") == [ref(1).url]


def test_sources_isolees_et_pages_de_liste():
    state = CrawlState(":memory:")
    state.add_refs("a", [ref(1)])
    state.record_list_page("a", 1, 20)
    state.record_list_page("a", 1, 18)
    assert state.pending("b") == []
    assert state.list_pages_done("a") == {1}
    assert state.list_pages_done("b") == set()


def test_reprise_apres_reouverture(tmp_path):
    path = tmp_path / "state.sqlite3"
    with CrawlState(path) as state:
        state.add_refs("src", [ref(1)])
    with CrawlState(path) as state:
        assert state.pending("src") == [ref(1).url]


OLD_SCHEMA = """
CREATE TABLE songs (
    url TEXT PRIMARY KEY, source TEXT NOT NULL, artist_slug TEXT NOT NULL, slug TEXT NOT NULL,
    title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
    error TEXT, data TEXT, discovered_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
INSERT INTO songs VALUES ('u1', 'src', 'a', 's1', 'S1', 'done', 0, NULL, '{"title": "S1"}', 'T', 'T');
"""


def test_base_de_la_premiere_version_migree_sans_perte(tmp_path):
    import sqlite3

    path = tmp_path / "ancienne.sqlite3"
    old = sqlite3.connect(path)
    old.executescript(OLD_SCHEMA)
    old.close()

    with CrawlState(path) as state:
        assert list(state.iter_songs("src")) == [{"title": "S1"}]
        assert state.get_song("u1")["checked_at"] is None
        assert state.to_recheck("src") == ["u1"]


def test_meta_et_revérification_des_plus_anciennes_d_abord():
    state = CrawlState(":memory:")
    state.set_meta("src:last_page", "884")
    state.set_meta("src:last_page", "885")
    assert state.get_meta("src:last_page") == "885"
    assert state.get_meta("absente") is None

    state.add_refs("src", [ref(1), ref(2), ref(3)])
    state.save_song(ref(1).url, {"title": "S1"})
    state.save_song(ref(2).url, {"title": "S2"})
    with state._db:
        state._db.execute("UPDATE songs SET checked_at = '2026-01-01' WHERE url = ?", (ref(2).url,))
        state._db.execute("UPDATE songs SET checked_at = NULL WHERE url = ?", (ref(1).url,))
    # Jamais vérifiée d'abord, puis la plus ancienne ; les chansons non collectées sont exclues.
    assert state.to_recheck("src") == [ref(1).url, ref(2).url]
    assert state.to_recheck("src", limit=1) == [ref(1).url]


def test_verification_sans_changement_ne_touche_que_les_statistiques():
    state = CrawlState(":memory:")
    state.add_refs("src", [ref(1)])
    state.save_song(ref(1).url, {"title": "S1", "lyrics": "la", "views": 1})
    changed_at = state.get_song(ref(1).url)["changed_at"]

    state.mark_checked(ref(1).url, {"views": 9})

    song = state.get_song(ref(1).url)
    assert song["data"] == {"title": "S1", "lyrics": "la", "views": 9}
    assert song["changed_at"] == changed_at
    assert song["checked_at"] is not None
