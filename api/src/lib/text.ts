/** Clé de tri : sans accents, sans ponctuation initiale (« 'Ndao » → « ndao »), en minuscules. */
export function sortKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .toLowerCase()
    .trim();
}

/** Échappe les jokers de LIKE/ILIKE (`%`, `_`, `\`) d'une saisie utilisateur. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Première ligne des paroles qui contient la recherche (sans tenir compte de la casse ni des accents). */
export function findExcerpt(lyrics: string, query: string, maxLength = 140): string | null {
  const needle = fold(query.trim());
  if (!needle) return null;
  const line = lyrics.split('\n').find((candidate) => fold(candidate).includes(needle));
  if (!line) return null;
  const trimmed = line.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}
