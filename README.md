# Tononkira

Paroles de chansons malagasy : collecte des données, API REST et interface web
responsive (clair / sombre), dans un monorepo.

```
tononkira.serasera.org ─► data (Python) ─► songs.jsonl ─► api: import (Prisma) ─► PostgreSQL
                                                                                      │
                                     web (React) ◄──── /api ──── api (Express) ◄──────┘
```

| Dossier | Rôle | Technologies |
|---|---|---|
| [`data/`](data/) | collecte (scraper poli, reprise après interruption), export JSONL | Python 3.11+, httpx, BeautifulSoup/lxml, SQLite |
| [`api/`](api/) | API REST en lecture, import du JSONL, recherche plein texte | Node 22+, Express 5, TypeScript, Prisma 7, PostgreSQL 18 (`pg_trgm`), Zod |
| [`web/`](web/) | interface web mobile d'abord, thème clair/sombre/système | React 19, TypeScript, Vite 7, Tailwind CSS 4, TanStack Query, React Router 7 |
| [`contracts/`](contracts/) | format d'échange `data` → `api`, lu par les tests des deux côtés | JSON |

Les trois briques sont indépendantes (chacune a ses dépendances, ses tests et son
README) et peuvent être séparées en trois dépôts plus tard ; le monorepo (workspaces
npm) les lance ensemble.

## Démarrage

Prérequis : Node ≥ 22.12 (`.nvmrc` : 24), Python ≥ 3.11, Docker.

```bash
npm install                      # api + web (génère aussi le client Prisma)
npm run data:setup               # environnement Python de data/
cp api/.env.example api/.env

npm run db:up                    # PostgreSQL dans Docker, port 5434
npm run db:migrate               # crée les tables et les index de recherche

npm run data:crawl -- --from 1 --to 2 --limit 40   # petit échantillon (~1 min)
npm run db:import                # importe data/output/songs.jsonl

npm run dev                      # API http://localhost:4000/api + web http://localhost:5173
```

Collecte complète : `npm run data:crawl` (environ 7 h 30 au délai poli de 1,5 s par
requête, reprise automatique si interrompue), puis `npm run db:import`. Pour partir d'une
page donnée : `npm run data:crawl -- --from 9`. Mise à jour ensuite : `cd data &&
.venv/bin/python -m tononkira_data update && cd .. && npm run db:import` (l'import est
idempotent).

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | API (tsx) + web (Vite, qui relaie `/api` vers le port 4000) |
| `npm test` | tests API (Vitest + Supertest), web (Vitest + Testing Library), data (pytest) |
| `npm run typecheck` / `npm run build` | vérification TypeScript / build de production |
| `npm run db:up` / `db:down` | démarrer / arrêter PostgreSQL |
| `npm run db:migrate` | appliquer les migrations Prisma (dev) ; en prod : `npm run db:deploy -w api` |
| `npm run db:import [-- fichier.jsonl]` | importer le JSONL (défaut `data/output/songs.jsonl`) |
| `npm run data:crawl [-- options]` / `data:stats` / `data:export` | collecte (voir [data/README.md](data/README.md)) |

## API

Toutes les réponses sont en JSON : `{ data, meta? }`, ou `{ error: { code, message, details? } }`.

| Route | Paramètres | Réponse |
|---|---|---|
| `GET /api/health` | | `{ status: "ok" }` ou 503 si la base ne répond pas |
| `GET /api/stats` | | nombres de chansons, d'artistes, date du dernier ajout |
| `GET /api/songs` | `page`, `limit` (≤ 100), `sort` = `recent` \| `popular` \| `title`, `letter` | liste paginée |
| `GET /api/songs/random` | | une chanson au hasard |
| `GET /api/songs/:artistSlug/:slug` | | paroles, artistes, source, 8 chansons liées |
| `GET /api/artists` | `page`, `limit`, `sort` = `name` \| `songs`, `letter`, `q` | liste paginée avec nombre de chansons |
| `GET /api/artists/:slug` | | fiche artiste et toutes ses chansons |
| `GET /api/search` | `q` (≥ 2 caractères), `page`, `limit` | chansons (titre, artiste ou paroles, avec extrait) et artistes |

Recherche : `ILIKE` accéléré par des index GIN trigrammes (`pg_trgm`), classement
titre qui commence par la recherche › titre qui la contient › ressemblance › popularité.
Sécurité : Helmet, CORS limité à `CORS_ORIGIN`, 300 requêtes/min/IP, paramètres validés
par Zod, erreurs internes masquées, `Cache-Control` court sur les lectures (jamais sur
les erreurs).

## Interface web

Routes en malagasy : `/hira` (chansons), `/hira/:artiste/:chanson`, `/mpihira`
(artistes), `/mpihira/:artiste`, `/karoka` (recherche), `/ankafizina` (favoris).

- Recherche avec suggestions au fil de la frappe (clavier ↑ ↓ Entrée Échap), surlignage
  insensible aux accents, extrait des paroles dans les résultats.
- Page de paroles : strophes et refrains mis en forme, retrait suspendu pour les vers
  longs sur mobile, taille du texte réglable (mémorisée), copie, partage natif,
  impression propre, extrait audio s'il existe, lien vers la page d'origine.
- Favoris sans compte (stockés dans le navigateur, synchronisés entre onglets).
- Mobile : barre d'onglets en bas, zones tactiles de 40 px, encoches gérées
  (`safe-area-inset`). Bureau : navigation et recherche dans l'en-tête.
- Thème clair / sombre / système appliqué avant le premier rendu (pas de flash),
  palette « latérite et ravinala », polices Fraunces et Inter auto-hébergées.
- Vignettes générées (initiales sur dégradé) : aucune image n'est chargée depuis le site
  source.

## Données et droits

Les paroles appartiennent à leurs auteurs ; celles de la source actuelle ont été saisies
par les membres de tononkira.serasera.org. Ce site insère des **mots pièges** dans ses
pages de paroles pour repérer les copies ; la collecte les conserve et ce dépôt ne les
retire pas (détails dans [data/README.md](data/README.md)). **Avant une mise en ligne
publique**, obtenir l'accord de serasera.org ou s'appuyer sur une source autorisée ;
l'interface affiche déjà la source et le lien d'origine sur chaque chanson.
