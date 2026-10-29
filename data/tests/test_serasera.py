import pytest

from tononkira_data.models import ArtistRef
from tononkira_data.sources.serasera import SeraseraSource, parse_site_datetime, song_path_parts

SONG_URL = "https://tononkira.serasera.org/hira/mpihira-voalohany/hira-voalohany"


@pytest.fixture
def source():
    return SeraseraSource()


def test_url_de_page_de_liste(source):
    assert source.list_page_url(9) == "https://tononkira.serasera.org/hira?page=9"


def test_page_de_liste_extrait_les_chansons_sans_doublon(source, fixture_html):
    listing = source.parse_list_page(fixture_html("serasera_list.html"))

    assert [s.url for s in listing.songs] == [
        SONG_URL,
        "https://tononkira.serasera.org/hira/duo-sy-namana/hira-faharoa",
    ]
    first, second = listing.songs
    assert (first.artist_slug, first.slug, first.title, first.likes) == (
        "mpihira-voalohany",
        "hira-voalohany",
        "Hira voalohany",
        12,
    )
    assert second.title == "'Ndao, hira faharoa"
    assert second.artists == (
        ArtistRef("duo-sy-namana", "Duo sy Namana"),
        ArtistRef("mpiara-mihira", "Mpiara-mihira"),
    )


def test_page_de_liste_donne_la_derniere_page(source, fixture_html):
    assert source.parse_list_page(fixture_html("serasera_list.html")).last_page == 884


def test_page_sans_chanson_ni_pagination(source):
    listing = source.parse_list_page("<html><body><div id='main'></div></body></html>")
    assert listing.songs == []
    assert listing.last_page is None


def test_page_de_chanson_complete(source, fixture_html):
    song = source.parse_song_page(fixture_html("serasera_song.html"), SONG_URL, "2026-10-29T08:00:00+00:00")

    assert song.title == "Hira voalohany"
    assert (song.artist_slug, song.slug) == ("mpihira-voalohany", "hira-voalohany")
    assert song.artists == [
        ArtistRef("mpihira-voalohany", "MPIHIRA VOALOHANY"),
        ArtistRef("mpiara-mihira", "Mpiara-mihira"),
    ]
    assert song.lyrics == (
        "Andalana voalohany\n"
        "Andalana faharoa\n"
        "\n"
        "Ref: Fiverenany voalohany\n"
        "       Andalana misy elanelana\n"
        "\n"
        "Andalana farany"
    )
    assert song.views == 1209
    assert song.likes == 7
    assert song.contributor == "Mpampiditra"
    assert song.published_at == "2026-09-17T12:16:00+03:00"
    assert song.image_url == "https://tononkira.serasera.org/media/tononkira/o/sary.png"
    assert song.audio_url == "https://audio.example.org/15891.mp3"
    assert song.source == "serasera"
    assert song.scraped_at == "2026-10-29T08:00:00+00:00"


def test_page_de_chanson_sans_bloc_de_paroles_refusee(source):
    with pytest.raises(ValueError, match="Bloc des paroles introuvable"):
        source.parse_song_page("<html><body><div id='main'></div></body></html>", SONG_URL, "")


def test_url_de_chanson_invalide_refusee(source, fixture_html):
    with pytest.raises(ValueError, match="URL de chanson inattendue"):
        source.parse_song_page(fixture_html("serasera_song.html"), "https://x.org/autre", "")


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("17/09/2026 12:16", "2026-09-17T12:16:00+03:00"),
        ("Daty : 01/02/2020", "2020-02-01T00:00:00+03:00"),
        ("31/02/2020 10:00", None),
        ("", None),
        (None, None),
    ],
)
def test_parse_site_datetime(text, expected):
    assert parse_site_datetime(text) == expected


def test_song_path_parts():
    assert song_path_parts(SONG_URL) == ("mpihira-voalohany", "hira-voalohany")
    assert song_path_parts(SONG_URL + "/ankafizo") is None
    assert song_path_parts("https://tononkira.serasera.org/mpihira/magma") is None
