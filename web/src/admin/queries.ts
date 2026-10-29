import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from './api';
import type { CrawlSort, CrawlStatus, JobOptions, JobType } from './types';

const ADMIN = ['admin'] as const;

/** Vue d'ensemble : rafraîchie toutes les 1,5 s pendant une tâche, sinon toutes les 15 s. */
export function useOverview() {
  return useQuery({
    queryKey: [...ADMIN, 'overview'],
    queryFn: adminApi.overview,
    refetchInterval: (query) => (query.state.data?.job?.status === 'running' ? 1500 : 15_000),
  });
}

export function useCrawlPages(params: {
  page: number;
  status?: CrawlStatus | undefined;
  q?: string | undefined;
  sort: CrawlSort;
}) {
  return useQuery({
    queryKey: [...ADMIN, 'pages', params],
    queryFn: () => adminApi.pages(params),
    placeholderData: keepPreviousData,
  });
}

export function useListPages(page: number) {
  return useQuery({
    queryKey: [...ADMIN, 'list-pages', page],
    queryFn: () => adminApi.listPages({ page }),
    placeholderData: keepPreviousData,
  });
}

export function useJobs(page: number, limit = 20) {
  return useQuery({
    queryKey: [...ADMIN, 'jobs', page, limit],
    queryFn: () => adminApi.jobs({ page, limit }),
    placeholderData: keepPreviousData,
  });
}

export function useJob(id: number | null) {
  return useQuery({
    queryKey: [...ADMIN, 'job', id],
    queryFn: () => adminApi.job(id!),
    enabled: id !== null,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
  });
}

/** Après une action : tout ce qui concerne l'administration et le catalogue est relu. */
function useInvalidate() {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: ADMIN });
    void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== 'admin' });
  };
}

export function useStartJob() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ type, options }: { type: JobType; options: JobOptions }) =>
      adminApi.startJob(type, options),
    onSuccess: invalidate,
  });
}

export function useCancelJob() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: adminApi.cancelJob, onSuccess: invalidate });
}

export function useRefreshPage() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: adminApi.refreshPage, onSuccess: invalidate });
}

export function useRefreshListPage() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: adminApi.refreshListPage, onSuccess: invalidate });
}
