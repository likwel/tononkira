import { describe, expect, it } from 'vitest';
import { escapeLike, findExcerpt, sortKey } from '../src/lib/text.js';

describe('sortKey', () => {
  it('retire accents, ponctuation initiale et majuscules', () => {
    expect(sortKey("'Ndao hanala")).toBe('ndao hanala');
    expect(sortKey('Tanàna Mamiko')).toBe('tanana mamiko');
    expect(sortKey('« Ô ry Tompo »')).toBe('o ry tompo »');
    expect(sortKey('2 Gasy')).toBe('2 gasy');
  });
});

describe('escapeLike', () => {
  it('échappe les jokers SQL', () => {
    expect(escapeLike('100%_sur\\')).toBe('100\\%\\_sur\\\\');
    expect(escapeLike('tiako')).toBe('tiako');
  });
});

describe('findExcerpt', () => {
  const lyrics = 'Andalana voalohany\n   Tiako ianao, ry Fitiavana\nFarany';

  it('renvoie la ligne qui contient la recherche, sans tenir compte de la casse', () => {
    expect(findExcerpt(lyrics, 'TIAKO')).toBe('Tiako ianao, ry Fitiavana');
  });

  it('ignore les accents de la recherche', () => {
    expect(findExcerpt('Tanàna malalako', 'tanana')).toBe('Tanàna malalako');
  });

  it('renvoie null si rien ne correspond ou recherche vide', () => {
    expect(findExcerpt(lyrics, 'tsy misy')).toBeNull();
    expect(findExcerpt(lyrics, '   ')).toBeNull();
  });

  it('tronque les lignes trop longues', () => {
    const excerpt = findExcerpt(`tiako ${'a'.repeat(300)}`, 'tiako', 20);
    expect(excerpt).toHaveLength(20);
    expect(excerpt?.endsWith('…')).toBe(true);
  });
});
