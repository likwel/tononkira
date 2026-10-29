import { Music } from 'lucide-react';
import { Link } from 'react-router';

export function Logo() {
  return (
    <Link
      to="/"
      className="flex shrink-0 items-center gap-2.5"
      aria-label="Tononkira, retour à l'accueil"
    >
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-ink shadow-soft">
        <Music className="size-[18px]" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className="font-serif text-xl font-semibold tracking-tight">Tononkira</span>
    </Link>
  );
}
