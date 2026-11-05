import { NavLink } from 'react-router';
import { cx } from '../ui';
import { NAV_ITEMS } from './nav';

/** Barre d'onglets en bas d'écran, sur mobile uniquement. */
export function MobileNav() {
  return (
    <nav
      aria-label="Navigation"
      style={{ viewTransitionName: 'site-nav' }}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden print:hidden"
    >
      <ul className="grid grid-cols-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              viewTransition
              className={({ isActive }) =>
                cx(
                  'flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-accent' : 'text-muted hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {/* Pastille de l'onglet actif : s'élargit avec un léger rebond. */}
                  <span
                    className={cx(
                      'grid h-8 place-items-center rounded-full transition-all duration-300 ease-[var(--ease-spring)]',
                      isActive ? 'w-14 bg-accent-soft' : 'w-8',
                    )}
                  >
                    <Icon
                      className="size-[22px]"
                      strokeWidth={isActive ? 2.25 : 1.75}
                      aria-hidden="true"
                    />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
