import {mkdirSync, watch, type FSWatcher} from 'node:fs';
import path from 'node:path';
import type {EventBus} from './events.ts';
import {rel, repoRoot} from './paths.ts';

const IGNORE_SUFFIX = ['.tmp', '.part', '.raw.wav', '.tmp.wav', '.tmp.mp4'];
const WATCH_DIRS = ['projects', 'library', 'music', 'sfx', 'brands', 'voices', 'studio/src'];

function ignored(relPath: string): boolean {
  if (IGNORE_SUFFIX.some(s => relPath.endsWith(s))) return true;
  return /^projects\/[^/]+\/preview(\/|$)/.test(relPath) || /^voices\/_uploads(\/|$)/.test(relPath);
}

export function startWatcher(bus: EventBus): () => void {
  const root = repoRoot();
  const watchers: FSWatcher[] = [];
  const timers = new Map<string, NodeJS.Timeout>();
  const fire = (abs: string) => {
    const p = rel(abs);
    if (ignored(p)) return;
    clearTimeout(timers.get(p));
    timers.set(p, setTimeout(() => { timers.delete(p); bus.emit({type: 'changed', path: p}); }, 120));
  };
  // a removed dir or inotify limit must not crash the server
  const guarded = (w: FSWatcher) => w.on('error', err => { console.error('watcher error:', err.message); w.close(); });
  for (const d of WATCH_DIRS) {
    const dir = path.join(root, d);
    mkdirSync(dir, {recursive: true});
    watchers.push(guarded(watch(dir, {recursive: true}, (_ev, name) => { if (name) fire(path.join(dir, name.toString())); })));
  }
  watchers.push(guarded(watch(root, (_ev, name) => { if (name?.toString() === 'config.json') fire(path.join(root, 'config.json')); })));
  return () => { watchers.forEach(w => w.close()); timers.forEach(clearTimeout); timers.clear(); };
}
