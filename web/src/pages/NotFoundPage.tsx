import { Link, useRouteError } from 'react-router';
import { buttonPrimary, buttonSecondary } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="container-page flex flex-col items-center py-24 text-center">
      <title>Page introuvable · Tononkira</title>
      <p className="font-serif text-8xl font-semibold text-accent/80">404</p>
      <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">
        Cette page n'existe pas
      </h1>
      <p className="mt-2 max-w-md text-muted">
        Le lien est peut-être erroné, ou la page a été déplacée.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className={buttonPrimary}>
          Retour à l'accueil
        </Link>
        <Link to="/karoka" className={buttonSecondary}>
          Rechercher une chanson
        </Link>
      </div>
    </div>
  );
}

/** Erreur imprévue pendant le rendu d'une route. */
export function RouteErrorPage() {
  const error = useRouteError();
  console.error(error);
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center text-ink">
      <h1 className="font-serif text-3xl font-semibold">Un problème est survenu</h1>
      <p className="mt-2 text-muted">
        Rechargez la page. Si le problème persiste, revenez plus tard.
      </p>
      <a href="/" className={`${buttonPrimary} mt-6`}>
        Retour à l'accueil
      </a>
    </div>
  );
}
