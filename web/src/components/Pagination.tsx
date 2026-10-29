import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { pageItems } from '../lib/pagination';
import { cx } from './ui';

interface PaginationProps {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}

const cell =
  'inline-grid h-10 min-w-10 place-items-center rounded-full px-3 text-sm tabular-nums transition-colors';

export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  if (totalPages <= 1) return null;
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-1">
      {hasPrev ? (
        <Link
          to={hrefFor(page - 1)}
          className={cx(cell, 'gap-1 text-ink-soft hover:bg-surface-2')}
          rel="prev"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Précédente</span>
        </Link>
      ) : (
        <span className={cx(cell, 'gap-1 text-muted/50')} aria-hidden="true">
          <ChevronLeft className="size-4" />
          <span className="sr-only sm:not-sr-only">Précédente</span>
        </span>
      )}

      <ol className="hidden items-center gap-1 sm:flex">
        {pageItems(page, totalPages).map((item) =>
          typeof item === 'number' ? (
            <li key={item}>
              <Link
                to={hrefFor(item)}
                aria-current={item === page ? 'page' : undefined}
                className={cx(
                  cell,
                  item === page
                    ? 'bg-ink font-semibold text-canvas'
                    : 'text-ink-soft hover:bg-surface-2',
                )}
              >
                {item}
              </Link>
            </li>
          ) : (
            <li key={item} className={cx(cell, 'text-muted')} aria-hidden="true">
              …
            </li>
          ),
        )}
      </ol>
      <span className="px-3 text-sm text-muted tabular-nums sm:hidden">
        Page {page} sur {totalPages}
      </span>

      {hasNext ? (
        <Link
          to={hrefFor(page + 1)}
          className={cx(cell, 'gap-1 text-ink-soft hover:bg-surface-2')}
          rel="next"
        >
          <span className="sr-only sm:not-sr-only">Suivante</span>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cx(cell, 'gap-1 text-muted/50')} aria-hidden="true">
          <span className="sr-only sm:not-sr-only">Suivante</span>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
