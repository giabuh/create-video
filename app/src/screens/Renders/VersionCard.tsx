import {useEffect, useRef, useState} from 'react';
import {Pause, Play, FolderOpen, Trash2} from 'lucide-react';
import type {Job, VersionInfo} from '../../../shared/types.ts';
import {Button, Chip, IconButton, ProgressBar, Slider, Tooltip, fmtBytes, fmtPct} from '../../ui/index.ts';
import type {DriveRow} from './driveRow.ts';
import s from './Renders.module.css';

const QUALITY = {draft: 'Nháp 0,5×', final: '1080×1920'} as const;
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function VersionCard({v, register, row, onApprove, onRetry, onCancel, onDelete, onOpenFolder}: {
  v: VersionInfo; register(name: string, el: HTMLVideoElement | null): void; row: DriveRow; onApprove(): void; onRetry(): void; onCancel?(job: Job): void; onDelete(): void; onOpenFolder(): void;
}): React.JSX.Element {
  const p = v.published;
  const blocked = v.approved && p?.state !== 'done';
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  useEffect(() => { register(v.name, ref.current); return () => register(v.name, null); }, [v.name, register]);
  const toggle = () => { const el = ref.current; if (el) void (el.paused ? el.play() : el.pause()); };

  return (
    <article className={s.card} aria-label={v.name}>
      <div className={`${s.row} ${s.head}`}>
        <h2 className={s.name}>{v.name}</h2>
        {v.approved && <Chip tone="success">Đã duyệt</Chip>}
        {v.kind === 'draft' && <Chip>{QUALITY.draft}</Chip>}
      </div>
      <DriveStatusRow row={row} approved={v.approved} onRetry={onRetry} onCancel={onCancel} />
      <div className={s.frame}>
        <video ref={ref} src={`/${v.file}`} preload="metadata" playsInline onClick={toggle}
          onLoadedMetadata={(e) => { setDur(e.currentTarget.duration); setState('ready'); }}
          onError={() => setState('error')}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} />
        {state === 'loading' && <div className={s.shimmer} aria-hidden />}
        {state === 'error' && <div className={s.missing}><b>{v.name}</b><span>Không mở được file video</span></div>}
        {state === 'ready' && (
          <div className={s.ctrl}>
            <IconButton label={`${playing ? 'Tạm dừng' : 'Phát'} ${v.name}`} size="sm" icon={playing ? <Pause size={16} /> : <Play size={16} />} onClick={toggle} />
            <Slider aria-label={`Tua ${v.name}`} min={0} max={dur || 1} step={0.05} value={t} format={clock}
              onChange={(x) => { if (ref.current) ref.current.currentTime = x; setT(x); }} />
            <span className={s.time}>{clock(t)} / {clock(dur)}</span>
          </div>
        )}
      </div>
      <dl className={s.meta}>
        <dt>Ngày</dt><dd>{new Date(v.mtime).toLocaleString('vi-VN', {dateStyle: 'short', timeStyle: 'short'})}</dd>
        <dt>Chất lượng</dt><dd>{v.kind ? QUALITY[v.kind] : '—'}</dd>
        <dt>Dung lượng</dt><dd>{fmtBytes(v.bytes)}</dd>
        <dt>Snapshot</dt><dd>{v.hasSnapshot ? 'Có' : 'Không'}</dd>
      </dl>
      <div className={s.actions}>
        {v.kind === 'draft' ? <span className={s.muted}>Bản nháp cũ — không duyệt được</span>
          : <Button variant="primary" size="sm" disabled={v.approved} onClick={onApprove}>{v.approved ? 'Đã duyệt' : 'Duyệt bản này'}</Button>}
        <IconButton label="Mở thư mục chứa file" variant="secondary" icon={<FolderOpen size={18} />} onClick={onOpenFolder} />
        <IconButton label={blocked ? 'Đẩy lên Drive trước khi xoá' : 'Xoá bản này'} variant="secondary" icon={<Trash2 size={18} />} disabled={blocked} onClick={onDelete} />
      </div>
    </article>
  );
}

function DriveStatusRow({row, approved, onRetry, onCancel}: {row: DriveRow; approved: boolean; onRetry(): void; onCancel?(job: Job): void}): React.JSX.Element {
  const retry = (label: string) => <Button size="sm" variant="secondary" onClick={onRetry}>{label}</Button>;
  let line: React.ReactNode; let extra: React.ReactNode = null;
  switch (row.kind) {
    case 'local': line = <><span className={s.muted}>Chỉ trên máy</span>{approved && retry('Đẩy lên Drive')}</>; break;
    case 'checking': line = <><Chip>Đã lên Drive · đang kiểm tra…</Chip><span className={s.fname} title={row.name}>{row.name}</span></>; break; // show the record at once; Drive can take seconds to answer
    case 'ok': line = <><Chip tone="success">{row.verified ? 'Có trên Drive ✓' : 'Đã đẩy lên Drive'}</Chip><span className={s.fname} title={row.name}>{row.name}</span></>; break;
    case 'bad': line = <><Chip tone="danger">Không thấy trên Drive</Chip>{retry('Đẩy lại')}</>; break;
    case 'failed': line = <><Tooltip content={row.error}><span className={s.err}>{row.error}</span></Tooltip>{retry('Thử lại')}</>; break;
    case 'deleting': line = <span className={s.muted}>{row.job.step || 'Đang xoá trên Drive…'}</span>; extra = <ProgressBar size="sm" value={row.job.progress} tone="danger" label="Đang xoá trên Drive" />; break;
    case 'uploading': {
      const j = row.job;
      line = <><span className={s.muted}>{j?.step || 'Đang tải lên Drive…'}{j?.progress != null ? ` · ${fmtPct(j.progress)}` : ''}</span>{j?.cancellable && onCancel && <Button size="sm" variant="ghost" onClick={() => onCancel(j)}>Huỷ</Button>}</>;
      extra = <ProgressBar size="sm" value={j?.progress ?? null} tone="info" label="Đang tải lên Drive" />;
    }
  }
  return <div className={s.status}><div className={s.statusLine}>{line}</div>{extra}</div>;
}
