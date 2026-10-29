import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/** Même clé que le script de index.html qui applique le thème avant le rendu. */
export const THEME_KEY = 'tononkira-theme';

export const NEXT_THEME: Record<ThemePreference, ThemePreference> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#faf6ef', dark: '#14110e' };

function isPreference(value: string): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readPreference(): ThemePreference {
  const raw = readStorage<string>(THEME_KEY, 'system', (value) => value);
  return isPreference(raw) ? raw : 'system';
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

function prefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

// --- Petit store partagé : tous les boutons de thème restent synchronisés. ---

let current: ThemePreference = readPreference();
const listeners = new Set<() => void>();

function emit() {
  applyTheme(resolveTheme(current, prefersDark()));
  listeners.forEach((listener) => listener());
}

export function setThemePreference(preference: ThemePreference): void {
  current = preference;
  writeStorage(THEME_KEY, preference);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;
  const onSystemChange = () => current === 'system' && emit();
  media?.addEventListener('change', onSystemChange);
  return () => {
    listeners.delete(listener);
    media?.removeEventListener('change', onSystemChange);
  };
}

export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const preference = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'system' as const,
  );
  return [preference, setThemePreference];
}

/** Réservé aux tests : relit la préférence stockée. */
export function resetThemeStore(): void {
  current = readPreference();
}
