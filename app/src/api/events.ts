import {useEffect, useSyncExternalStore} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import type {Job, ServerEvent, WorkerStatus} from '../../shared/types.ts';
import {toast} from '../ui/index.ts';
import {onChatEvent, resetChatDrafts} from './chat.ts';
import {api} from './client.ts';
import {qk} from './hooks.ts';

type Connection = 'open' | 'connecting' | 'lost';

// Module-level stores: SSE events outlive any one screen.
let jobs = new Map<string, Job>();
let jobList: Job[] = [];
let worker: WorkerStatus = {state: 'idle', device: null, error: null};
let connection: Connection = 'connecting';
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const setJobs = () => {
  jobList = [...jobs.values()].sort((a, b) => (b.startedAt ?? b.endedAt ?? Infinity) - (a.startedAt ?? a.endedAt ?? Infinity)).slice(0, 50);
  emit();
};

export const useJobs = (): Job[] => useSyncExternalStore(subscribe, () => jobList);
export const useJob = (id: string | null): Job | undefined => useJobs().find((j) => j.id === id);
export const useWorkerStatus = (): WorkerStatus => useSyncExternalStore(subscribe, () => worker);
export const useConnection = (): Connection => useSyncExternalStore(subscribe, () => connection);

// Toast "Xem" actions navigate through the router, which App registers (events.ts cannot import it).
let navigate: (to: string) => void = (to) => location.assign(to);
export const setNavigate = (fn: (to: string) => void): void => { navigate = fn; };

/** Maps a changed repo-relative path to the query keys it affects. */
export function keysForPath(path: string): (readonly unknown[])[] {
  const p = path.split('/');
  switch (p[0]) {
    case 'projects': return p[1] ? [qk.project(p[1]), qk.projects] : [qk.projects];
    case 'library': return [qk.library];
    case 'music': return [qk.music];
    case 'brands': return [qk.brands];
    case 'config.json': return [qk.config, qk.voices];
    case 'voices': return [p[1] === 'tries' ? qk.tries : qk.voices];
    case 'studio': return p[1] === 'src' ? [qk.motion, qk.templates] : [];
    default: return [];
  }
}

const TERMINAL = new Set(['done', 'failed', 'cancelled']);

/** Server snapshot wins. Local live jobs it no longer lists are dropped; local finished ones stay. `finished` = jobs that ended while we were away. */
export function mergeJobs(local: Map<string, Job>, snapshot: Job[]): {next: Map<string, Job>; finished: {job: Job; prev: Job}[]} {
  const next = new Map(snapshot.map((j) => [j.id, j] as const));
  const finished: {job: Job; prev: Job}[] = [];
  for (const [id, prev] of local) {
    const job = next.get(id);
    if (!job) { if (TERMINAL.has(prev.state)) next.set(id, prev); }
    else if (!TERMINAL.has(prev.state) && TERMINAL.has(job.state)) finished.push({job, prev});
  }
  return {next, finished};
}
function toastFinished(job: Job, prev: Job | undefined) {
  if (!TERMINAL.has(job.state) || (prev && TERMINAL.has(prev.state))) return;
  if (job.state === 'failed') return toast({title: `${job.label} — thất bại`, description: [job.error, ...job.log.slice(-20)].filter(Boolean).join('\n'), tone: 'error'});
  if (job.state !== 'done') return;
  const r = job.result ?? {};
  if (job.kind === 'render') {
    const version = typeof r.version === 'string' ? r.version : null;
    toast({title: version ? `Đã render ${version}` : 'Đã render xong', tone: 'success', action: job.project ? {label: 'Xem', onClick: () => navigate(`/p/${encodeURIComponent(job.project!)}/renders`)} : undefined});
  } else if (job.kind === 'voice') toast({title: 'Đã tạo giọng', tone: 'success'});
  else if (job.kind === 'ingest') toast({title: `Đã nhập ${Array.isArray(r.added) ? r.added.length : 0} file`, tone: 'success'});
}

function onEvent(ev: ServerEvent, onChanged: (path: string) => void) {
  if (ev.type === 'changed') onChanged(ev.path);
  else if (ev.type === 'job') {
    const prev = jobs.get(ev.job.id);
    jobs = new Map(jobs).set(ev.job.id, ev.job);
    setJobs();
    toastFinished(ev.job, prev);
  } else if (ev.type === 'worker') {
    worker = ev.status;
    emit();
  }
}

export function useServerEvents(): void {
  const qc = useQueryClient();
  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    let everOpened = false;
    let stopped = false;
    const pending = new Map<string, readonly unknown[]>();
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    const onChanged = (path: string) => { // coalesce bursts of file events into one invalidation
      keysForPath(path).forEach((k) => pending.set(JSON.stringify(k), k));
      flushTimer ??= setTimeout(() => {
        flushTimer = undefined;
        const keys = [...pending.values()]; pending.clear();
        keys.forEach((queryKey) => void qc.invalidateQueries({queryKey}));
      }, 60);
    };

    const seed = async () => { // known jobs are seeded without toasts: only live transitions toast
      const [list, health] = await Promise.all([api<Job[]>('/jobs'), api<{worker: WorkerStatus}>('/health')]).catch(() => [null, null] as const);
      if (list) {
        const m = mergeJobs(jobs, list);
        jobs = m.next; setJobs();
        m.finished.forEach(({job, prev}) => toastFinished(job, prev));
      }
      if (health) { worker = health.worker; emit(); }
    };

    const connect = () => {
      if (stopped) return;
      es = new EventSource('/api/events');
      es.onopen = () => {
        delay = 1000;
        const reconnected = everOpened;
        everOpened = true;
        connection = 'open';
        emit();
        void seed();
        if (reconnected) { resetChatDrafts(); void qc.invalidateQueries(); } // anything may have changed while we were away
      };
      es.onmessage = (m) => {
        try {
          const ev = JSON.parse(m.data) as ServerEvent;
          if (ev.type === 'chat' || ev.type === 'chatBusy') onChatEvent(ev, qc);
          else onEvent(ev, onChanged);
        } catch { /* ignore malformed frame */ }
      };
      es.onerror = () => {
        es?.close();
        connection = 'lost';
        emit();
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 10_000);
      };
    };
    connect();
    return () => { stopped = true; es?.close(); clearTimeout(timer); clearTimeout(flushTimer); };
  }, [qc]);
}
