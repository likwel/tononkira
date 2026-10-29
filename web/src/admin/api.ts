import { API_BASE, ApiError, buildQuery } from '../lib/api';
import { clearAdminToken, getAdminToken } from './auth';
import type {
  AdminPage,
  CrawlSong,
  CrawlSort,
  CrawlStatus,
  JobOptions,
  JobRecord,
  JobSnapshot,
  JobType,
  ListPage,
  ListPageRefresh,
  Overview,
  RefreshResult,
} from './types';

type Params = Record<string, string | number | null | undefined>;

async function call<T>(
  path: string,
  { method = 'GET', body, params, token = getAdminToken() }: {
    method?: 'GET' | 'POST';
    body?: unknown;
    params?: Params;
    token?: string | null;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/admin${path}${buildQuery(params)}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Impossible de joindre l'API. Est-elle démarrée ?");
  }
  const json = (await response.json().catch(() => null)) as
    | { error?: { message?: string; details?: { field: string; message: string }[] } }
    | null;
  if (!response.ok) {
    // Jeton enregistré refusé : retour à l'écran de connexion.
    if (response.status === 401 && token === getAdminToken()) clearAdminToken();
    const details = json?.error?.details?.map((d) => `${d.field} : ${d.message}`).join(' ; ');
    const message = json?.error?.message ?? `Erreur ${response.status}`;
    throw new ApiError(response.status, details ? `${message} (${details})` : message);
  }
  return json as T;
}

export const adminApi = {
  /** Vérifie un jeton avant de l'enregistrer. */
  checkToken: (token: string) => call<{ data: { ok: true } }>('/session', { token }),

  overview: () => call<{ data: Overview }>('/overview').then((r) => r.data),

  pages: (params: { page?: number; status?: CrawlStatus; q?: string; sort?: CrawlSort }) =>
    call<AdminPage<CrawlSong>>('/pages', { params }),

  refreshPage: (url: string) =>
    call<{ data: RefreshResult }>('/pages/refresh', { method: 'POST', body: { url } }).then(
      (r) => r.data,
    ),

  listPages: (params: { page?: number }) => call<AdminPage<ListPage>>('/list-pages', { params }),

  refreshListPage: (page: number) =>
    call<{ data: ListPageRefresh }>(`/list-pages/${page}/refresh`, { method: 'POST' }).then(
      (r) => r.data,
    ),

  jobs: (params: { page?: number; limit?: number }) => call<AdminPage<JobRecord>>('/jobs', { params }),

  job: (id: number) => call<{ data: JobRecord | JobSnapshot }>(`/jobs/${id}`).then((r) => r.data),

  startJob: (type: JobType, options: JobOptions) =>
    call<{ data: JobSnapshot }>('/jobs', { method: 'POST', body: { type, options } }).then(
      (r) => r.data,
    ),

  cancelJob: (id: number) => call<unknown>(`/jobs/${id}/cancel`, { method: 'POST' }),
};
