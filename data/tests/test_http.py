import httpx
import pytest

from tononkira_data.http import DisallowedByRobots, FetchError, PoliteClient


class FakeTime:
    def __init__(self):
        self.now = 0.0
        self.sleeps: list[float] = []

    def clock(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def make_client(handler, **kwargs) -> tuple[PoliteClient, FakeTime]:
    fake = FakeTime()
    client = PoliteClient(
        transport=httpx.MockTransport(handler),
        sleep=fake.sleep,
        clock=fake.clock,
        **kwargs,
    )
    return client, fake


def robots_then(handler, robots: str = "User-agent: *\nDisallow:\n"):
    def wrapped(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=robots)
        return handler(request)

    return wrapped


def test_delai_minimum_entre_deux_requetes():
    client, fake = make_client(robots_then(lambda r: httpx.Response(200, text="ok")), delay=2.0)

    assert client.get_text("https://site.org/a") == "ok"
    assert client.get_text("https://site.org/b") == "ok"

    assert fake.sleeps == [2.0]


def test_404_retourne_none_sans_reessayer():
    calls = []

    def handler(request):
        calls.append(request.url.path)
        return httpx.Response(404)

    client, _ = make_client(robots_then(handler), delay=0)
    assert client.get_text("https://site.org/absent") is None
    assert calls == ["/absent"]


def test_reprise_sur_503_avec_retry_after():
    responses = iter([httpx.Response(503, headers={"Retry-After": "30"}), httpx.Response(200, text="ok")])
    client, fake = make_client(robots_then(lambda r: next(responses)), delay=1.0)

    assert client.get_text("https://site.org/a") == "ok"
    assert 30.0 in fake.sleeps


def test_abandon_apres_toutes_les_tentatives():
    client, _ = make_client(robots_then(lambda r: httpx.Response(500)), delay=0, max_retries=2)
    with pytest.raises(FetchError, match="3 tentatives"):
        client.get_text("https://site.org/a")


def test_erreur_client_non_reessayee():
    client, _ = make_client(robots_then(lambda r: httpx.Response(403)), delay=0)
    with pytest.raises(FetchError, match="HTTP 403"):
        client.get_text("https://site.org/a")


def test_robots_txt_respecte():
    robots = "User-agent: *\nDisallow: /prive\n"
    client, _ = make_client(robots_then(lambda r: httpx.Response(200, text="ok"), robots), delay=0)

    assert client.get_text("https://site.org/public") == "ok"
    with pytest.raises(DisallowedByRobots):
        client.get_text("https://site.org/prive/page")
