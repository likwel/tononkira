import { RefreshCw, SearchX, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { buttonSecondary, cx } from './ui';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = SearchX,
  title,
  children,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center rounded-3xl border border-dashed border-line px-6 py-14 text-center',
        className,
      )}
    >
      <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="mt-5 font-serif text-2xl font-semibold tracking-tight">{title}</h2>
      {children && <div className="mt-2 max-w-md text-sm text-muted text-pretty">{children}</div>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message =
    error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue. Réessayez.';
  return (
    <EmptyState
      icon={TriangleAlert}
      title="Impossible de charger cette page"
      action={
        onRetry && (
          <button type="button" onClick={onRetry} className={buttonSecondary}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Réessayer
          </button>
        )
      }
    >
      {message}
    </EmptyState>
  );
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
