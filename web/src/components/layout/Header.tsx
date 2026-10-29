import { Search } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router';
import { SearchBox } from '../SearchBox';
import { ThemeToggle } from '../ThemeToggle';
import { cx, iconButton } from '../ui';
import { Logo } from './Logo';
import { NAV_ITEMS } from './nav';

export function Header() {
  const { pathname } = useLocation();
  // L'accueil et la page de recherche ont déjà un grand champ de recherche.
  const showSearch = pathname !== '/' && pathname !== '/karoka';

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-md print:hidden">
      <div className="container-page flex h-16 items-center gap-3">
        <Logo />
        <nav aria-label="Navigation principale" className="ml-6 hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cx(
                      'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-surface-2 text-ink' : 'text-ink-soft hover:text-ink',
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
