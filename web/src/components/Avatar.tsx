import { gradientFor, initials } from '../lib/format';
import { cx } from './ui';

const SIZES = {
  sm: 'size-10 text-sm',
  md: 'size-12 text-base',
  lg: 'size-16 text-xl',
  xl: 'size-24 text-3xl sm:size-28 sm:text-4xl',
} as const;

interface AvatarProps {
  name: string;
  /** Texte qui fixe la couleur (le slug, pour qu'un artiste garde toujours la même). */
  seed?: string;
  size?: keyof typeof SIZES;
  shape?: 'circle' | 'square';
}

/** Vignette générée (initiales sur dégradé) : pas d'image tierce chargée depuis la source. */
export function Avatar({ name, seed, size = 'md', shape = 'circle' }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'grid shrink-0 select-none place-items-center font-serif font-semibold tracking-tight text-white/95 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]',
        SIZES[size],
        shape === 'circle' ? 'rounded-full' : 'rounded-2xl',
      )}
      style={{ backgroundImage: gradientFor(seed ?? name) }}
    >
      {initials(name)}
    </span>
  );
}
