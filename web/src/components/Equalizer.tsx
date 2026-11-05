import { cx } from './ui';

const BARS = [0.95, 1.25, 0.8, 1.1];

/** Petit égaliseur animé : le motif musical de la marque (accueil, logo, lecture en cours). */
export function Equalizer({
  playing = true,
  className,
}: {
  playing?: boolean;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cx('inline-flex h-3.5 items-end gap-[2px]', className)}>
      {BARS.map((duration, index) => (
        <span
          key={index}
          className={cx(
            'h-full w-[3px] origin-bottom rounded-full bg-current',
            playing ? 'animate-eq' : 'scale-y-[0.35]',
          )}
          style={
            playing
              ? { animationDuration: `${duration}s`, animationDelay: `${-index * 0.18}s` }
              : undefined
          }
        />
      ))}
    </span>
  );
}
