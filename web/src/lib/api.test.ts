import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, buildQuery, songPath } from './api';

afterEach(() => vi.unstubAllGlobals());

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('buildQuery', () => {
  it('ignore les valeurs vides', () => {
    expect(buildQuery({ q: 'tiako', page: 2, letter: undefined, sort: '' })).toBe(
      '?q=tiako&page=2',
    );
    expect(buildQuery({})).toBe('');
  });
});

describe('api', () => {
  it('appelle /api/songs avec les paramètres et renvoie le corps', async () => {
    const fetchMock = stubFetch(
      Response.json({ data: [], meta: { page: 2, limit: 24, total: 0, totalPages: 1 } }),
    );
    const result = await api.songs({ page: 2, sort: 'popular' });
    expect(fetchMock).toHaveBeenCalledWith('/api/songs?page=2&sort=popular', expect.anything());
    expect(result.meta.page).toBe(2);
  });

  it("encode les segments d'URL", async () => {
    const fetchMock = stubFetch(Response.json({ data: {} }));
    await api.song('a b', 'c/d');
    expect(fetchMock).toHaveBeenCalledWith('/api/songs/a%20b/c%2Fd', expect.anything());
    expect(songPath({ artistSlug: 'a b', slug: 'c' })).toBe('/hira/a%20b/c');
  });

  it("lève une ApiError avec le message de l'API", async () => {
    stubFetch(Response.json({ error: { message: 'Chanson introuvable' } }, { status: 404 }));
    await expect(api.song('x', 'y')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Chanson introuvable',
    });
  });

  it('transforme une panne réseau en ApiError lisible', async () => {
    stubFetch(new TypeError('Failed to fetch'));
    const error = await api.stats().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});
