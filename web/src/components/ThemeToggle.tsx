import { Monitor, Moon, Sun } from 'lucide-react';
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
      onClick={() => setPreference(next)}
      className={iconButton}
      aria-label={`Thème ${LABEL[preference]}. Passer au thème ${LABEL[next]}`}
      title={`Thème ${LABEL[preference]}`}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
