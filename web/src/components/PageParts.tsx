import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, children }: PageHeaderProps) {
  return (
    <header className="container-page animate-fade-up pt-10 pb-6 sm:pt-14">
      {eyebrow && (
        <p className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.2em] text-accent uppercase">
          <span className="h-px w-7 bg-current" aria-hidden="true" />
          {eyebrow}
        </p>
      )}
      <h1 className="mt-2 font-display text-[2.6rem] leading-[1.02] font-bold tracking-[-0.03em] text-balance sm:text-6xl">
        {title}
      </h1>
      {description && <p className="mt-3 max-w-2xl text-muted text-pretty">{description}</p>}
      {children}
    </header>
  );
}

interface SectionProps {
  title: string;
  subtitle?: string;
  to?: string;
  linkLabel?: string;
  /** Action secondaire affichée à droite du titre (ex. « Effacer »). */
  action?: ReactNode;
  children: ReactNode;
}

export function Section({
  title,
  subtitle,
  to,
  linkLabel = 'Tout voir',
  action,
  children,
}: SectionProps) {
  return (
    <section className="reveal container-page mt-16 sm:mt-20">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="font-display text-[1.65rem] font-bold tracking-[-0.025em] sm:text-[2rem]">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
        {to && (
          <Link
            to={to}
            className="group inline-flex shrink-0 items-center gap-0.5 text-sm font-medium text-accent"
          >
            {linkLabel}
            <ChevronRight
              className="size-4 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
