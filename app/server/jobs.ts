import type {EventBus} from './events.ts';
import type {Job, JobKind, Json} from '../shared/types.ts';

export type JobCtx = {progress(p: number | null, step?: string): void; log(line: string): void; signal: AbortSignal};
export type JobSpec = {kind: JobKind; lane: Job['lane']; label: string; project?: string | null; cancellable: boolean; run(ctx: JobCtx): Promise<Json | void>};

const MAX_LOG = 200;
const KEEP_FINISHED = 50;
const EMIT_EVERY_MS = 250;

type Entry = {job: Job; spec: JobSpec; ac: AbortController; lastEmit: number};

export class JobQueue {
  #bus: EventBus;
  #entries: Entry[] = [];            // oldest first
  #lanes = new Map<Job['lane'], {busy: boolean; queue: Entry[]}>();
  #seq = 0;

  constructor(bus: EventBus) { this.#bus = bus; }

  enqueue(spec: JobSpec): Job {
    const job: Job = {
      id: `j${Date.now().toString(36)}${(++this.#seq).toString(36)}`, kind: spec.kind, lane: spec.lane, project: spec.project ?? null,
      label: spec.label, state: 'queued', progress: null, step: '', startedAt: null, endedAt: null,
      etaSeconds: null, log: [], result: null, error: null, cancellable: spec.cancellable,
    };
    const e: Entry = {job, spec, ac: new AbortController(), lastEmit: 0};
    this.#entries.push(e);
    let lane = this.#lanes.get(spec.lane);
    if (!lane) this.#lanes.set(spec.lane, lane = {busy: false, queue: []});
    lane.queue.push(e);
    this.#emit(e, true);
    void this.#pump(spec.lane);
    return this.#snap(job);
  }

  list(): Job[] { return this.#entries.map(e => this.#snap(e.job)).reverse(); }
  get(id: string): Job | undefined { const e = this.#find(id); return e && this.#snap(e.job); }
  running(kind?: JobKind): Job[] { return this.#entries.filter(e => e.job.state === 'running' && (!kind || e.job.kind === kind)).map(e => this.#snap(e.job)); }

  cancel(id: string): Job {
    const e = this.#find(id);
    if (!e) throw new Error('job not found');
    if (e.job.state === 'queued') {
      const lane = this.#lanes.get(e.job.lane)!;
      lane.queue = lane.queue.filter(x => x !== e);
      this.#finish(e, 'cancelled');
    } else if (e.job.state === 'running' && e.job.cancellable) {
      e.ac.abort();
    } else throw new Error('not cancellable');
    return this.#snap(e.job);
  }

  #find(id: string) { return this.#entries.find(e => e.job.id === id); }
  #snap(j: Job): Job { return {...j, log: [...j.log]}; }
  #emit(e: Entry, force: boolean): void {
    const now = Date.now();
    if (!force && now - e.lastEmit < EMIT_EVERY_MS) return;
    e.lastEmit = now;
    this.#bus.emit({type: 'job', job: this.#snap(e.job)});
  }

  #finish(e: Entry, state: 'done' | 'failed' | 'cancelled'): void {
    e.job.state = state; e.job.endedAt = Date.now();
    if (state === 'done') e.job.progress = 1;
    e.job.etaSeconds = null;
    this.#emit(e, true);
    const finished = this.#entries.filter(x => x.job.endedAt != null);
    for (const old of finished.slice(0, Math.max(0, finished.length - KEEP_FINISHED))) this.#entries.splice(this.#entries.indexOf(old), 1);
  }

  async #pump(laneName: Job['lane']): Promise<void> {
    const lane = this.#lanes.get(laneName)!;
    if (lane.busy) return;
    lane.busy = true;
    try {
      for (let e = lane.queue.shift(); e; e = lane.queue.shift()) await this.#run(e);
    } finally { lane.busy = false; }
  }

  async #run(e: Entry): Promise<void> {
    const {job} = e;
    job.state = 'running'; job.startedAt = Date.now();
    this.#emit(e, true);
    const ctx: JobCtx = {
      signal: e.ac.signal,
      log: line => { job.log.push(line); if (job.log.length > MAX_LOG) job.log.splice(0, job.log.length - MAX_LOG); },
      progress: (p, step) => {
        job.progress = p;
        if (step !== undefined) job.step = step;
        job.etaSeconds = p != null && p >= 0.05 && job.startedAt ? Math.round(((Date.now() - job.startedAt) / 1000) * (1 - p) / p) : null;
        this.#emit(e, false);
      },
    };
    try {
      const res = await e.spec.run(ctx);
      job.result = (res ?? null) as Json | null;
      this.#finish(e, e.ac.signal.aborted ? 'cancelled' : 'done');
    } catch (err) {
      if (e.ac.signal.aborted) this.#finish(e, 'cancelled');
      else { job.error = err instanceof Error ? err.message : String(err); this.#finish(e, 'failed'); }
    }
  }
}
