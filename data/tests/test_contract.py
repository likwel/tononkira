"""La sortie JSONL doit garder la forme attendue par l'API (contracts/song.example.json)."""

import json

from conftest import CONTRACTS
from tononkira_data.export import export_jsonl
from tononkira_data.models import SongRef
from tononkira_data.sources.serasera import SeraseraSource
from tononkira_data.state import CrawlState

SONG_URL = "https://tononkira.serasera.org/hira/mpihira-voalohany/hira-voalohany"


def contract_keys() -> set[str]:
    return set(json.loads((CONTRACTS / "song.example.json").read_text(encoding="utf-8")))


def test_chanson_exportee_conforme_au_contrat(tmp_path, fixture_html):
    song = SeraseraSource().parse_song_page(fixture_html("serasera_song.html"), SONG_URL, "T")
    state = CrawlState(":memory:")
    state.add_refs("serasera", [SongRef(SONG_URL, "mpihira-voalohany", "hira-voalohany", "x")])
    state.save_song(SONG_URL, song.to_dict())

    out = tmp_path / "songs.jsonl"
    assert export_jsonl(state, out) == 1

    line = json.loads(out.read_text(encoding="utf-8").splitlines()[0])
    assert set(line) == contract_keys()
    assert set(line["artists"][0]) == {"slug", "name"}
    assert not (tmp_path / "songs.jsonl.tmp").exists()


def test_schema_sqlite_identique_au_contrat_lu_par_l_api():
    import re

    from tononkira_data.state import SCHEMA

    def normalize(sql: str) -> str:
        sql = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
        return re.sub(r"\s+", " ", sql).strip()

    contract = (CONTRACTS / "crawl-state.sql").read_text(encoding="utf-8")
    assert normalize(SCHEMA) == normalize(contract)
