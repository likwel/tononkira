#!/usr/bin/env node
/**
 * Attend que l'API écoute avant de démarrer Vite (npm run dev).
 *
 * Sans cette attente, Vite sert la page en une seconde alors que l'API démarre en
 * plusieurs (prisma generate, tsx, connexion à la base) : le premier chargement part
 * en « http proxy error … ECONNREFUSED » et l'accueil s'affiche en erreur.
 *
 * Un simple connect TCP suffit : l'API n'appelle app.listen() qu'après avoir joint la
 * base, donc un port qui accepte la connexion est un serveur qui répond. Pas de fetch
 * ici : sous Windows, un timer encore en vol au moment de quitter fait planter Node
 * (« Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) »).
 *
 * 127.0.0.1 plutôt que localhost : l'API écoute en IPv4, or localhost peut résoudre
 * d'abord vers ::1 et refuser la connexion.
 */
import { createConnection } from 'node:net';

const host = process.env.API_HOST ?? '127.0.0.1';
const port = Number(process.env.API_PORT ?? 4000);
const timeout = Number(process.env.API_WAIT_TIMEOUT ?? 90_000);
const deadline = Date.now() + timeout;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function listening() {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const settle = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => settle(true));
    socket.once('timeout', () => settle(false));
    socket.once('error', () => settle(false));
  });
}

let announced = false;
while (Date.now() < deadline) {
  if (await listening()) {
    console.log(`API joignable sur ${host}:${port} : démarrage du web.`);
    break;
  }
  if (!announced) {
    console.log(`En attente de l'API sur ${host}:${port}…`);
    announced = true;
  }
  await sleep(500);
}

if (Date.now() >= deadline) {
  console.error(
    `L'API n'a pas répondu en ${Math.round(timeout / 1000)} s (${host}:${port}).\n` +
      'Voir les lignes [api] au-dessus : base arrêtée, port 4000 déjà pris, ou erreur de démarrage.',
  );
  // process.exitCode plutôt que process.exit() : laisse Node fermer ses handles proprement.
  process.exitCode = 1;
}
