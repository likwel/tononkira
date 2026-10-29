"""Client HTTP « poli » : délai minimal entre deux requêtes, reprises avec attente
croissante, respect de `Retry-After` et de `robots.txt`."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from . import __version__

log = logging.getLogger(__name__)

DEFAULT_USER_AGENT = f"TononkiraBot/{__version__} (+collecte de paroles malagasy, usage non commercial)"
RETRY_STATUSES = {429, 500, 502, 503, 504}


class FetchError(RuntimeError):
    """La page n'a pas pu être récupérée après toutes les tentatives."""


class DisallowedByRobots(RuntimeError):
    """`robots.txt` interdit cette URL à notre User-Agent."""


class PoliteClient:
    def __init__(
        self,
        *,
        user_agent: str = DEFAULT_USER_AGENT,
        delay: float = 1.5,
        timeout: float = 30.0,
        max_retries: int = 4,
        respect_robots: bool = True,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.user_agent = user_agent
        self.delay = delay
        self.max_retries = max_retries
        self.respect_robots = respect_robots
        self._sleep = sleep
        self._clock = clock
        self._last_request_at: float | None = None
        self._robots: dict[str, RobotFileParser] = {}
        self._client = httpx.Client(
            headers={
                "User-Agent": user_agent,
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "mg,fr;q=0.8,en;q=0.5",
            },
            timeout=timeout,
            follow_redirects=True,
            transport=transport,
        )

    def __enter__(self) -> PoliteClient:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    def get_text(self, url: str) -> str | None:
        """Retourne le HTML de la page, ou `None` si elle n'existe pas (404/410)."""
        if self.respect_robots and not self._allowed(url):
            raise DisallowedByRobots(url)

        last_error: str = ""
        for attempt in range(self.max_retries + 1):
            self._wait_turn()
            try:
                response = self._client.get(url)
            except httpx.TransportError as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                self._backoff(attempt, None, last_error, url)
                continue

            if response.status_code in (404, 410):
                return None
            if response.status_code in RETRY_STATUSES:
                last_error = f"HTTP {response.status_code}"
                self._backoff(attempt, response.headers.get("Retry-After"), last_error, url)
                continue
            if response.is_error:
                raise FetchError(f"{url} : HTTP {response.status_code}")
            return response.text

        raise FetchError(f"{url} : abandon après {self.max_retries + 1} tentatives ({last_error})")

    def _wait_turn(self) -> None:
        now = self._clock()
        if self._last_request_at is not None:
            remaining = self.delay - (now - self._last_request_at)
            if remaining > 0:
                self._sleep(remaining)
        self._last_request_at = self._clock()

    def _backoff(self, attempt: int, retry_after: str | None, reason: str, url: str) -> None:
        if attempt >= self.max_retries:
            return
        wait = max(self.delay, 1.0) * (2**attempt)
        if retry_after and retry_after.isdigit():
            wait = max(wait, float(retry_after))
        wait = min(wait, 300.0)
        log.warning("%s — %s, nouvelle tentative dans %.0f s", url, reason, wait)
        self._sleep(wait)

    def _allowed(self, url: str) -> bool:
        parts = urlsplit(url)
        origin = f"{parts.scheme}://{parts.netloc}"
        parser = self._robots.get(origin)
        if parser is None:
            parser = RobotFileParser()
            try:
                response = self._client.get(f"{origin}/robots.txt")
                status, lines = response.status_code, response.text.splitlines()
            except httpx.TransportError:
                status, lines = 0, []
            # Même règle que RobotFileParser.read() : 401/403 = tout interdit.
            if status in (401, 403):
                parser.disallow_all = True
            else:
                parser.parse(lines if status == 200 else [])
            self._robots[origin] = parser
        return parser.can_fetch(self.user_agent, url)
