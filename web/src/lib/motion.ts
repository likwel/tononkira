import { flushSync } from 'react-dom';

export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Change le thème dans une View Transition : la nouvelle palette s'ouvre en cercle depuis
 * `origin` (le bouton cliqué). Sans prise en charge du navigateur, ou si l'utilisateur a
 * demandé moins d'animations, le changement est immédiat.
 */
export function revealThemeChange(update: () => void, origin?: { x: number; y: number }): void {
  const doc = document as ViewTransitionDocument;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    update();
    return;
  }
  const root = document.documentElement;
  if (origin) {
    const radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y),
    );
    root.style.setProperty('--vt-x', `${origin.x}px`);
    root.style.setProperty('--vt-y', `${origin.y}px`);
    root.style.setProperty('--vt-r', `${radius}px`);
  }
  root.classList.add('theme-transition');
  const transition = doc.startViewTransition(() => flushSync(update));
  void transition.finished.finally(() => root.classList.remove('theme-transition'));
}
