/** Classes partagées des boutons, pour garder un style homogène sans bibliothèque de composants. */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Retour tactile : léger enfoncement à l'appui, transitions sur l'ensemble des propriétés.
const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium transition duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60';

export const iconButton =
  'inline-grid size-10 shrink-0 place-items-center rounded-full text-ink-soft transition duration-200 hover:bg-surface-2 hover:text-ink active:scale-90';

export const buttonPrimary = `${buttonBase} bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink shadow-soft hover:-translate-y-px hover:shadow-glow hover:brightness-105`;

export const buttonSecondary = `${buttonBase} border border-line bg-surface px-4 py-2 text-sm text-ink-soft shadow-soft hover:border-accent/50 hover:text-ink`;

export const buttonGhost = `${buttonBase} px-4 py-2 text-sm text-ink-soft hover:bg-surface-2 hover:text-ink`;
