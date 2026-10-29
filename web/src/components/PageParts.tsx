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
    <header className="container-page pt-10 pb-6 sm:pt-14">
      {eyebrow && (
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">{eyebrow}</p>
      )}
      <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
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
  children: ReactNode;
}

export function Section({ title, subtitle, to, linkLabel = 'Tout voir', children }: SectionProps) {
  return (
    <section className="container-page mt-16 sm:mt-20">
      <div className="mb-6 flex items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
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
