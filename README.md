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

Prérequis : Node ≥ 22.12 (`.nvmrc` : 24), Python ≥ 3.11, Docker. Les mêmes commandes
fonctionnent sous **Linux, macOS et Windows** (PowerShell ou cmd) : les scripts `data:*`
passent par `scripts/data.mjs`, qui trouve Python (`py -3`, `python` ou `python3`) et le
venv (`.venv/bin` ou `.venv\Scripts`).

```bash
npm install                      # api + web (génère aussi le client Prisma)
npm run data:setup               # environnement Python de data/ (data/.venv)
cp api/.env.example api/.env     # Windows : copy api\.env.example api\.env

npm run db:up                    # PostgreSQL dans Docker, port 5434
npm run db:migrate               # crée les tables et les index de recherche

npm run data:crawl -- --from 1 --to 2 --limit 40   # petit échantillon (~1 min)
npm run db:import                # importe data/output/songs.jsonl

npm run dev                      # API http://localhost:4000/api + web http://localhost:5173
```

Collecte complète : `npm run data:crawl` (environ 7 h 30 au délai poli de 1,5 s par
requête, reprise automatique si interrompue), puis `npm run db:import`. Pour partir d'une
page donnée : `npm run data:crawl -- --from 9`. Mise à jour ensuite : `npm run data:update`
puis `npm run db:import` (l'import est idempotent), ou le bouton **Mettre à jour** de
l'administration.

### Dépannage

| Symptôme | Cause | Remède |
|---|---|---|
| L'API refuse de démarrer : « Client Prisma périmé » | le schéma a gagné un modèle (après un `git pull`) | `npm run db:generate -w api` (fait automatiquement par `npm run dev`) |
| 503 « La base de données n'est pas à jour » | migration non appliquée | `npm run db:migrate` |
| 503 « Base de données injoignable » | PostgreSQL arrêté ou `DATABASE_URL` erronée | `npm run db:up`, vérifier `api/.env` |
| 502 « API injoignable » dans le navigateur | l'API n'est pas lancée | `npm run dev` (l'API écoute sur 4000) |
| 503 « Python introuvable » dans l'administration | venv absent | `npm run data:setup`, ou `PYTHON_BIN` dans `api/.env` |

En développement (`NODE_ENV=development`), une erreur 500 inattendue joint sa cause
(`error.debug`) à la réponse ; en production, elle reste masquée et seulement journalisée.
Le proxy de Vite vise `http://127.0.0.1:4000` (et non `localhost`, qui se résout en IPv6
`::1` sous Windows alors que l'API écoute en IPv4) ; autre cible : `API_PROXY_TARGET`.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | API (tsx) + web (Vite, qui relaie `/api` vers le port 4000) |
| `npm test` | tests API (Vitest + Supertest), web (Vitest + Testing Library), data (pytest) |
| `npm run typecheck` / `npm run build` | vérification TypeScript / build de production |
| `npm run db:up` / `db:down` | démarrer / arrêter PostgreSQL |
| `npm run db:migrate` | appliquer les migrations Prisma (dev) ; en prod : `npm run db:deploy -w api` |
| `npm run db:import [-- fichier.jsonl]` | importer le JSONL (défaut `data/output/songs.jsonl`) : mise à jour par URL source, rien n'est supprimé, les chansons inchangées sont sautées |
| `npm run test:integration -w api` | tests avec PostgreSQL (base `tononkira_test`, créée au besoin) |
| `npm run data:crawl [-- options]` / `data:update` / `data:stats` / `data:export` / `data:test` | collecte (voir [data/README.md](data/README.md)) |

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

## Administration (`/admin`)

Accès par jeton : définir `ADMIN_TOKEN` (24 caractères ou plus) dans `api/.env`, puis
le saisir sur `/admin`. Sans jeton, `/api/admin` répond 503 ; après 20 jetons faux en
15 minutes, il répond 429.

- **Mettre à jour** (en-tête, sur toutes les pages) : un clic cherche les nouvelles
  chansons sur la source puis met la base à jour. Le menu propose aussi « Réimporter
  toutes les données » (réécrit chaque chanson collectée, même inchangée, sans rien
  supprimer), « Importer les changements » et « Revérifier 100 pages ». Pendant une tâche,
  le bouton affiche sa progression.
- **Vue d'ensemble** : chansons en base, pages collectées, en attente, en erreur, pages
  de liste lues ; tâche en cours avec progression et journal en direct, bouton Arrêter.
- **Lancer une tâche** : collecte (de la page X à Y, nombre de chansons, délai entre
  requêtes), nouveautés (depuis la page 1 jusqu'à une page sans nouveauté),
  revérification des pages déjà collectées, import seul (option « réimport complet »).
  Import en base à la fin.
- **Pages collectées** : historique de chaque page (statut, date de la version
  enregistrée, dernière vérification), recherche, filtres, tri « modifiées
  récemment » / « à revérifier ». Bouton **Vérifier** par page : relit la page, signale
  ce qui a changé (titre, paroles, artistes…) et met la base à jour. Bouton
  « Revérifier 100 pages » pour un lot.
- **Pages de liste** : pages lues, relecture d'une page pour repérer de nouvelles chansons.
- **Historique des tâches** : paramètres, résultat et journal de chaque tâche.

Détection des modifications : la source glisse dans chaque page quelques mots
aléatoires différents à chaque chargement ; une page dont la structure (strophes,
lignes) est identique et qui diffère de 4 mots ou moins est donc considérée comme
inchangée, et ses paroles enregistrées ne sont pas réécrites.

## Interface web

Routes en malagasy : `/hira` (chansons), `/hira/:artiste/:chanson`, `/mpihira`
(artistes), `/mpihira/:artiste`, `/karoka` (recherche), `/ankafizina` (favoris).

- **Mode lecture** pour chanter : plein écran, grand texte, défilement automatique à
  5 vitesses (Espace pour lancer ou arrêter, toucher le texte pour mettre en pause),
  écran maintenu allumé, Échap pour sortir.
- Accueil : « Reprendre la lecture » (dernières chansons vues sur l'appareil),
  palmarès, abécédaire A–Z, ajouts récents, artistes.
- Raccourci `/` : place le curseur dans la recherche.

- Recherche avec suggestions au fil de la frappe (clavier ↑ ↓ Entrée Échap), surlignage
  insensible aux accents, extrait des paroles dans les résultats.
- Page de paroles : strophes et refrains mis en forme, retrait suspendu pour les vers
  longs sur mobile, taille du texte réglable (mémorisée), copie, partage natif,
  impression propre, extrait audio s'il existe.
- Favoris sans compte (stockés dans le navigateur, synchronisés entre onglets).
- Mobile : barre d'onglets en bas, zones tactiles de 40 px, encoches gérées
  (`safe-area-inset`). Bureau : navigation et recherche dans l'en-tête.
- Thème clair / sombre / système appliqué avant le premier rendu (pas de flash) ;
  palette « Flamboyant & Lagon » (vermillon, bleu lagon, mangue ; nuit prune en sombre).
- Typographie auto-hébergée : Bricolage Grotesque (titres), Figtree (interface),
  Newsreader (paroles).
- Mouvement : transitions de page (le titre d'une chanson glisse de la carte vers sa
  page), thème qui s'ouvre en cercle depuis le bouton, apparitions en cascade et au
  défilement, égaliseur animé, barre d'outils collante qui reprend le titre. Tout est
  coupé si le système demande moins d'animations.
- Vignettes générées (initiales sur dégradé) : aucune image n'est chargée depuis le site
  source.

## Données et droits

Les paroles appartiennent à leurs auteurs ; celles de la source actuelle ont été saisies
par les membres de tononkira.serasera.org. Ce site insère des **mots pièges** dans ses
pages de paroles pour repérer les copies ; la collecte les conserve et ce dépôt ne les
retire pas (détails dans [data/README.md](data/README.md)). **Avant une mise en ligne
publique**, obtenir l'accord de serasera.org ou s'appuyer sur une source autorisée.
