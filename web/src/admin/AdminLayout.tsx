import { ExternalLink, LogOut } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router';
import { Logo } from '../components/layout/Logo';
import { ThemeToggle } from '../components/ThemeToggle';
import { buttonGhost, cx, iconButton } from '../components/ui';
import { clearAdminToken, useAdminToken } from './auth';
import { LoginPage } from './pages/LoginPage';

const TABS = [
  { to: '/admin', label: "Vue d'ensemble", end: true },
  { to: '/admin/pages', label: 'Pages collectées', end: false },
  { to: '/admin/listes', label: 'Pages de liste', end: false },
  { to: '/admin/taches', label: 'Historique des tâches', end: false },
];

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'shrink-0 rounded-full px-3.5 py-2 text-sm font-medium whitespace-nowrap transition-colors',
    isActive ? 'bg-surface-2 text-ink' : 'text-ink-soft hover:text-ink',
  );

export function AdminLayout() {
  const token = useAdminToken();
  if (!token) return <LoginPage />;

  return (
    <div className="flex min-h-dvh flex-col">
      <title>Administration · Tononkira</title>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="container-page flex h-16 items-center gap-3">
          <Logo />
          <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-canvas uppercase">
            Admin
          </span>
          <nav aria-label="Administration" className="ml-4 hidden lg:block">
            <ul className="flex items-center gap-1">
              {TABS.map((tab) => (
                <li key={tab.to}>
                  <NavLink to={tab.to} end={tab.end} className={tabClass}>
                    {tab.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/" className={cx(buttonGhost, 'hidden sm:inline-flex')}>
              <ExternalLink className="size-4" aria-hidden="true" />
              Voir le site
            </Link>
            <ThemeToggle />
            <button
              type="button"
              onClick={clearAdminToken}
              className={iconButton}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <nav aria-label="Administration" className="border-t border-line/60 lg:hidden">
          <ul className="no-scrollbar container-page flex gap-1 overflow-x-auto py-2">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <NavLink to={tab.to} end={tab.end} className={tabClass}>
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="container-page flex-1 py-8 sm:py-10">
        <Outlet />
      </main>
    </div>
  );
}

export function AdminHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}
