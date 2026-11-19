import {useEffect, useRef, useState} from 'react';
import {Pause, Play, FolderOpen} from 'lucide-react';
import type {VersionInfo} from '../../../shared/types.ts';
import {Button, Chip, IconButton, Slider, fmtBytes} from '../../ui/index.ts';
import s from './Renders.module.css';

const QUALITY = {draft: 'Nháp 0,5×', final: '1080×1920'} as const;
const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function VersionCard({v, register, onApprove, onOpenFolder}: {
  v: VersionInfo; register(name: string, el: HTMLVideoElement | null): void; onApprove(): void; onOpenFolder(): void;
}): React.JSX.Element {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  useEffect(() => { register(v.name, ref.current); return () => register(v.name, null); }, [v.name, register]);
  const toggle = () => { const el = ref.current; if (el) void (el.paused ? el.play() : el.pause()); };

  return (
    <article className={s.card} aria-label={v.name}>
      <div className={s.row}>
        <h2 className={s.name}>{v.name}</h2>
        {v.approved && <Chip tone="success">Đã duyệt</Chip>}
      </div>
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
        <Button variant="primary" size="sm" disabled={v.approved} onClick={onApprove}>{v.approved ? 'Đã duyệt' : 'Duyệt bản này'}</Button>
        <IconButton label="Mở thư mục chứa file" variant="secondary" icon={<FolderOpen size={18} />} onClick={onOpenFolder} />
      </div>
    </article>
  );
}
