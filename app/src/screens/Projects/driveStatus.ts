import {useQuery, type UseQueryResult} from '@tanstack/react-query';
import type {DriveStatus} from '../../../shared/types.ts';
import {api, type HttpError} from '../../api/client.ts';

export const useProjectDrive = (slug: string, enabled = true): UseQueryResult<DriveStatus, HttpError> =>
  useQuery({queryKey: ['project-drive', slug], queryFn: ({signal}) => api<DriveStatus>(`/projects/${encodeURIComponent(slug)}/drive`, {signal}), enabled, staleTime: 0});

export type DriveRow = 'checking' | 'ok' | 'missing' | 'unknown';
/** State of one "done" version in the delete dialog. `unknown` = the Drive check itself failed. */
export function driveRow(d: DriveStatus | undefined, version: string): DriveRow {
  if (!d) return 'checking';
  if (d.error) return 'unknown';
  return d.versions[version] === 'ok' ? 'ok' : 'missing';
}
