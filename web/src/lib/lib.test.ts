import { describe, expect, it } from 'vitest';
import { formatCount, formatDate, formatNumber, gradientFor, initials, plural } from './format';
import { matchRanges } from './highlight';
import { isChorus, splitStanzas } from './lyrics';
import { pageItems } from './pagination';
import { pick, toLetter, toPage, withParams } from './params';

describe('pageItems', () => {
  it.each([
    [1, 1, [1]],
    [1, 4, [1, 2, 3, 4]],
    [3, 5, [1, 2, 3, 4, 5]],
    [7, 20, [1, 'ellipsis-start', 6, 7, 8, 'ellipsis-end', 20]],
    [1, 20, [1, 2, 'ellipsis-end', 20]],
    [20, 20, [1, 'ellipsis-start', 19, 20]],
    [4, 20, [1, 2, 3, 4, 5, 'ellipsis-end', 20]],
    [99, 5, [1, 'ellipsis-start', 4, 5]],
  ])('page %i sur %i', (page, total, expected) => {
    expect(pageItems(page, total)).toEqual(expected);
  });
});

describe('matchRanges', () => {
  it('ignore casse et accents, positions du texte original', () => {
    expect(matchRanges('Tanàna malalako', 'TANANA')).toEqual([[0, 6]]);
    expect(matchRanges('Tiako ianao, tiako', 'tiako')).toEqual([
      [0, 5],
      [13, 18],
    ]);
  });

  it('renvoie une liste vide sans recherche ni correspondance', () => {
    expect(matchRanges('Tiako', '  ')).toEqual([]);
    expect(matchRanges('Tiako', 'xyz')).toEqual([]);
  });
});

describe('lyrics', () => {
  it('découpe les strophes sur les lignes vides', () => {
    expect(splitStanzas('A\nB\n\n\nC\n  \nD')).toEqual([['A', 'B'], ['C'], ['D']]);
    expect(splitStanzas('')).toEqual([]);
  });

  it('reconnaît les refrains', () => {
    expect(isChorus(['Ref: Tiako ianao'])).toBe(true);
    expect(isChorus(['(Refrain) Tiako'])).toBe(true);
    expect(isChorus(['Fiverenany :'])).toBe(true);
    expect(isChorus(['Reference ve ?'])).toBe(false);
    expect(isChorus(['Tiako ianao'])).toBe(false);
  });
});

describe('format', () => {
  it('formate les nombres à la française', () => {
    expect(formatNumber(1209)).toBe('1 209');
    expect(formatCount(950)).toBe('950');
    expect(formatCount(12_345)).toMatch(/^12,3 k$/);
    expect(plural(1, 'chanson')).toBe('1 chanson');
    expect(plural(3, 'chanson')).toBe('3 chansons');
  });

  it("formate les dates à l'heure de Madagascar", () => {
    expect(formatDate('2026-09-17T21:30:00.000Z')).toBe('18 septembre 2026');
    expect(formatDate(null)).toBeNull();
    expect(formatDate('pas une date')).toBeNull();
  });

  it('calcule des initiales lisibles', () => {
    expect(initials('Mamina sy Ravaka')).toBe('MR');
    expect(initials('MAGMA')).toBe('M');
    expect(initials('Lion Hill, Ceasar, Ljo')).toBe('LH');
    expect(initials("'Ndao")).toBe('N');
    expect(initials('...')).toBe('♪');
  });

  it('choisit un dégradé stable', () => {
    expect(gradientFor('magma')).toBe(gradientFor('magma'));
    expect(gradientFor('magma')).toMatch(/^linear-gradient/);
  });
});

describe('params', () => {
  it('lit page, tri et lettre de façon tolérante', () => {
    expect(toPage('3')).toBe(3);
    expect(toPage('0')).toBe(1);
    expect(toPage('abc')).toBe(1);
    expect(toPage(null)).toBe(1);
    expect(pick('popular', ['recent', 'popular'] as const, 'recent')).toBe('popular');
    expect(pick('hack', ['recent', 'popular'] as const, 'recent')).toBe('recent');
    expect(toLetter('B')).toBe('b');
    expect(toLetter('bb')).toBeUndefined();
  });

  it('change un filtre en revenant à la page 1', () => {
    const current = new URLSearchParams('sort=popular&page=4&letter=a');
    expect(withParams(current, { letter: 'b' })).toBe('?sort=popular&letter=b');
    expect(withParams(current, { page: 5 })).toBe('?sort=popular&page=5&letter=a');
    expect(withParams(current, { page: 1 })).toBe('?sort=popular&letter=a');
    expect(withParams(new URLSearchParams('letter=a'), { letter: null })).toBe('?');
  });
});
