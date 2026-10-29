from tononkira_data.compare import compare_songs, lyrics_changed

LYRICS = "Tiako ianao fa tsy fantatrao\nMba lazao izay ao am-ponao\n\nRef: Tiako ianao\nMandrakizay"


def test_quelques_mots_inseres_ne_sont_pas_une_modification():
    # Même page relue : la source y a glissé des mots différents à chaque chargement.
    first = LYRICS.replace("fa tsy", "fa abcde tsy").replace("izay", "fghij izay")
    second = LYRICS.replace("Mba lazao", "Mba klmno lazao").replace("Ref:", "Ref: pqrst")
    assert lyrics_changed(first, second) is False


def test_ligne_ajoutee_ou_strophe_deplacee_est_une_modification():
    assert lyrics_changed(LYRICS, LYRICS + "\nAndalana vaovao") is True
    assert lyrics_changed(LYRICS, LYRICS.replace("\n\n", "\n")) is True


def test_correction_de_plusieurs_mots_est_une_modification():
    corrected = LYRICS.replace("Tiako ianao fa tsy fantatrao", "Tia anao aho nefa tsy hainao")
    assert lyrics_changed(LYRICS, corrected) is True


def test_compare_separe_contenu_et_statistiques():
    old = {"title": "Hira", "artists": [{"slug": "a", "name": "A"}], "lyrics": LYRICS, "views": 10, "likes": 0}
    same_content = {**old, "views": 12}
    assert compare_songs(old, same_content).content == []
    assert compare_songs(old, same_content).stats == ["vues"]

    renamed = {**old, "title": "Hira vaovao", "artists": [{"slug": "b", "name": "B"}]}
    assert compare_songs(old, renamed).content == ["titre", "artistes"]
