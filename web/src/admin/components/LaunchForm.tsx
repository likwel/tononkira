import { LoaderCircle, Play } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { buttonPrimary, cx } from '../../components/ui';
import { ApiError } from '../../lib/api';
import { useStartJob } from '../queries';
import type { JobOptions, JobType } from '../types';

const MODES: { type: JobType; title: string; description: string }[] = [
  {
    type: 'crawl',
    title: 'Collecte',
    description: 'Lit les pages de liste choisies, puis récupère les paroles des chansons en attente.',
  },
  {
    type: 'update',
    title: 'Nouveautés',
    description: "Relit les listes depuis la page 1 jusqu'à une page sans nouveauté, puis collecte.",
  },
  {
    type: 'recheck',
    title: 'Revérification',
    description:
      'Relit les chansons déjà collectées (les moins récemment vérifiées d’abord) et détecte les modifications.',
  },
  {
    type: 'import',
    title: 'Import seul',
    description: 'Met la base à jour avec les chansons déjà collectées, sans requête vers le site.',
  },
];

const field =
  'h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm tabular-nums shadow-inner placeholder:text-muted/70 focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none';

function NumberField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1 block text-xs font-medium text-ink-soft">
        {props.label}
      </label>
      <input
        id={props.id}
        type="number"
        inputMode="decimal"
        min={props.min ?? 1}
        step={props.step ?? 1}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(event) => props.onChange(event.target.value)}
        className={field}
      />
      {props.hint && <p className="mt-1 text-[11px] text-muted">{props.hint}</p>}
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 rounded accent-[var(--accent)]"
      />
      <span>{children}</span>
    </label>
  );
}

const toNumber = (value: string) => (value.trim() === '' ? undefined : Number(value));

/** Options envoyées à l'API, selon le type de tâche (les champs vides sont omis). */
export function buildOptions(
  type: JobType,
  form: { from: string; to: string; limit: string; delay: string; retryErrors: boolean; refreshLists: boolean; importAfter: boolean },
): JobOptions {
  const options: JobOptions = {};
  const set = <K extends keyof JobOptions>(key: K, value: JobOptions[K] | undefined) => {
    if (value !== undefined) options[key] = value;
  };
  if (type === 'crawl') {
    set('from', toNumber(form.from));
    set('to', toNumber(form.to));
    set('limit', toNumber(form.limit));
    if (form.retryErrors) options.retryErrors = true;
    if (form.refreshLists) options.refreshLists = true;
  }
  if (type === 'recheck') set('limit', toNumber(form.limit));
  if (type !== 'import') {
    set('delay', toNumber(form.delay));
    options.importAfter = form.importAfter;
  }
  return options;
}

export function LaunchForm({ disabled }: { disabled: boolean }) {
  const start = useStartJob();
  const [type, setType] = useState<JobType>('crawl');
  const [form, setForm] = useState({
    from: '1',
    to: '',
    limit: '',
    delay: '1.5',
    retryErrors: false,
    refreshLists: false,
    importAfter: true,
  });
  const update = <K extends keyof typeof form>(key: K) => (value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    start.mutate({ type, options: buildOptions(type, form) });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-6">
      <h2 className="font-serif text-xl font-semibold tracking-tight">Lancer une tâche</h2>

      <fieldset className="mt-4">
        <legend className="sr-only">Type de tâche</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {MODES.map((mode) => (
            <label
              key={mode.type}
              className={cx(
                'cursor-pointer rounded-2xl border p-3 transition-colors',
                type === mode.type ? 'border-accent bg-accent-soft/50 ring-1 ring-accent' : 'border-line hover:border-accent/40',
              )}
            >
              <input
                type="radio"
                name="job-type"
                value={mode.type}
                checked={type === mode.type}
                onChange={() => setType(mode.type)}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-ink">{mode.title}</span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{mode.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 space-y-4">
        {type === 'crawl' && (
          <div className="grid grid-cols-3 gap-3">
            <NumberField id="job-from" label="De la page" value={form.from} onChange={update('from')} />
            <NumberField id="job-to" label="À la page" value={form.to} onChange={update('to')} placeholder="fin" />
            <NumberField id="job-limit" label="Chansons max." value={form.limit} onChange={update('limit')} placeholder="toutes" />
          </div>
        )}
        {type === 'recheck' && (
          <NumberField
            id="job-limit"
            label="Nombre de chansons"
            value={form.limit}
            onChange={update('limit')}
            placeholder="toutes"
            hint="Les petites corrections (4 mots ou moins, même nombre de lignes) ne sont pas détectées : la source ajoute des mots différents à chaque chargement."
          />
        )}
        {type !== 'import' && (
          <NumberField
            id="job-delay"
            label="Délai entre deux requêtes (s)"
            value={form.delay}
            onChange={update('delay')}
            min={0.5}
            step={0.5}
            hint="Respect du site source : 1,5 s par défaut, 0,5 s minimum."
          />
        )}
        {type === 'crawl' && (
          <div className="space-y-2">
            <Check checked={form.retryErrors} onChange={update('retryErrors')}>
              Retenter les chansons en erreur
            </Check>
            <Check checked={form.refreshLists} onChange={update('refreshLists')}>
              Relire les pages de liste déjà lues
            </Check>
          </div>
        )}
        {type !== 'import' && (
          <Check checked={form.importAfter} onChange={update('importAfter')}>
            Importer dans la base à la fin <span className="text-muted">(mise à jour, sans suppression)</span>
          </Check>
        )}
      </div>

      {start.isError && (
        <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {start.error instanceof ApiError ? start.error.message : 'Lancement impossible.'}
        </p>
      )}

      <button type="submit" className={cx(buttonPrimary, 'mt-5 w-full')} disabled={disabled || start.isPending}>
        {start.isPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Play className="size-4 fill-current" aria-hidden="true" />
        )}
        {disabled ? 'Une tâche est en cours' : 'Lancer'}
      </button>
    </form>
  );
}
