# tononkira — data

Collecte des paroles de chansons malagasy (Python ≥ 3.11). Sortie : un fichier JSONL,
une chanson par ligne, au format de [`contracts/song.example.json`](../contracts/song.example.json).

## Installation

```bash
python3 -m venv --copies .venv          # --copies : le disque NTFS gère mal les liens symboliques
.venv/bin/pip install -e '.[dev]'
.venv/bin/python -m pytest -q
```

## Commandes

```bash
.venv/bin/python -m tononkira_data crawl                 # tout : listes, paroles, export
.venv/bin/python -m tononkira_data crawl --from 9        # à partir de la page de liste 9
.venv/bin/python -m tononkira_data crawl --from 1 --to 2 --limit 40   # échantillon
.venv/bin/python -m tononkira_data crawl --songs-only --retry-errors  # reprendre les échecs
.venv/bin/python -m tononkira_data update                # nouveautés : s'arrête à la 1re page sans nouveauté
.venv/bin/python -m tononkira_data stats                 # avancement
.venv/bin/python -m tononkira_data export                # régénérer output/songs.jsonl
```

Options communes : `--delay` (secondes entre deux requêtes, défaut 1,5), `--state`
(base SQLite de reprise, défaut `output/state.sqlite3`), `--out` (JSONL), `-v`.

## Fonctionnement

1. **Listes** (`/hira?page=N`) : repère les chansons et lit la dernière page dans la
   pagination. Les pages déjà lues sont sautées à la reprise.
2. **Chansons** : chaque page est lue, analysée et enregistrée aussitôt dans SQLite
   (`pending` → `done` / `gone` (404) / `error`). Un `Ctrl+C` ne perd rien : relancer la
   même commande reprend.
3. **Export** : `output/songs.jsonl`, écrit dans un fichier temporaire puis renommé.

Le client HTTP respecte `robots.txt`, attend `--delay` secondes entre deux requêtes,
réessaie les 429/5xx avec une attente croissante (et `Retry-After`), et s'identifie
(`TononkiraBot/…`). Une collecte complète (~880 pages de liste, ~17 700 chansons) prend
environ 7 h 30 au délai par défaut.

## Ajouter une source

Écrire une classe qui respecte `sources/base.py` (`list_page_url`, `parse_list_page`,
`parse_song_page`), l'enregistrer dans `sources/__init__.py`, ajouter ses fixtures HTML
dans `tests/fixtures/` et ses tests. Elle devient disponible avec `--source <nom>`.

## À savoir sur la source serasera

- Le site insère dans chaque page de paroles des **mots pièges** aléatoires (ex. `olrdw`,
  `vyjpg`) et son nom de domaine, masqués à l'affichage par un script, pour repérer les
  copies de son contenu. La collecte les **conserve tels quels** : ce dépôt ne contient pas
  de code pour les retirer, ce qui reviendrait à contourner cette protection.
- Les paroles appartiennent à leurs auteurs et ont été saisies par les membres du site.
  Avant toute mise en ligne publique, obtenir l'accord de serasera.org (idéalement un
  export propre de leur part) ou utiliser une source autorisée.
- Les fixtures de test sont du HTML **synthétique** qui reproduit la structure du site,
  avec des paroles inventées : aucune parole réelle n'est versionnée.
