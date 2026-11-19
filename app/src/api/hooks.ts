import {useMutation, useQuery, useQueryClient, type QueryClient, type UseMutationResult, type UseQueryResult} from '@tanstack/react-query';
import type {
  BrandFile, BrandSummary, Config, Job, Json, LibraryEntry, LibraryResponse, MusicFile, PreviewResult, ProjectDetail, ProjectMeta,
  ProjectSummary, Tries, Versioned, VoiceInfo,
} from '../../shared/types.ts';
import {toast} from '../ui/index.ts';
import {api, type HttpError} from './client.ts';

export const qk = {
  projects: ['projects'], project: (slug: string) => ['project', slug] as const, library: ['library'], music: ['music'], voices: ['voices'],
  tries: ['tries'], config: ['config'], brands: ['brands'], templates: ['templates'], motion: ['motion'], jobs: ['jobs'],
} as const;

const useGet = <T>(key: readonly unknown[], path: string): UseQueryResult<T> => useQuery({queryKey: key, queryFn: ({signal}) => api<T>(path, {signal})});
const enc = encodeURIComponent;
const post = <T, V = void>(path: (v: V) => string, body?: (v: V) => unknown) => (v: V) => api<T>(path(v), {method: 'POST', body: body?.(v)});
const invalidate = (qc: QueryClient, ...keys: readonly (readonly unknown[])[]) => Promise.all(keys.map((queryKey) => qc.invalidateQueries({queryKey})));

export const useProjects = () => useGet<ProjectSummary[]>(qk.projects, '/projects');
export const useProject = (slug: string) => useGet<ProjectDetail>(qk.project(slug), `/projects/${enc(slug)}`);

export function useCreateProject(): UseMutationResult<ProjectSummary, HttpError, {name: string; template?: string; brand?: string; voice?: string; targetSeconds?: number}> {
  const qc = useQueryClient();
  return useMutation({mutationFn: (b) => api('/projects', {method: 'POST', body: b}), onSuccess: () => invalidate(qc, qk.projects)});
}
export function usePreview(slug: string): UseMutationResult<PreviewResult, HttpError, void> {
  return useMutation({mutationFn: post(() => `/projects/${enc(slug)}/preview`)});
}
export function useStartVoice(slug: string): UseMutationResult<Job, HttpError, void> {
  return useMutation({mutationFn: post(() => `/projects/${enc(slug)}/voice`)});
}
export function useStartRender(slug: string): UseMutationResult<Job, HttpError, void> {
  return useMutation({mutationFn: post(() => `/projects/${enc(slug)}/render`, () => ({}))});
}
export function useApprove(slug: string): UseMutationResult<{meta: ProjectMeta; commit: string | null; job: Job}, HttpError, {version: string; name: string}> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: post((_v: {version: string; name: string}) => `/projects/${enc(slug)}/approve`, (b) => b),
    onSuccess: () => invalidate(qc, qk.project(slug), qk.projects),
  });
}

export const useLibrary = () => useGet<LibraryResponse>(qk.library, '/library');

export function useSaveLibraryEntry(): UseMutationResult<{mtime: number}, HttpError, {name: string; entry: LibraryEntry; baseMtime: number}, {prev: LibraryResponse | undefined}> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({name, entry, baseMtime}) => api(`/library/${enc(name)}`, {method: 'PUT', body: {entry, baseMtime}}),
    onMutate: async ({name, entry}) => {
      await qc.cancelQueries({queryKey: qk.library});
      const prev = qc.getQueryData<LibraryResponse>(qk.library);
      if (prev) qc.setQueryData<LibraryResponse>(qk.library, {...prev, data: {...prev.data, [name]: entry}});
      return {prev};
    },
    onSuccess: ({mtime}) => qc.setQueryData<LibraryResponse>(qk.library, (d) => d && {...d, mtime}),
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.library, ctx.prev);
      toast(e.status === 409 ? {title: 'File vừa được sửa bên ngoài — đã tải lại', tone: 'info'} : e.status === 423 ? {title: 'Đang nạp media vào thư viện — thử lại sau khi xong', tone: 'info'} : {title: 'Không lưu được thư viện', description: e.message, tone: 'error'});
      void invalidate(qc, qk.library);
    },
  });
}
export function useDeleteLibraryEntry(): UseMutationResult<void, HttpError, string> {
  const qc = useQueryClient();
  return useMutation({mutationFn: (name) => api(`/library/${enc(name)}`, {method: 'DELETE'}), onSuccess: () => invalidate(qc, qk.library),
    onError: (e) => toast(e.status === 423 ? {title: 'Đang nạp media vào thư viện — thử lại sau khi xong', tone: 'info'} : {title: 'Không xoá được', description: e.message, tone: 'error'})});
}
export function useStartIngest(): UseMutationResult<Job, HttpError, void> {
  return useMutation({mutationFn: post(() => '/ingest')});
}

export const useMusic = () => useGet<MusicFile[]>(qk.music, '/music');
export const useVoices = () => useGet<VoiceInfo[]>(qk.voices, '/voices');
export const useTries = () => useGet<Tries | null>(qk.tries, '/voices/tries');
export function useStartTry(): UseMutationResult<Job, HttpError, {voice: string; text: string; variants: Json[]}> {
  return useMutation({mutationFn: (b) => api('/voices/try', {method: 'POST', body: b})});
}

export const useConfig = () => useGet<Versioned<Config>>(qk.config, '/config');
export function useSaveConfig(): UseMutationResult<{mtime: number}, HttpError, {config: Config; baseMtime: number}> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b) => api('/config', {method: 'PUT', body: b}),
    onSuccess: ({mtime}, {config}) => qc.setQueryData<Versioned<Config>>(qk.config, {data: config, mtime}),
  });
}

export const useBrands = () => useGet<BrandSummary[]>(qk.brands, '/brands');
export function useSaveBrand(): UseMutationResult<{mtime: number}, HttpError, {id: string; brand: BrandFile; baseMtime: number}> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({id, brand, baseMtime}) => api(`/brands/${enc(id)}`, {method: 'PUT', body: {brand, baseMtime}}),
    onSuccess: ({mtime}, {id, brand}) => qc.setQueryData<BrandSummary[]>(qk.brands, (l) => l?.map((b) => (b.id === id ? {...b, brand, mtime} : b))),
  });
}
export function useCreateBrand(): UseMutationResult<BrandSummary, HttpError, string> {
  const qc = useQueryClient();
  return useMutation({mutationFn: (name) => api('/brands', {method: 'POST', body: {name}}), onSuccess: () => invalidate(qc, qk.brands)});
}

export const useTemplates = () => useGet<string[]>(qk.templates, '/templates');
export const useMotionNames = () => useGet<string[]>(qk.motion, '/motion');

export function useCancelJob(): UseMutationResult<Job, HttpError, string> {
  return useMutation({mutationFn: (id) => api(`/jobs/${enc(id)}/cancel`, {method: 'POST'})});
}
export function useOpenFolder(): UseMutationResult<void, HttpError, string> {
  return useMutation({mutationFn: (path) => api('/open', {method: 'POST', body: {path}})});
}

export function usePublish(slug: string): UseMutationResult<Job, HttpError, {version: string; name: string}> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: post((_v: {version: string; name: string}) => `/projects/${enc(slug)}/publish`, (b) => b),
    onSettled: () => invalidate(qc, qk.project(slug), qk.projects),
  });
}
export function useDeleteRender(slug: string): UseMutationResult<{driveError?: string}, HttpError, {version: string; drive: boolean}> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({version, drive}) => api(`/projects/${enc(slug)}/renders/${enc(version)}?drive=${drive ? 1 : 0}`, {method: 'DELETE'}),
    onSettled: () => invalidate(qc, qk.project(slug), qk.projects),
  });
}

export function useDeleteProject(slug: string): UseMutationResult<Job, HttpError, {upload?: string[]} | void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b) => api(`/projects/${enc(slug)}`, {method: 'DELETE', body: b ?? undefined}),
    onSettled: () => invalidate(qc, qk.project(slug), qk.projects),
  });
}
export function useCancelDelete(slug: string): UseMutationResult<{ok: true}, HttpError, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: post(() => `/projects/${enc(slug)}/delete-cancel`),
    onSettled: () => invalidate(qc, qk.project(slug), qk.projects),
  });
}
