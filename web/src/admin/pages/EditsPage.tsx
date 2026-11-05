import { Check, ExternalLink, LoaderCircle, MessageSquareQuote, PencilLine, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SegmentedLinks } from '../../components/Filters';
import { Pagination } from '../../components/Pagination';
import { EmptyState, ErrorState } from '../../components/States';
import { buttonGhost, buttonPrimary, buttonSecondary, cx } from '../../components/ui';
import { ApiError, songPath } from '../../lib/api';
import { collapseUnchanged, countChanges, diffLines, type DiffLine } from '../../lib/diff';
import { plural } from '../../lib/format';
import { pick, toPage, withParams } from '../../lib/params';
import type { EditStatus } from '../../lib/types';
import { AdminHeading } from '../AdminLayout';
import { Badge } from '../components/Badges';
import { formatDateTime, timeAgo } from '../format';
import { useLyricEdits, useReviewEdit } from '../queries';
import type { LyricEdit } from '../types';

const FILTERS = [
  { value: 'pending', label: 'À relire' },
  { value: 'approved', label: 'Publiées' },
  { value: 'rejected', label: 'Refusées' },
] as const;
const FILTER_VALUES = FILTERS.map((filter) => filter.value);

const STATUS_BADGE: Record<EditStatus, { label: string; tone: 'ok' | 'muted' | 'changed' }> = {
  pending: { label: 'À relire', tone: 'changed' },
  approved: { label: 'Publiée', tone: 'ok' },
  rejected: { label: 'Refusée', tone: 'muted' },
};

const LINE_STYLE: Record<'same' | 'added' | 'removed', string> = {
  same: 'text-muted',
  added: 'bg-leaf-soft text-ink',
  removed: 'bg-danger-soft text-ink line-through decoration-danger/40',
};

const PREFIX: Record<'same' | 'added' | 'removed', string> = {
  same: ' ',
  added: '+',
  removed: '−',
};

function DiffView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {lines.map((line, index) =>
        line.type === 'gap' ? (
          <p
            key={index}
            className="border-y border-line/60 bg-surface-2 px-3 py-1 text-center text-[11px] text-muted"
          >
            {plural(line.count, 'ligne inchangée', 'lignes inchangées')}
          </p>
        ) : (
          <p
            key={index}
            className={cx(
              'flex gap-2 px-3 py-0.5 font-serif text-[15px] leading-relaxed',
              LINE_STYLE[line.type],
            )}
          >
            <span aria-hidden="true" className="w-2 shrink-0 font-sans text-xs text-muted">
              {PREFIX[line.type]}
            </span>
            <span className="whitespace-pre-wrap">{line.text || ' '}</span>
          </p>
        ),
      )}
    </div>
  );
}

function EditCard({ edit }: { edit: LyricEdit }) {
  const review = useReviewEdit();
  const [draft, setDraft] = useState<string | null>(null);
  const lyrics = draft ?? edit.lyrics;
  const diff = collapseUnchanged(diffLines(edit.baseLyrics, lyrics));
  const changes = countChanges(diff);
  const status = STATUS_BADGE[edit.status];
  const pending = edit.status === 'pending';

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight">
            <Link to={songPath(edit.song)} className="transition-colors hover:text-accent">
              {edit.song.title}
            </Link>
            <Link
              to={songPath(edit.song)}
              className="shrink-0 text-muted transition-colors hover:text-accent"
              aria-label="Voir la chanson sur le site"
              title="Voir sur le site"
            >
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          </h2>
          <p className="mt-1 text-sm text-muted" title={formatDateTime(edit.createdAt)}>
            Proposée {timeAgo(edit.createdAt)}
            {edit.author ? ` par ${edit.author}` : ' (anonyme)'}
            {' · '}
            {changes.added} ajout{changes.added > 1 ? 's' : ''}, {changes.removed} retrait
            {changes.removed > 1 ? 's' : ''}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {edit.note && (
        <p className="mt-4 flex gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm text-ink-soft">
          <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          {edit.note}
        </p>
      )}

      <div className="mt-4">
        {draft === null ? (
          <DiffView lines={diff} />
        ) : (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={16}
            spellCheck={false}
            aria-label="Paroles à publier"
            className="w-full resize-y rounded-xl border border-line bg-canvas p-4 font-serif text-[15px] leading-relaxed focus:border-accent/60 focus:ring-4 focus:ring-accent/15 focus:outline-none"
          />
        )}
      </div>

      {review.isError && (
        <p className="mt-4 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
          {review.error instanceof ApiError ? review.error.message : 'Action impossible.'}
        </p>
      )}

      {pending && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={buttonPrimary}
            disabled={review.isPending}
            onClick={() =>
              review.mutate({
                id: edit.id,
                action: 'approve',
                ...(draft === null ? {} : { lyrics: draft }),
              })
            }
          >
            {review.isPending ? (
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Publier
          </button>
          <button
            type="button"
            className={buttonSecondary}
            disabled={review.isPending}
            onClick={() => review.mutate({ id: edit.id, action: 'reject' })}
          >
            <X className="size-4" aria-hidden="true" />
            Refuser
          </button>
          <button
            type="button"
            className={cx(buttonGhost, 'ml-auto')}
            onClick={() => setDraft(draft === null ? edit.lyrics : null)}
          >
            <PencilLine className="size-4" aria-hidden="true" />
            {draft === null ? 'Retoucher le texte' : 'Revenir à la comparaison'}
          </button>
        </div>
      )}
    </section>
  );
}

export function EditsPage() {
  const [params] = useSearchParams();
  const page = toPage(params.get('page'));
  const status = pick(params.get('status'), FILTER_VALUES, 'pending');
  const edits = useLyricEdits({ page, status });

  return (
    <>
      <AdminHeading
        title="Corrections proposées"
        subtitle="Les corrections envoyées depuis les pages de chansons ne sont publiées qu'après votre validation."
      >
        {edits.data && (
          <p className="text-sm text-muted">{plural(edits.data.meta.total, 'proposition')}</p>
        )}
      </AdminHeading>

      <div className="no-scrollbar -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <SegmentedLinks
          label="Filtrer les propositions"
          value={status}
          options={[...FILTERS]}
          hrefFor={(value) => withParams(params, { status: value, page: null })}
        />
      </div>

      {edits.isError ? (
        <ErrorState error={edits.error} onRetry={() => edits.refetch()} />
      ) : edits.data?.data.length === 0 ? (
        <EmptyState icon={PencilLine} title="Aucune proposition">
          {status === 'pending'
            ? 'Les corrections envoyées depuis les pages de chansons apparaîtront ici.'
            : 'Rien dans cette catégorie pour le moment.'}
        </EmptyState>
      ) : (
        <div className={cx('space-y-5', edits.isPlaceholderData && 'opacity-60')}>
          {edits.data ? (
            edits.data.data.map((edit) => <EditCard key={edit.id} edit={edit} />)
          ) : (
            <p className="py-10 text-center text-sm text-muted" role="status">
              Chargement…
            </p>
          )}
        </div>
      )}

      {edits.data && (
        <Pagination
          page={edits.data.meta.page}
          totalPages={edits.data.meta.totalPages}
          hrefFor={(target) => withParams(params, { page: target })}
        />
      )}
    </>
  );
}
