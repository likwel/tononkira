import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAdminToken, setAdminToken } from './auth';
import { buildOptions } from './components/LaunchForm';
import { UpdateMenu } from './components/UpdateMenu';

const json = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
const overview = (job: unknown = null) => ({
  data: { db: { songs: 1, artists: 1, lastPublishedAt: null }, crawl: null, job, pendingEdits: 0 },
});

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/admin/pages', element: <UpdateMenu /> },
      { path: '/admin', element: <p>Vue d'ensemble</p> },
    ],
    { initialEntries: ['/admin/pages'] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function stubApi(job: unknown = null) {
  const started: unknown[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/admin/jobs' && init?.method === 'POST') {
        started.push(JSON.parse(String(init.body)));
        return json({ data: { id: 7, status: 'running' } }, 202);
      }
      return json(overview(job));
    }),
  );
  return started;
}

beforeEach(() => setAdminToken('bon-jeton'));
afterEach(() => {
  vi.unstubAllGlobals();
  clearAdminToken();
});

describe('bouton « Mettre à jour »', () => {
  it('lance les nouveautés puis l’import, et montre la vue d’ensemble', async () => {
    const started = stubApi();
    const user = userEvent.setup();
    renderMenu();

    await user.click(await screen.findByRole('button', { name: /^Mettre à jour$/ }));

    await vi.waitFor(() =>
      expect(started).toEqual([{ type: 'update', options: { importAfter: true } }]),
    );
    expect(await screen.findByText("Vue d'ensemble")).toBeInTheDocument();
  });

  it('propose le réimport complet de toutes les données', async () => {
    const started = stubApi();
    const user = userEvent.setup();
    renderMenu();

    await user.click(await screen.findByRole('button', { name: 'Autres mises à jour' }));
    await user.click(screen.getByRole('menuitem', { name: /Réimporter toutes les données/ }));

    await vi.waitFor(() => expect(started).toEqual([{ type: 'import', options: { force: true } }]));
  });

  it('se ferme avec Échap', async () => {
    stubApi();
    const user = userEvent.setup();
    renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Autres mises à jour' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('devient un indicateur de progression pendant une tâche', async () => {
    stubApi({
      id: 3,
      type: 'update',
      status: 'running',
      options: {},
      summary: {},
      startedAt: new Date().toISOString(),
      finishedAt: null,
      progress: { phase: 'songs', current: 21, total: 50 },
      logs: [],
    });
    renderMenu();
    const link = await screen.findByRole('link', { name: /Nouveautés en cours/ });
    expect(link).toHaveTextContent('42 %');
    expect(screen.queryByRole('button', { name: /^Mettre à jour$/ })).toBeNull();
  });
});

describe('formulaire : réimport complet', () => {
  it('n’envoie « force » que pour un import', () => {
    const form = {
      from: '',
      to: '',
      limit: '',
      delay: '',
      retryErrors: false,
      refreshLists: false,
      importAfter: true,
      force: true,
    };
    expect(buildOptions('import', form)).toEqual({ force: true });
    expect(buildOptions('update', form)).toEqual({ importAfter: true });
  });
});
