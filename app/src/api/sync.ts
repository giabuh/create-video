import {useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult} from '@tanstack/react-query';
import type {Job, SyncStatus} from '../../shared/types.ts';
import {api, type HttpError} from './client.ts';

export const syncKey = ['sync-status'] as const;

export const useSyncStatus = (enabled: boolean): UseQueryResult<SyncStatus, HttpError> =>
  useQuery({queryKey: syncKey, queryFn: ({signal}) => api<SyncStatus>('/sync/status', {signal}), enabled, staleTime: 0});

export function useStartSync(dir: 'push' | 'pull'): UseMutationResult<Job, HttpError, void> {
  return useMutation({mutationFn: () => api<Job>(`/sync/${dir}`, {method: 'POST'})});
}

/** Puts a finished sync job's result (a fresh SyncStatus) into the status query. */
export function useApplySyncResult(): (job: Job) => void {
  const qc = useQueryClient();
  return (job) => { if (job.state === 'done' && job.result) qc.setQueryData(syncKey, job.result as unknown as SyncStatus); };
}
