from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures"
CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


@pytest.fixture
def fixture_html():
    def read(name: str) -> str:
        return (FIXTURES / name).read_text(encoding="utf-8")

    return read
