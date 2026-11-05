/** Comparaison ligne à ligne de deux textes de paroles (plus longue sous-suite commune). */

export type DiffLine =
  | { type: 'same' | 'added' | 'removed'; text: string }
  /** Suite de lignes identiques masquée pour ne montrer que ce qui change. */
  | { type: 'gap'; count: number };

const split = (text: string) => text.replace(/\r\n/g, '\n').split('\n');

export function diffLines(before: string, after: string): DiffLine[] {
  const a = split(before);
  const b = split(after);
  // lcs[i][j] : longueur de la plus longue sous-suite commune de a[i…] et b[j…].
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: 'same', text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      lines.push({ type: 'removed', text: a[i]! });
      i++;
    } else {
      lines.push({ type: 'added', text: b[j]! });
      j++;
    }
  }
  while (i < a.length) lines.push({ type: 'removed', text: a[i++]! });
  while (j < b.length) lines.push({ type: 'added', text: b[j++]! });
  return lines;
}

/** Remplace les longues suites inchangées par un repère, en gardant `context` lignes autour. */
export function collapseUnchanged(lines: DiffLine[], context = 2): DiffLine[] {
  const keep = lines.map((line) => line.type !== 'same');
  lines.forEach((line, index) => {
    if (line.type === 'same') return;
    for (let offset = -context; offset <= context; offset++) {
      const neighbour = index + offset;
      if (neighbour >= 0 && neighbour < lines.length) keep[neighbour] = true;
    }
  });

  const out: DiffLine[] = [];
  let hidden = 0;
  lines.forEach((line, index) => {
    if (keep[index]) {
      if (hidden > 0) {
        out.push({ type: 'gap', count: hidden });
        hidden = 0;
      }
      out.push(line);
    } else {
      hidden++;
    }
  });
  if (hidden > 0) out.push({ type: 'gap', count: hidden });
  return out;
}

export function countChanges(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((line) => line.type === 'added').length,
    removed: lines.filter((line) => line.type === 'removed').length,
  };
}
