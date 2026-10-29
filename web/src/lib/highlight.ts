const foldChar = (char: string) => char.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Positions [début, fin[ de la recherche dans le texte, sans tenir compte de la casse
 * ni des accents (« tanana » trouve « Tanàna »). Les positions sont celles du texte d'origine.
 */
export function matchRanges(text: string, query: string): [number, number][] {
  const needle = [...query.trim()].map(foldChar).join('');
  if (!needle) return [];

  let folded = '';
  const origin: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    for (const char of foldChar(text[i]!)) {
      folded += char;
      origin.push(i);
    }
  }

  const ranges: [number, number][] = [];
  let index = folded.indexOf(needle);
  while (index !== -1) {
    ranges.push([origin[index]!, origin[index + needle.length - 1]! + 1]);
    index = folded.indexOf(needle, index + needle.length);
  }
  return ranges;
}
