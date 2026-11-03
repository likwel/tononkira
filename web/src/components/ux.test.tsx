import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearHistory,
  HISTORY_KEY,
  HISTORY_SIZE,
  recordView,
  resetHistoryStore,
  useHistory,
} from '../lib/history';
import { ReadingMode } from './ReadingMode';
import { SearchBox } from './SearchBox';

const song = (n: number) => ({
  artistSlug: 'magma',
  slug: `hira-${n}`,
  title: `Hira ${n}`,
  artists: [{ slug: 'magma', name: 'MAGMA' }],
});

describe('historique de lecture', () => {
  beforeEach(() => resetHistoryStore());

  it('met la dernière chanson vue en tête, sans doublon, en nombre limité', () => {
    for (let n = 1; n <= HISTORY_SIZE + 3; n += 1) recordView(song(n));
    recordView(song(5));
    const stored = JSON.parse(window.localStorage.getItem(HISTORY_KEY)!) as { slug: string }[];
    expect(stored).toHaveLength(HISTORY_SIZE);
    expect(stored[0]!.slug).toBe('hira-5');
    expect(stored.filter((entry) => entry.slug === 'hira-5')).toHaveLength(1);
  });

  it('s’efface et ignore un stockage corrompu', () => {
    recordView(song(1));
    clearHistory();
    window.localStorage.setItem(HISTORY_KEY, '{oups');
    resetHistoryStore();
    function Probe() {
      return <span>{useHistory().length}</span>;
    }
    render(<Probe />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});

describe('mode lecture', () => {
  const lyrics = {
    title: 'Potika',
    artists: [{ slug: 'magma', name: 'MAGMA' }],
    lyrics: 'Andalana 1\n\nRef: Tiako',
  };
  let release: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    release = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: vi.fn(() => Promise.resolve({ release })) },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it("s'ouvre en plein écran, garde l'écran allumé et se ferme avec Échap", async () => {
    const onClose = vi.fn();
    const { unmount } = render(<ReadingMode song={lyrics} onClose={onClose} />);

    expect(screen.getByRole('dialog', { name: 'Mode lecture : Potika' })).toBeInTheDocument();
    expect(screen.getByText('Andalana 1')).toBeInTheDocument();
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Quitter le mode lecture' })).toHaveFocus();
    await vi.waitFor(() => expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen'));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();

    unmount();
    expect(document.documentElement.style.overflow).toBe('');
    await vi.waitFor(() => expect(release).toHaveBeenCalled());
  });

  it('lance le défilement avec Espace et le met en pause au toucher', () => {
    render(<ReadingMode song={lyrics} onClose={() => {}} />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByRole('button', { name: 'Arrêter le défilement' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    fireEvent.pointerDown(screen.getByTestId('reading-scroller'));
    expect(screen.getByRole('button', { name: 'Défilement automatique' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('raccourci « / »', () => {
  function renderSearch(extra?: React.ReactNode) {
    const client = new QueryClient({ defaultOptions: { queries: { enabled: false } } });
    return render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SearchBox />
          {extra}
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('place le curseur dans la recherche', async () => {
    const user = userEvent.setup();
    renderSearch();
    await user.keyboard('/');
    expect(screen.getByRole('combobox')).toHaveFocus();
    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it("ne vole pas la saisie d'un autre champ", async () => {
    const user = userEvent.setup();
    renderSearch(<input aria-label="autre" />);
    await user.click(screen.getByLabelText('autre'));
    await user.keyboard('/');
    expect(screen.getByLabelText('autre')).toHaveValue('/');
    expect(screen.getByRole('combobox')).not.toHaveFocus();
  });
});
