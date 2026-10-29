/**
 * Accès à localStorage qui ne casse jamais la page : navigation privée, stockage
 * bloqué ou plein → on retombe sur la valeur par défaut.
 */
export function readStorage<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T = JSON.parse,
): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // Préférence perdue au rechargement, sans gravité.
  }
}
