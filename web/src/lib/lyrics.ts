/** Strophes séparées par une ligne vide ; chaque strophe est une liste de lignes. */
export function splitStanzas(lyrics: string): string[][] {
  return lyrics
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((stanza) => stanza.split('\n').filter((line) => line.trim() !== ''))
    .filter((stanza) => stanza.length > 0);
}

const CHORUS = /^\s*[([]?\s*(ref(rain|ren)?|fiverenany|fiv|chorus|ch(œ|oe)ur)\b/i;

/** Strophe de refrain : sa première ligne commence par « Ref », « Refrain », « Fiverenany »… */
export function isChorus(stanza: string[]): boolean {
  return CHORUS.test(stanza[0] ?? '');
}
