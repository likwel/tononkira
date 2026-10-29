import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAdminToken, getAdminToken, setAdminToken } from './auth';
import { buildOptions } from './components/LaunchForm';
import { describeOptions, describeRefresh, describeSummary, formatDuration, timeAgo } from './format';
import { CrawlPagesPage } from './pages/CrawlPagesPage';
import { LoginPage } from './pages/LoginPage';
import type { CrawlSong, RefreshResult } from './types';

const EMPTY_FORM = {
  from: '',
  to: '',
  limit: '',
  delay: '',
  retryErrors: false,
  refreshLists: false,
  importAfter: true,
};

const refresh = (overrides: Partial<RefreshResult>): RefreshResult => ({
  url: 'u',
  status: 'unchanged',
  changes: [],
  stats: [],
  error: null,
  imported: null,
  catalog: null,
  ...overrides,
});

describe('formatage', () => {
  it('décrit le résultat d’une vérification', () => {
    expect(describeRefresh(refresh({ status: 'updated', changes: ['paroles', 'titre'], imported: 'updated' }))).toEqual({
      text: 'Modifiée : paroles, titre · catalogue mis à jour',
      tone: 'changed',
    });
    expect(describeRefresh(refresh({ stats: ['vues'] })).text).toBe('À jour (vues actualisées)');
    expect(describeRefresh(refresh({ status: 'gone' })).tone).toBe('muted');
    expect(describeRefresh(refresh({ status: 'error', error: 'HTTP 503' })).text).toBe('Échec : HTTP 503');
  });

  it('résume options et résultats d’une tâche', () => {
    expect(describeOptions('crawl', { from: 9, to: 20, limit: 100, delay: 1.5 })).toBe(
      'pages 9 à 20 · 100 chansons max. · délai 1,5 s',
    );
    expect(describeOptions('update', { importAfter: false })).toBe('sans import');
    expect(
      describeSummary({
        lists: { pages: 2, found: 40, new: 3 },
        import: { lines: 3, created: 1, updated: 2, unchanged: 0, invalid: 0, failed: 0 },
      }),
    ).toEqual([
      '2 pages de liste lues, 3 nouvelles chansons',
      'Base : 1 créée(s), 2 mise(s) à jour, 0 inchangée(s)',
    ]);
  });

  it('écrit des durées et des dates relatives lisibles', () => {
    const now = Date.parse('2026-10-29T10:00:00Z');
    expect(timeAgo('2026-10-29T09:55:00Z', now)).toBe('il y a 5 minutes');
    expect(timeAgo(null, now)).toBe('—');
    expect(formatDuration('2026-10-29T09:00:00Z', '2026-10-29T09:03:12Z')).toBe('3 min 12 s');
  });
});

describe('buildOptions', () => {
  it('omet les champs vides et ne garde que les options du type de tâche', () => {
    expect(buildOptions('crawl', { ...EMPTY_FORM, from: '9', delay: '2', retryErrors: true })).toEqual({
      from: 9,
      delay: 2,
      retryErrors: true,
      importAfter: true,
    });
    expect(buildOptions('recheck', { ...EMPTY_FORM, from: '9', limit: '50' })).toEqual({
      limit: 50,
      importAfter: true,
    });
    expect(buildOptions('import', { ...EMPTY_FORM, limit: '50', delay: '2' })).toEqual({});
  });
});

function renderWithProviders(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));

afterEach(() => {
  vi.unstubAllGlobals();
  clearAdminToken();
});

describe('connexion', () => {
  it('refuse un jeton invalide sans le mémoriser', async () => {
    vi.stubGlobal('fetch', vi.fn(() => json({ error: { message: "Jeton d'administration invalide" } }, 401)));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("Jeton d'administration"), 'mauvais');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Jeton');
    expect(getAdminToken()).toBeNull();
  });

  it('mémorise un jeton accepté par l’API', async () => {
    const fetchMock = vi.fn(() => json({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("Jeton d'administration"), 'bon-jeton');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await vi.waitFor(() => expect(getAdminToken()).toBe('bon-jeton'));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/session',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer bon-jeton' }) }),
    );
  });
});

describe('pages collectées', () => {
  const song: CrawlSong = {
    url: 'https://tononkira.serasera.org/hira/magma/potika',
    artistSlug: 'magma',
    slug: 'potika',
    title: 'potika',
    artists: [{ slug: 'magma', name: 'MAGMA' }],
    status: 'done',
    attempts: 0,
    error: null,
    discoveredAt: '2026-10-29T06:00:00Z',
    updatedAt: '2026-10-29T06:00:00Z',
    scrapedAt: '2026-10-29T06:00:00Z',
    checkedAt: null,
    changedAt: '2026-10-29T06:00:00Z',
    catalog: { artistSlug: 'magma', slug: 'potika' },
  };

  beforeEach(() => setAdminToken('bon-jeton'));

  it('vérifie une page déjà collectée et affiche la mise à jour détectée', async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.startsWith('/api/admin/pages/refresh')) {
        expect(JSON.parse(String(init?.body))).toEqual({ url: song.url });
        return json({ data: refresh({ status: 'updated', changes: ['paroles'], imported: 'updated' }) });
      }
      return json({ data: [song], meta: { page: 1, limit: 25, total: 1, totalPages: 1 } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<CrawlPagesPage />);

    expect(await screen.findByRole('link', { name: 'potika' })).toHaveAttribute('href', '/hira/magma/potika');
    await user.click(screen.getByRole('button', { name: /Vérifier/ }));

    expect(await screen.findByText('Modifiée : paroles · catalogue mis à jour')).toBeInTheDocument();
  });
});
