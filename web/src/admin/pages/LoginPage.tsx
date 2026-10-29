import { KeyRound, LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ThemeToggle } from '../../components/ThemeToggle';
import { buttonPrimary, cx } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { adminApi } from '../api';
import { setAdminToken } from '../auth';

export function LoginPage() {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = token.trim();
    if (!value) return;
    setPending(true);
    setError(null);
    try {
      await adminApi.checkToken(value);
      setAdminToken(value);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Connexion impossible.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-12">
      <title>Connexion · Administration Tononkira</title>
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-3xl border border-line bg-surface p-7 shadow-lift"
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <KeyRound className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight">Administration</h1>
        <p className="mt-2 text-sm text-muted">
          Saisissez le jeton défini dans <code className="text-ink-soft">ADMIN_TOKEN</code> (fichier{' '}
          <code className="text-ink-soft">api/.env</code>).
        </p>
        <label htmlFor="admin-token" className="mt-6 mb-1.5 block text-sm font-medium text-ink-soft">
          Jeton d'administration
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="current-password"
          autoFocus
          value={token}
          onChange={(event) => setToken(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'admin-token-error' : undefined}
          className="h-11 w-full rounded-xl border border-line bg-canvas px-3.5 shadow-inner focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none"
        />
        {error && (
          <p id="admin-token-error" role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending || !token.trim()} className={cx(buttonPrimary, 'mt-6 w-full')}>
          {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />}
          Se connecter
        </button>
        <Link to="/" className="mt-5 block text-center text-sm text-muted hover:text-accent">
          Retour au site
        </Link>
      </form>
    </div>
  );
}
