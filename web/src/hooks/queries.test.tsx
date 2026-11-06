import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { queryClient, useSong } from './queries';

function Lyrics() {
  const { data } = useSong('magma', 'potika');
  return <p>{data?.lyrics ?? 'chargement'}</p>;
}

afterEach(() => vi.unstubAllGlobals());

describe('fraîcheur de la page chanson', () => {
  it('se recharge en revenant sur l’onglet : une correction approuvée entre-temps apparaît', async () => {
    let lyrics = 'Paroles de la source';
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(Response.json({ data: { artistSlug: 'magma', slug: 'potika', lyrics } })),
      ),
    );
    // Mêmes réglages par défaut que l'application.
    const client = new QueryClient({ defaultOptions: queryClient.getDefaultOptions() });
    render(
      <QueryClientProvider client={client}>
        <Lyrics />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('Paroles de la source')).toBeInTheDocument();

    // L'administrateur approuve une correction dans un autre onglet, puis on revient.
    lyrics = 'Paroles corrigées';
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(await screen.findByText('Paroles corrigées')).toBeInTheDocument();
  });
});
