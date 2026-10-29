import { CornerDownLeft, LoaderCircle, MicVocal, Music, Search } from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router';
import { useSearch } from '../hooks/queries';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { artistPath, songPath } from '../lib/api';
import { artistNames, plural } from '../lib/format';
import { Highlight } from './Highlight';
import { cx } from './ui';

interface SearchBoxProps {
  size?: 'md' | 'lg';
  initialValue?: string;
  autoFocus?: boolean;
  /** Vider le champ après navigation (recherche de l'en-tête). */
  clearOnNavigate?: boolean;
  className?: string;
}

interface Option {
  key: string;
  kind: 'artist' | 'song' | 'all';
  label: string;
  detail?: string;
  to: string;
}

const ICONS = { artist: MicVocal, song: Music, all: CornerDownLeft } as const;

export function searchHref(q: string): string {
  return `/karoka?q=${encodeURIComponent(q.trim())}`;
}

/** Champ de recherche avec suggestions (motif ARIA « combobox »). */
export function SearchBox({
  size = 'md',
  initialValue = '',
  autoFocus = false,
  clearOnNavigate = false,
  className,
}: SearchBoxProps) {
  const navigate = useNavigate();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => setValue(initialValue), [initialValue]);

  const q = value.trim();
  const debounced = useDebouncedValue(q, 200);
  const { data, isFetching } = useSearch(debounced, 1, 6, open);

  const options = useMemo<Option[]>(() => {
    if (q.length < 2) return [];
    const found: Option[] =
      data && debounced === q
        ? [
            ...data.data.artists.slice(0, 3).map((artist) => ({
              key: `a:${artist.slug}`,
              kind: 'artist' as const,
              label: artist.name,
              detail: plural(artist.songCount, 'chanson'),
              to: artistPath(artist),
            })),
            ...data.data.songs.slice(0, 5).map((song) => ({
              key: `s:${song.artistSlug}/${song.slug}`,
              kind: 'song' as const,
              label: song.title,
              detail: artistNames(song.artists),
              to: songPath(song),
            })),
          ]
        : [];
    return [...found, { key: 'all', kind: 'all', label: `Rechercher « ${q} »`, to: searchHref(q) }];
  }, [data, debounced, q]);

  const expanded = open && options.length > 0;

  function go(to: string) {
    setOpen(false);
    setActive(-1);
    if (clearOnNavigate) setValue('');
    inputRef.current?.blur();
    navigate(to);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const option = options[active];
    if (option) go(option.to);
    else if (q.length >= 2) go(searchHref(q));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, -1));
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const large = size === 'lg';

  return (
    <form role="search" onSubmit={onSubmit} className={cx('relative', className)}>
      <label htmlFor={`${id}-input`} className="sr-only">
        Rechercher un titre, un artiste ou des paroles
      </label>
      <Search
        className={cx(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted',
          large ? 'left-5 size-5' : 'left-3.5 size-4',
        )}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        id={`${id}-input`}
        type="search"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={value}
        placeholder={large ? 'Titre, artiste ou paroles…' : 'Rechercher…'}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cx(
          'w-full rounded-full border border-line bg-surface text-ink shadow-soft transition placeholder:text-muted/80 focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden',
          large ? 'h-14 pr-12 pl-13 text-base sm:text-lg' : 'h-10 pr-9 pl-10 text-sm',
        )}
      />
      {isFetching && open && (
        <LoaderCircle
          className={cx(
            'absolute top-1/2 -translate-y-1/2 animate-spin text-muted',
            large ? 'right-5 size-5' : 'right-3 size-4',
          )}
          aria-hidden="true"
        />
      )}

      <ul
        id={`${id}-list`}
        role="listbox"
        aria-label="Suggestions"
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface py-1.5 text-left shadow-lift"
      >
        {options.map((option, index) => {
          const Icon = ICONS[option.kind];
          return (
            <li
              key={option.key}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown avant le blur du champ : sinon la liste se ferme avant le clic.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => go(option.to)}
              onMouseEnter={() => setActive(index)}
              className={cx(
                'flex cursor-pointer items-center gap-3 px-4 py-2.5',
                index === active && 'bg-surface-2',
                option.kind === 'all' && 'border-t border-line text-sm text-accent',
              )}
            >
              <Icon
                className={cx(
                  'size-4 shrink-0',
                  option.kind === 'all' ? 'text-accent' : 'text-muted',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink">
                  {option.kind === 'all' ? (
                    option.label
                  ) : (
                    <Highlight text={option.label} query={q} />
                  )}
                </span>
                {option.detail && (
                  <span className="block truncate text-xs text-muted">{option.detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
