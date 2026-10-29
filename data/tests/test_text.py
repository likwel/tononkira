from bs4 import BeautifulSoup

from tononkira_data.text import clean_inline, first_int, lyrics_from_html, normalize_lyrics


def test_br_devient_saut_de_ligne_et_strophes_conservees():
    node = BeautifulSoup("<div>A<br/>B<br/><br/>C</div>", "lxml").div
    assert lyrics_from_html(node) == "A\nB\n\nC"


def test_mise_en_forme_du_code_source_ignoree():
    html = "<div>\n            Andalana 1<br />\nAndalana 2<br />\n   Ref<br />\n   </div>"
    node = BeautifulSoup(html, "lxml").div
    assert lyrics_from_html(node) == "Andalana 1\nAndalana 2\n   Ref"


def test_lignes_vides_multiples_reduites_a_une():
    assert normalize_lyrics("A\n\n\n\n\nB") == "A\n\nB"


def test_indentation_de_debut_de_ligne_conservee_et_plafonnee():
    assert normalize_lyrics("   Ref") == "   Ref"
    assert normalize_lyrics(" " * 20 + "Ref") == " " * 8 + "Ref"


def test_espaces_internes_reduits_et_fin_de_ligne_nettoyee():
    assert normalize_lyrics("Tiako   ianao   ") == "Tiako ianao"


def test_commentaires_html_ignores():
    node = BeautifulSoup("<div>A<!-- caché --><br/>B</div>", "lxml").div
    assert lyrics_from_html(node) == "A\nB"


def test_clean_inline_et_first_int():
    assert clean_inline("  Hira\n  voalohany ") == "Hira voalohany"
    assert first_int("Vangy : 1 209") == 1209
    assert first_int("aucun chiffre") is None
