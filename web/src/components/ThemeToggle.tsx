import { Monitor, Moon, Sun } from 'lucide-react';
import { revealThemeChange } from '../lib/motion';
import { NEXT_THEME, useThemePreference, type ThemePreference } from '../lib/theme';
import { iconButton } from './ui';

const LABEL: Record<ThemePreference, string> = {
  light: 'clair',
  dark: 'sombre',
  system: 'du système',
};
const ICON = { light: Sun, dark: Moon, system: Monitor } as const;

/** Bascule clair → sombre → système. */
export function ThemeToggle() {
  const [preference, setPreference] = useThemePreference();
  const next = NEXT_THEME[preference];
  const Icon = ICON[preference];

  return (
    <button
      type="button"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        revealThemeChange(() => setPreference(next), {
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
        });
      }}
      className={iconButton}
      aria-label={`Thème ${LABEL[preference]}. Passer au thème ${LABEL[next]}`}
      title={`Thème ${LABEL[preference]}`}
    >
      <Icon key={preference} className="size-5 animate-pop" aria-hidden="true" />
    </button>
  );
}
