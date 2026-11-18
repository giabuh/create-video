import {useSyncExternalStore} from 'react';
import type {ApiError} from '../../shared/types.ts';
import {api} from './client.ts';

export type UploadItem = {id: string; file: File; target: 'media' | 'music' | 'voice' | 'logo'; state: 'uploading' | 'done' | 'error'; progress: number; savedAs?: string; error?: string};

// Module-level so uploads keep running (and stay visible) when the user navigates away.
let items: UploadItem[] = [];
let seq = 0;
const subs = new Set<() => void>();
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const patch = (id: string, p: Partial<UploadItem>) => { items = items.map((i) => (i.id === id ? {...i, ...p} : i)); subs.forEach((f) => f()); };
const add = (list: UploadItem[]) => { items = [...items, ...list]; subs.forEach((f) => f()); };

const seg = encodeURIComponent;
function urlFor(it: UploadItem, o: {voiceName?: string; brandId?: string}): string | null {
  const f = seg(it.file.name);
  switch (it.target) {
    case 'media': return `/api/upload/${f}`;
    case 'music': return `/api/upload-music/${f}`;
    case 'voice': return o.voiceName ? `/api/upload-voice/${seg(o.voiceName)}/${f}` : null;
    case 'logo': return o.brandId ? `/api/upload-logo/${seg(o.brandId)}/${f}` : null;
  }
}

function put(it: UploadItem, url: string): Promise<void> {
  return new Promise((resolve) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.upload.onprogress = (e) => { if (e.lengthComputable) patch(it.id, {progress: e.loaded / e.total}); };
    x.onerror = () => { patch(it.id, {state: 'error', error: 'Mất kết nối với server'}); resolve(); };
    x.onload = () => {
      let body: (ApiError & {saved?: string; logo?: string}) | null = null;
      try { body = JSON.parse(x.responseText); } catch { /* empty or non-JSON body */ }
      if (x.status >= 200 && x.status < 300) patch(it.id, {state: 'done', progress: 1, savedAs: body?.saved ?? body?.logo});
      else patch(it.id, {state: 'error', error: body?.error ?? `HTTP ${x.status}`});
      resolve();
    };
    x.send(it.file);
  });
}

async function upload(files: File[], target: UploadItem['target'], opts: {voiceName?: string; brandId?: string} = {}): Promise<void> {
  const batch = files.map((file): UploadItem => ({id: `u${++seq}`, file, target, state: 'uploading', progress: 0}));
  add(batch);
  await Promise.all(batch.map((it) => {
    const url = urlFor(it, opts);
    if (!url) { patch(it.id, {state: 'error', error: it.target === 'voice' ? 'Thiếu tên giọng' : 'Thiếu brand'}); return; }
    return put(it, url);
  }));
  if (target === 'media' && batch.some((it) => items.find((i) => i.id === it.id)?.state === 'done')) {
    try { await api('/ingest', {method: 'POST'}); } catch (e) {
      batch.forEach((it) => patch(it.id, {state: 'error', error: `Không nhập được: ${e instanceof Error ? e.message : e}`}));
    }
  }
}

const clear = () => { items = items.filter((i) => i.state === 'uploading'); subs.forEach((f) => f()); };

export function useUploads(): {items: UploadItem[]; upload: typeof upload; clear(): void} {
  return {items: useSyncExternalStore(subscribe, () => items), upload, clear};
}
