import { Link } from 'react-router';
import { cx } from './ui';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface LetterFilterProps {
  active?: string | undefined;
  hrefFor: (letter: string | null) => string;
}

/** Filtre A–Z : défile horizontalement sur mobile. */
export function LetterFilter({ active, hrefFor }: LetterFilterProps) {
  const item = (label: string, value: string | null) => {
    const selected = (value ?? undefined) === active;
    return (
      <li key={label} className="shrink-0">
        <Link
          to={hrefFor(value)}
          aria-current={selected ? 'true' : undefined}
          className={cx(
            'inline-grid h-9 min-w-9 place-items-center rounded-full px-2.5 text-sm font-medium transition-colors',
            selected ? 'bg-ink text-canvas' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
          )}
        >
          {label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="Filtrer par lettre" className="-mx-4 sm:mx-0">
      <ul className="no-scrollbar flex gap-0.5 overflow-x-auto px-4 sm:flex-wrap sm:px-0">
        {item('Tous', null)}
        {LETTERS.map((letter) => item(letter, letter.toLowerCase()))}
      </ul>
    </nav>
  );
}

interface SegmentedLinksProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  hrefFor: (value: T) => string;
}

/** Choix exclusif sous forme de liens (le tri fait partie de l'URL, donc partageable). */
export function SegmentedLinks<T extends string>({
  label,
  value,
  options,
  hrefFor,
}: SegmentedLinksProps<T>) {
  return (
    <nav aria-label={label}>
      <ul className="inline-flex rounded-full border border-line bg-surface p-1 shadow-soft">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <li key={option.value}>
              <Link
                to={hrefFor(option.value)}
                aria-current={selected ? 'true' : undefined}
                className={cx(
                  'inline-flex h-8 items-center rounded-full px-4 text-sm font-medium transition-colors',
                  selected
                    ? 'bg-accent text-accent-ink shadow-soft'
                    : 'text-ink-soft hover:text-ink',
                )}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
