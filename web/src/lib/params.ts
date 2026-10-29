/** Lecture et écriture des filtres gardés dans l'URL (pages partageables). */

export function toPage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function pick<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

export function toLetter(raw: string | null): string | undefined {
  return raw && /^[a-z]$/i.test(raw) ? raw.toLowerCase() : undefined;
}

/**
 * Nouvelle query string à partir de l'actuelle. `null` retire le paramètre ; tout
 * changement de filtre ramène à la page 1, sauf si `page` est lui-même modifié.
 */
export function withParams(
  current: URLSearchParams,
  changes: Record<string, string | number | null>,
): string {
  const next = new URLSearchParams(current);
  if (!('page' in changes)) next.delete('page');
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === '' || (key === 'page' && value === 1)) next.delete(key);
    else next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `?${query}` : '?';
}
