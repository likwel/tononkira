import { useSyncExternalStore } from 'react';

/**
 * Jeton d'administration gardé pour la session de l'onglet (sessionStorage) : il
 * disparaît à la fermeture du navigateur. Il n'est jamais intégré au code du site.
 */
const KEY = 'tononkira-admin-token';

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

let token: string | null = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getAdminToken(): string | null {
  return token;
}

export function setAdminToken(value: string): void {
  token = value;
  try {
    window.sessionStorage.setItem(KEY, value);
  } catch {
    // Session non mémorisée : il faudra ressaisir le jeton au rechargement.
  }
  emit();
}

export function clearAdminToken(): void {
  token = null;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Rien à nettoyer.
  }
  emit();
}

export function useAdminToken(): string | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => token,
    () => null,
  );
}
