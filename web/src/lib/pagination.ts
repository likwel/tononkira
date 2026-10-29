export type PageItem = number | 'ellipsis-start' | 'ellipsis-end';

/**
 * Pages à afficher : toujours la première et la dernière, la page courante et ses
 * voisines, et des points de suspension pour les trous de plus d'une page.
 * Ex. (7, 20) → [1, …, 6, 7, 8, …, 20].
 */
export function pageItems(current: number, total: number, siblings = 1): PageItem[] {
  if (total <= 1) return [1];
  const page = Math.min(Math.max(1, current), total);
  const start = Math.max(2, page - siblings);
  const end = Math.min(total - 1, page + siblings);

  const items: PageItem[] = [1];
  if (start === 3) items.push(2);
  else if (start > 3) items.push('ellipsis-start');
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end === total - 2) items.push(total - 1);
  else if (end < total - 2) items.push('ellipsis-end');
  items.push(total);
  return items;
}
