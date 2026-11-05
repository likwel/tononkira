import {
  ChevronDown,
  DatabaseZap,
  FileDown,
  ListRestart,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Equalizer } from '../../components/Equalizer';
import { cx } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { describeProgress, JOB_LABEL } from '../format';
import { useOverview, useStartJob } from '../queries';
import type { JobOptions, JobType } from '../types';

interface UpdateAction {
  type: JobType;
  options: JobOptions;
  icon: LucideIcon;
  title: string;
  description: string;
}

export const UPDATE_ACTIONS: UpdateAction[] = [
  {
    type: 'update',
    options: { importAfter: true },
    icon: Sparkles,
    title: 'Nouveautés et mise à jour',
    description:
      'Cherche les nouvelles chansons sur la source depuis la page 1, puis met la base à jour.',
  },
  {
    type: 'import',
    options: { force: true },
    icon: DatabaseZap,
    title: 'Réimporter toutes les données',
    description:
      'Réécrit dans la base toutes les chansons collectées, même inchangées. Rien n’est supprimé.',
  },
  {
    type: 'import',
    options: {},
    icon: FileDown,
    title: 'Importer les changements',
    description: 'Met la base à jour avec les seules chansons collectées qui ont changé (rapide).',
  },
  {
    type: 'recheck',
    options: { limit: 100, importAfter: true },
    icon: ListRestart,
    title: 'Revérifier 100 pages',
    description: 'Relit les pages les moins récemment vérifiées et détecte les modifications.',
  },
];

/**
 * Bouton « Mettre à jour » de l'en-tête d'administration : un clic lance la mise à jour
 * habituelle (nouveautés + import), le menu propose les autres. Pendant une tâche, il
 * devient un indicateur de progression qui mène à la vue d'ensemble.
 */
export function UpdateMenu() {
  const overview = useOverview();
  const start = useStartJob();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const firstItem = useRef<HTMLButtonElement>(null);
  const job = overview.data?.job;

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function launch(action: Pick<UpdateAction, 'type' | 'options'>) {
    setOpen(false);
    start.mutate(
      { type: action.type, options: action.options },
      { onSuccess: () => navigate('/admin', { viewTransition: true }) },
    );
  }

  if (job?.status === 'running') {
    const progress = job.progress ? describeProgress(job.progress) : null;
    return (
      <Link
        to="/admin"
        viewTransition
        className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3.5 py-2 text-sm font-semibold text-accent transition hover:brightness-105"
        title={progress?.label ?? 'Tâche en cours'}
      >
        <Equalizer />
        <span className="max-sm:hidden">{JOB_LABEL[job.type]} en cours</span>
        {progress?.percent !== null && progress?.percent !== undefined && (
          <span className="tabular-nums">{progress.percent} %</span>
        )}
      </Link>
    );
  }

  const main = UPDATE_ACTIONS[0]!;
  const segment =
    'inline-flex items-center bg-accent text-sm font-semibold text-accent-ink transition duration-200 hover:brightness-105 active:scale-[0.98] disabled:opacity-60';

  return (
    <div ref={container} className="relative">
      <div className="inline-flex rounded-full shadow-soft transition hover:shadow-glow">
        <button
          type="button"
          onClick={() => launch(main)}
          disabled={start.isPending}
          className={cx(segment, 'gap-2 rounded-l-full py-2 pr-3 pl-3.5 sm:pl-4')}
          title={main.description}
        >
          {start.isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="size-4" aria-hidden="true" />
          )}
          <span className="whitespace-nowrap max-sm:sr-only">Mettre à jour</span>
        </button>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Autres mises à jour"
          onClick={() => setOpen((value) => !value)}
          className={cx(segment, 'rounded-r-full border-l border-white/25 px-2.5')}
        >
          <ChevronDown
            className={cx('size-4 transition-transform duration-300', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          aria-label="Mises à jour"
          className="absolute top-full right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right animate-scale-in rounded-2xl border border-line bg-surface p-1.5 shadow-lift"
        >
          {UPDATE_ACTIONS.map((action, index) => (
            <button
              key={action.title}
              ref={index === 0 ? firstItem : undefined}
              type="button"
              role="menuitem"
              onClick={() => launch(action)}
              className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <action.icon className="size-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-ink">{action.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">
                  {action.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {start.isError && !open && (
        <p
          role="alert"
          className="absolute top-full right-0 z-50 mt-2 w-72 animate-scale-in rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger shadow-soft"
        >
          {start.error instanceof ApiError ? start.error.message : 'Lancement impossible.'}
        </p>
      )}
    </div>
  );
}
