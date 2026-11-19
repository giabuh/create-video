import {useEffect, useRef, useState} from 'react';
import {useJobs} from '../../api/events.ts';
import {useUploads, type UploadItem} from '../../api/upload.ts';
import {Button, ProgressBar, fmtPct} from '../../ui/index.ts';
import s from './Library.module.css';

function Row({it, state, pct, err}: {it: UploadItem; state: 'up' | 'ingest' | 'done' | 'error'; pct: number | null; err?: string}): React.JSX.Element | null {
  const [fade, setFade] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (state !== 'done') return;
    const a = setTimeout(() => setFade(true), 3600); // rows fade out 4 s after success
    const b = setTimeout(() => setGone(true), 4000);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [state]);
  if (gone) return null;
  const text = state === 'up' ? `Đang tải lên ${fmtPct(it.progress)}` : state === 'ingest' ? (pct == null ? 'Đang chuẩn hoá…' : `Đang chuẩn hoá ${fmtPct(pct)}`)
    : state === 'done' ? (it.target !== 'media' ? 'Đã tải lên' : 'Xong · cần mô tả') : state === 'error' ? err ?? it.error ?? 'Lỗi' : '';
  const value = state === 'up' ? it.progress : state === 'ingest' ? pct : state === 'done' ? 1 : state === 'error' ? 1 : 0;
  return (
    <div className={`${s.up} ${fade ? s.fade : ''}`} role={state === 'error' ? 'alert' : undefined}>
      <span className={s.upName} title={it.file.name}>{it.file.name}</span>
      <div className={s.upBar}><ProgressBar value={value} size="sm" tone={state === 'done' ? 'success' : state === 'error' ? 'danger' : 'info'} label={`${it.file.name}: ${text}`} /></div>
      <span className={`${s.upState} ${state === 'done' ? s.ok : state === 'error' ? s.bad : ''}`}>{text}</span>
    </div>
  );
}

/** Per-file rows: upload % first, then the running ingest job's progress, then "done". */
export function UploadRows({target}: {target: 'media' | 'music' | 'sfx'}): React.JSX.Element | null {
  const {items, clear} = useUploads();
  const jobs = useJobs().filter((j) => j.kind === 'ingest');
  const active = jobs.find((j) => j.state === 'running' || j.state === 'queued');
  const last = jobs.find((j) => j.state === 'done'); // jobs are newest first
  const newest = jobs[0];
  const seen = useRef(new Map<string, number>()); // when each upload was first seen finished
  const mine = items.filter((i) => i.target === target);
  mine.forEach((i) => { if (i.state === 'done' && !seen.current.has(i.id)) seen.current.set(i.id, Date.now()); });
  if (!mine.length) return null;
  const rowState = (i: UploadItem) => {
    if (i.state === 'error') return 'error' as const;
    if (i.state === 'uploading') return 'up' as const;
    if (target !== 'media') return 'done' as const;
    if (active) return 'ingest' as const;
    const t0 = (i.doneAt ?? seen.current.get(i.id) ?? 0) - 500; // doneAt: the screen may not have been open when the upload finished
    if (newest && newest.state !== 'done' && (newest.endedAt ?? 0) >= t0) return 'error' as const;
    return last?.endedAt && last.endedAt >= t0 ? 'done' as const : 'ingest' as const;
  };
  const hasErr = mine.some((i) => i.state === 'error');
  return (
    <div className={s.ups} aria-live="polite">
      {mine.map((i) => <Row key={i.id} it={i} state={rowState(i)} pct={active?.progress ?? null} err={newest?.error ?? 'Nhập media không thành công'} />)}
      {hasErr && <div><Button size="sm" variant="ghost" onClick={clear}>Xoá thông báo lỗi</Button></div>}
    </div>
  );
}
