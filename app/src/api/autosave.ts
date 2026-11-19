import {useEffect, useState, useSyncExternalStore} from 'react';
import type {Versioned} from '../../shared/types.ts';
import {toast} from '../ui/Toast.tsx';
import {HttpError} from './client.ts';

export type SaveState = {state: 'idle' | 'saving' | 'saved' | 'error' | 'conflict'; savedAt: number | null; error: string | null};
type Snapshot = SaveState & {dirty: boolean};
type Opts<T> = {
  save(v: T, baseMtime: number): Promise<number>;
  onSaved?(mtime: number): void;
  onConflict?(current: Versioned<T>): void;
  delay?: number;
};

// Debounced single-flight saver. Values are compared by reference, so callers pass immutable state.
export class AutosaveController<T> {
  opts: Opts<T>;
  private base: number;
  private saved: T;
  private pending: T;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> | null = null;
  private failed = false;
  private snap: Snapshot = {state: 'idle', savedAt: null, error: null, dirty: false};
  private subs = new Set<() => void>();

  constructor(initial: T, baseMtime: number, opts: Opts<T>) {
    this.saved = this.pending = initial;
    this.base = baseMtime;
    this.opts = opts;
  }

  subscribe = (f: () => void): (() => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  getSnapshot = (): Snapshot => this.snap;
  get baseMtime(): number { return this.base; }
  private set(p: Partial<Snapshot>) {
    this.snap = {...this.snap, dirty: this.pending !== this.saved, ...p};
    this.subs.forEach((f) => f());
  }

  change(v: T): void {
    if (v === this.saved) { // reverted to the saved value: nothing left to write
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.pending = v;
      this.set({state: this.snap.savedAt ? 'saved' : 'idle', error: null});
      return;
    }
    if (v === this.pending) return;
    this.pending = v;
    this.set({});
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.run(); }, this.opts.delay ?? 500);
  }

  /** The file changed outside this controller (reload after conflict): adopt it without saving. */
  reset(v: T, baseMtime: number): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.saved = this.pending = v;
    this.base = baseMtime;
    this.set({state: 'idle', error: null});
  }

  retry(): Promise<void> { return this.run(); }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.inflight) await this.inflight;
    if (this.pending !== this.saved) await this.run();
  }

  private run(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    return (this.inflight ??= this.loop().finally(() => { this.inflight = null; }));
  }

  private async loop(): Promise<void> {
    do {
      const v = this.pending;
      if (v === this.saved) return;
      this.failed = false;
      this.set({state: 'saving', error: null});
      try {
        const mtime = await this.opts.save(v, this.base);
        this.base = mtime;
        this.saved = v;
        this.set({state: 'saved', savedAt: Date.now(), error: null});
        this.opts.onSaved?.(mtime);
      } catch (e) {
        this.failed = true;
        if (e instanceof HttpError && e.status === 409) {
          this.pending = this.saved; // drop the conflicting edit; the owner reloads the file
          this.set({state: 'conflict', error: null});
          if (this.opts.onConflict) this.opts.onConflict(e.body?.details as Versioned<T>);
          else toast({title: 'File vừa được sửa bên ngoài — đã tải lại', tone: 'info'}); // never lose an edit silently
        } else {
          this.set({state: 'error', error: e instanceof Error ? e.message : String(e)});
        }
      }
    } while (!this.failed && !this.timer && this.pending !== this.saved);
  }
}

export function useAutosave<T>(o: {value: T; baseMtime: number} & Opts<T>): SaveState & {flush(): Promise<void>; retry(): Promise<void>; dirty: boolean} {
  const [ctl] = useState(() => new AutosaveController(o.value, o.baseMtime, o));
  ctl.opts = o;
  useEffect(() => {
    if (o.baseMtime !== ctl.baseMtime) ctl.reset(o.value, o.baseMtime);
    else ctl.change(o.value);
  }, [ctl, o.value, o.baseMtime]);
  useEffect(() => () => { void ctl.flush(); }, [ctl]);
  const snap = useSyncExternalStore(ctl.subscribe, ctl.getSnapshot);
  return {...snap, flush: () => ctl.flush(), retry: () => ctl.retry()};
}
