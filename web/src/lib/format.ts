const numberFormat = new Intl.NumberFormat('fr-FR');
const compactFormat = new Intl.NumberFormat('fr-FR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Indian/Antananarivo',
});

/** Espaces fines insécables de Intl remplacées par des espaces insécables simples (polices). */
const tidy = (text: string) => text.replace(/[  ]/g, ' ');

export function formatNumber(value: number): string {
  return tidy(numberFormat.format(value));
}

export function formatCount(value: number): string {
  return tidy(value >= 10_000 ? compactFormat.format(value) : numberFormat.format(value));
}

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date);
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count > 1 ? pluralForm : singular}`;
}

const SMALL_WORDS = new Set([
  'sy',
  'ny',
  'ary',
  'and',
  'et',
  'de',
  'feat',
  'ft',
  'the',
  'le',
  'la',
]);

/** Initiales d'un nom d'artiste : « Mamina sy Ravaka » → « MR ». */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter(Boolean);
  const significant = words.filter((word) => !SMALL_WORDS.has(word.toLowerCase()));
  const picked = (significant.length ? significant : words).slice(0, 2);
  return picked.map((word) => [...word][0]?.toUpperCase() ?? '').join('') || '♪';
}

/** Dégradés harmonisés avec la palette, choisis de façon stable selon le texte. */
const GRADIENTS: [string, string][] = [
  ['#c2552c', '#7a2e17'],
  ['#d08a2e', '#8a4f14'],
  ['#3f7d5f', '#1f4635'],
  ['#4b5e9a', '#283561'],
  ['#8d4a74', '#4f2442'],
  ['#2f7f86', '#17474c'],
  ['#a5653a', '#5d351b'],
  ['#b04a5a', '#64222f'],
];

export function gradientFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [from, to] = GRADIENTS[hash % GRADIENTS.length]!;
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function artistNames(artists: { name: string }[]): string {
  return artists.map((artist) => artist.name).join(', ');
}
