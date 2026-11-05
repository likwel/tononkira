import { Music } from 'lucide-react';
import { Equalizer } from '../Equalizer';
import { Link } from 'react-router';

export function Logo() {
  return (
    <Link
      to="/"
      viewTransition
      className="group flex shrink-0 items-center gap-2.5"
      aria-label="Tononkira, retour à l'accueil"
    >
      {/* Au survol, la note devient un égaliseur qui joue. */}
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(135deg,var(--accent),var(--sun))] text-white shadow-soft transition duration-300 group-hover:-rotate-6 group-hover:shadow-glow">
        <Music
          className="size-[18px] transition duration-300 group-hover:scale-50 group-hover:opacity-0"
          strokeWidth={2.25}
          aria-hidden="true"
        />
        <Equalizer className="absolute scale-75 opacity-0 transition duration-300 group-hover:scale-100 group-hover:opacity-100" />
      </span>
      <span className="font-display text-[1.35rem] font-bold tracking-tight">Tononkira</span>
    </Link>
  );
}
