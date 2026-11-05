import { Search } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router';
import { useScrolled } from '../../hooks/motion';
import { SearchBox } from '../SearchBox';
import { ThemeToggle } from '../ThemeToggle';
import { cx, iconButton } from '../ui';
import { Logo } from './Logo';
import { NAV_ITEMS } from './nav';

export function Header() {
  const { pathname } = useLocation();
  const scrolled = useScrolled();
  // L'accueil et la page de recherche ont déjà un grand champ de recherche.
  const showSearch = pathname !== '/' && pathname !== '/karoka';

  return (
    <header
      // Nom de transition propre : l'en-tête reste en place pendant les changements de page.
      style={{ viewTransitionName: 'site-header' }}
      className={cx(
        'sticky top-0 z-40 border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 print:hidden',
        scrolled ? 'border-line/80 bg-canvas/85 shadow-soft' : 'border-transparent bg-canvas/60',
      )}
    >
      <div className="container-page flex h-16 items-center gap-3">
        <Logo />
        <nav aria-label="Navigation principale" className="ml-6 hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  viewTransition
                  className={({ isActive }) =>
                    cx(
                      'relative rounded-full px-3.5 py-2 text-sm font-medium transition duration-200',
                      isActive
                        ? 'bg-ink text-canvas shadow-soft'
                        : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          {showSearch && <SearchBox className="hidden w-60 md:block lg:w-80" clearOnNavigate />}
          <Link to="/karoka" className={cx(iconButton, 'md:hidden')} aria-label="Rechercher">
            <Search className="size-5" aria-hidden="true" />
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
