# Contrats entre les briques

`data` produit un fichier JSONL (une chanson par ligne) que `api` importe dans PostgreSQL.
[`song.example.json`](song.example.json) est la forme de référence d'une ligne :

| Champ | Type | Remarque |
|---|---|---|
| `source` | texte | identifiant de la source (`serasera`) |
| `source_url` | URL | unique — clé d'import idempotent |
| `artist_slug`, `slug` | texte | forment l'URL `/hira/:artist_slug/:slug` |
| `title` | texte | |
| `artists` | liste `{slug, name}` | au moins un, le premier est l'artiste principal |
| `lyrics` | texte | lignes séparées par `\n`, strophes par une ligne vide |
| `views`, `likes` | entier ≥ 0 | |
| `contributor` | texte ou `null` | pseudo de la personne qui a saisi les paroles |
| `published_at` | ISO 8601 ou `null` | avec fuseau (`+03:00` pour Madagascar) |
| `image_url`, `audio_url` | URL ou `null` | |
| `scraped_at` | ISO 8601 | date de collecte |

Tout changement de forme se fait **des deux côtés en même temps** : les tests
`data/tests/test_contract.py` et `api/tests/song-line.test.ts` lisent ce fichier.
