import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAVORITES_KEY, isFavorite, resetFavoritesStore, toggleFavorite } from './favorites';
import { readStorage } from './storage';
import { resolveTheme } from './theme';

const song = {
  artistSlug: 'magma',
  slug: 'potika',
  title: 'Potika',
  artists: [{ slug: 'magma', name: 'MAGMA' }],
};

describe('favoris', () => {
  beforeEach(() => resetFavoritesStore());

  it('ajoute puis retire une chanson et le garde en mémoire locale', () => {
    expect(toggleFavorite(song)).toBe(true);
    expect(isFavorite(song)).toBe(true);
    const stored = JSON.parse(window.localStorage.getItem(FAVORITES_KEY)!);
    expect(stored[0]).toMatchObject({ artistSlug: 'magma', slug: 'potika', title: 'Potika' });

    expect(toggleFavorite(song)).toBe(false);
    expect(isFavorite(song)).toBe(false);
  });

  it('ignore un contenu stocké corrompu', () => {
    window.localStorage.setItem(FAVORITES_KEY, '{pas du json');
    resetFavoritesStore();
    expect(isFavorite(song)).toBe(false);
  });
});

describe('stockage local indisponible', () => {
  afterEach(() => vi.restoreAllMocks());

  it('retombe sur la valeur par défaut sans lever', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqué', 'SecurityError');
    });
    expect(readStorage('cle', 'défaut')).toBe('défaut');
  });

  it("n'empêche pas d'ajouter un favori", () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('plein', 'QuotaExceededError');
    });
    expect(() => toggleFavorite({ ...song, slug: 'autre' })).not.toThrow();
  });
});

describe('resolveTheme', () => {
  it('suit le système seulement en mode « système »', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
