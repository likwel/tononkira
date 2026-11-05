import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAdminToken, setAdminToken } from '../admin/auth';
import { EditsPage } from '../admin/pages/EditsPage';
import type { LyricEdit } from '../admin/types';
import { collapseUnchanged, countChanges, diffLines } from '../lib/diff';
import type { SongDetail } from '../lib/types';
import { LyricsEditForm } from './LyricsEditForm';

const LYRICS = 'Andalana voalohany\nAndalana faharoa\nAndalana fahatelo';

const SONG: SongDetail = {
  artistSlug: 'magma',
  slug: 'potika',
  title: 'Potika',
  artists: [{ slug: 'magma', name: 'MAGMA' }],
  views: 12,
  likes: 0,
  publishedAt: null,
  lyrics: LYRICS,
  contributor: null,
  imageUrl: null,
  audioUrl: null,
  source: 'serasera',
  sourceUrl: 'https://tononkira.serasera.org/hira/magma/potika',
  related: [],
};

const EDIT: LyricEdit = {
  id: 7,
  status: 'pending',
  song: { artistSlug: 'magma', slug: 'potika', title: 'Potika' },
  baseLyrics: LYRICS,
  lyrics: 'Andalana voalohany\nAndalana faharoa voaova\nAndalana fahatelo',
  note: 'Faute au 2e vers',
  author: 'Rakoto',
  createdAt: new Date().toISOString(),
  reviewedAt: null,
};

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

describe('comparaison ligne à ligne', () => {
  it('marque les lignes ajoutées et retirées', () => {
    const lines = diffLines('a\nb\nc', 'a\nB\nc');
    expect(lines).toEqual([
      { type: 'same', text: 'a' },
      { type: 'removed', text: 'b' },
      { type: 'added', text: 'B' },
      { type: 'same', text: 'c' },
    ]);
    expect(countChanges(lines)).toEqual({ added: 1, removed: 1 });
  });

  it('ne renvoie que des lignes identiques pour deux textes égaux', () => {
    expect(diffLines('a\nb', 'a\nb').every((line) => line.type === 'same')).toBe(true);
  });

  it('masque les longues suites inchangées en gardant le contexte', () => {
    const before = Array.from({ length: 20 }, (_, index) => `ligne ${index}`).join('\n');
    const after = before.replace('ligne 10', 'ligne dix');
    const collapsed = collapseUnchanged(diffLines(before, after), 2);

    expect(collapsed.filter((line) => line.type === 'gap')).toHaveLength(2);
    expect(collapsed.some((line) => line.type === 'added' && line.text === 'ligne dix')).toBe(true);
    // 2 lignes de contexte de chaque côté + la ligne retirée + la ligne ajoutée + 2 repères.
    expect(collapsed).toHaveLength(8);
  });
});

describe('formulaire public de correction', () => {
  it("n'autorise l'envoi qu'après une vraie modification", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LyricsEditForm song={SONG} onClose={() => {}} />);

    const send = screen.getByRole('button', { name: /Envoyer la correction/ });
    expect(send).toBeDisabled();
    expect(screen.getByText(/Aucune modification/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Paroles'), ' voaova');
    expect(send).toBeEnabled();
  });

  it('envoie les paroles, le commentaire et le nom, puis annonce la relecture', async () => {
    const fetchMock = vi.fn(() => json({ data: { id: 1, status: 'pending' } }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderWithProviders(<LyricsEditForm song={SONG} onClose={() => {}} />);

    await user.type(screen.getByLabelText('Paroles'), ' voaova');
    await user.type(screen.getByLabelText(/Qu'avez-vous corrigé/), 'Faute');
    await user.type(screen.getByLabelText(/Votre nom/), 'Rakoto');
    await user.click(screen.getByRole('button', { name: /Envoyer la correction/ }));

    expect(await screen.findByText('Merci !')).toBeInTheDocument();
    expect(screen.getByText(/relue par un administrateur/)).toBeInTheDocument();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/songs/magma/potika/edits');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      lyrics: `${LYRICS} voaova`,
      note: 'Faute',
      author: 'Rakoto',
    });
  });

  it("affiche l'erreur renvoyée par l'API", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => json({ error: { message: 'Ces paroles sont identiques' } }, 400)),
    );
    const user = userEvent.setup();
    renderWithProviders(<LyricsEditForm song={SONG} onClose={() => {}} />);

    await user.type(screen.getByLabelText('Paroles'), ' voaova');
    await user.click(screen.getByRole('button', { name: /Envoyer la correction/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('identiques');
  });
});

describe('modération des corrections', () => {
  function stubEdits(edits: LyricEdit[]) {
    const fetchMock = vi.fn((input: string, init?: RequestInit) => {
      if (input.includes('/lyric-edits/') && init?.method === 'POST') {
        return json({ data: { ...edits[0]!, status: 'approved' } });
      }
      return json({
        data: edits,
        meta: { page: 1, limit: 20, total: edits.length, totalPages: 1 },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('montre la proposition, son commentaire et ce qui change', async () => {
    setAdminToken('jeton');
    stubEdits([EDIT]);
    renderWithProviders(<EditsPage />);

    expect(await screen.findByRole('link', { name: 'Potika' })).toBeInTheDocument();
    expect(screen.getByText('Faute au 2e vers')).toBeInTheDocument();
    expect(screen.getByText(/par Rakoto/)).toBeInTheDocument();
    expect(screen.getByText('Andalana faharoa')).toBeInTheDocument();
    expect(screen.getByText('Andalana faharoa voaova')).toBeInTheDocument();
  });

  it('publie la proposition telle quelle', async () => {
    setAdminToken('jeton');
    const fetchMock = stubEdits([EDIT]);
    const user = userEvent.setup();
    renderWithProviders(<EditsPage />);

    await user.click(await screen.findByRole('button', { name: 'Publier' }));

    await vi.waitFor(() => {
      const call = fetchMock.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/lyric-edits/7/approve') &&
          (init as RequestInit)?.method === 'POST',
      );
      expect(call).toBeDefined();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({});
    });
  });

  it('publie le texte retouché par l’administration', async () => {
    setAdminToken('jeton');
    const fetchMock = stubEdits([EDIT]);
    const user = userEvent.setup();
    renderWithProviders(<EditsPage />);

    await user.click(await screen.findByRole('button', { name: /Retoucher le texte/ }));
    await user.type(screen.getByLabelText('Paroles à publier'), '\nAndalana fanampiny');
    await user.click(screen.getByRole('button', { name: 'Publier' }));

    await vi.waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) =>
        String(url).includes('/lyric-edits/7/approve'),
      );
      expect(JSON.parse((call![1] as RequestInit).body as string).lyrics).toContain(
        'Andalana fanampiny',
      );
    });
  });

  it('refuse une proposition sans toucher au texte publié', async () => {
    setAdminToken('jeton');
    const fetchMock = stubEdits([EDIT]);
    const user = userEvent.setup();
    renderWithProviders(<EditsPage />);

    await user.click(await screen.findByRole('button', { name: 'Refuser' }));

    await vi.waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) => String(url).includes('/lyric-edits/7/reject')),
      ).toBe(true),
    );
  });
});
