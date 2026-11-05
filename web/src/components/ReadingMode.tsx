import { AArrowDown, AArrowUp, Minus, Pause, Play, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { artistNames } from '../lib/format';
import { readStorage, writeStorage } from '../lib/storage';
import type { SongDetail } from '../lib/types';
import { Equalizer } from './Equalizer';
import { LyricsView } from './LyricsView';
import { cx, iconButton } from './ui';

const SIZE_KEY = 'tononkira-reading-size';
const SPEED_KEY = 'tononkira-reading-speed';
const SIZES = [1.15, 1.3, 1.5, 1.75, 2, 2.4];
/** Vitesses du défilement automatique, en pixels par seconde. */
export const SPEEDS = [12, 20, 30, 42, 58];

function storedIndex(key: string, fallback: number, length: number): number {
  const value = readStorage<number>(key, fallback, Number);
  return Number.isInteger(value) && value >= 0 && value < length ? value : fallback;
}

function defaultSizeIndex(): number {
  const wide =
    typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 640px)').matches;
  return wide ? 3 : 1;
}

/** Garde l'écran allumé pendant la lecture (ignoré si le navigateur ne le permet pas). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const acquire = async () => {
      try {
        const next = (await navigator.wakeLock?.request('screen')) ?? null;
        if (active) lock = next;
        else void next?.release();
      } catch {
        // Refus du navigateur (batterie faible, onglet masqué) : la lecture continue.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);
}

interface ReadingModeProps {
  song: Pick<SongDetail, 'title' | 'artists' | 'lyrics'>;
  onClose: () => void;
}

/**
 * Lecture plein écran pour chanter : grand texte, défilement automatique réglable,
 * écran maintenu allumé. Échap ferme, Espace lance ou arrête le défilement ; toucher
 * le texte met le défilement en pause.
 */
export function ReadingMode({ song, onClose }: ReadingModeProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [sizeIndex, setSizeIndex] = useState(() =>
    storedIndex(SIZE_KEY, defaultSizeIndex(), SIZES.length),
  );
  const [speedIndex, setSpeedIndex] = useState(() => storedIndex(SPEED_KEY, 1, SPEEDS.length));
  const [playing, setPlaying] = useState(false);

  useWakeLock();
  useEffect(() => writeStorage(SIZE_KEY, String(sizeIndex)), [sizeIndex]);
  useEffect(() => writeStorage(SPEED_KEY, String(speedIndex)), [speedIndex]);

  // Défilement automatique : accumulation des fractions de pixel entre deux images.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const step = (now: number) => {
      const element = scroller.current;
      if (!element) return;
      carry += ((now - last) / 1000) * SPEEDS[speedIndex]!;
      last = now;
      const whole = Math.floor(carry);
      if (whole >= 1) {
        element.scrollTop += whole;
        carry -= whole;
      }
      if (element.scrollTop + element.clientHeight >= element.scrollHeight - 1) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, speedIndex]);

  // Page figée derrière, focus dans la fenêtre puis rendu à l'élément d'origine.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    closeButton.current?.focus();
    return () => {
      root.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    },
    [onClose],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onKeyDown]);

  const pause = () => setPlaying(false);
  const control = cx(iconButton, 'disabled:opacity-35');

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Mode lecture : ${song.title}`}
      className="fixed inset-0 z-[60] flex animate-slide-up flex-col bg-canvas text-ink"
    >
      <header className="flex items-center gap-3 border-b border-line/70 px-4 py-2.5 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-display text-lg leading-tight font-bold tracking-tight">
            {playing && <Equalizer className="shrink-0 text-accent" />}
            <span className="truncate">{song.title}</span>
          </p>
          <p className="truncate text-xs text-muted">{artistNames(song.artists)}</p>
        </div>
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          className={iconButton}
          aria-label="Quitter le mode lecture"
          title="Quitter (Échap)"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </header>

      <div
        ref={scroller}
        data-testid="reading-scroller"
        onWheel={pause}
        onPointerDown={pause}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        {/* Grande marge basse : le dernier couplet peut remonter au milieu de l'écran. */}
        <div className="mx-auto max-w-2xl px-6 pt-10 pb-[55vh] sm:px-10 sm:pt-16">
          <LyricsView lyrics={song.lyrics} size={SIZES[sizeIndex]} />
        </div>
      </div>

      <footer className="border-t border-line/70 bg-surface/90 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center gap-1">
          <button
            type="button"
            className={control}
            onClick={() => setSizeIndex((value) => Math.max(0, value - 1))}
            disabled={sizeIndex === 0}
            aria-label="Réduire le texte"
          >
            <AArrowDown className="size-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={control}
            onClick={() => setSizeIndex((value) => Math.min(SIZES.length - 1, value + 1))}
            disabled={sizeIndex === SIZES.length - 1}
            aria-label="Agrandir le texte"
          >
            <AArrowUp className="size-5" aria-hidden="true" />
          </button>

          <div className="mx-auto flex items-center gap-1 rounded-full border border-line bg-canvas px-1">
            <button
              type="button"
              className={cx(control, 'size-9')}
              onClick={() => setSpeedIndex((value) => Math.max(0, value - 1))}
              disabled={speedIndex === 0}
              aria-label="Défilement plus lent"
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span
              className="w-20 text-center text-xs font-medium text-ink-soft tabular-nums"
              aria-live="polite"
            >
              Vitesse {speedIndex + 1}/{SPEEDS.length}
            </span>
            <button
              type="button"
              className={cx(control, 'size-9')}
              onClick={() => setSpeedIndex((value) => Math.min(SPEEDS.length - 1, value + 1))}
              disabled={speedIndex === SPEEDS.length - 1}
              aria-label="Défilement plus rapide"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-pressed={playing}
            aria-label={playing ? 'Arrêter le défilement' : 'Défilement automatique'}
            title="Espace"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-accent-ink shadow-soft transition hover:brightness-110"
          >
            {playing ? (
              <Pause className="size-5 fill-current" aria-hidden="true" />
            ) : (
              <Play className="ml-0.5 size-5 fill-current" aria-hidden="true" />
            )}
          </button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
