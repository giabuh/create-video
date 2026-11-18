import {useRef, useState} from 'react';
import {Film, Pause, Play} from 'lucide-react';
import s from './VideoThumb.module.css';

export function VideoThumb({src, aspect = '9 / 16', label, playable, contain, children}: {src?: string | null; aspect?: string; label?: string; playable?: boolean; contain?: boolean; children?: React.ReactNode}): React.JSX.Element {
  const [state, setState] = useState<{src?: string | null; v: 'loading' | 'ready' | 'error'}>({v: 'loading'});
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  const v = !src ? 'error' : state.src === src ? state.v : 'loading';
  const mark = (x: 'ready' | 'error') => setState({src, v: x});
  return (
    <div className={`${s.box} ${v === 'ready' ? s.ready : ''}`} style={{'--ar': aspect} as React.CSSProperties}>
      {src && v !== 'error' && (
        <video ref={ref} className={`${s.video} ${contain ? s.contain : ''}`} src={`${src}#t=0.1`} preload="metadata" muted playsInline
          onLoadedData={() => mark('ready')} onError={() => mark('error')} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      )}
      {v === 'loading' && <div className={s.shim} aria-hidden />}
      {v === 'error' && <div className={s.ph}><Film size={22} aria-hidden /><span className={s.name}>{label ?? 'Chưa có video'}</span></div>}
      {playable && v === 'ready' && (
        <button type="button" className={s.play} aria-label={playing ? 'Tạm dừng' : 'Phát'}
          onClick={() => { const el = ref.current; if (el) void (el.paused ? el.play() : el.pause()); }}>
          {!playing && <span><Play size={20} fill="currentColor" aria-hidden /></span>}
          {playing && <span style={{opacity: 0}}><Pause size={20} aria-hidden /></span>}
        </button>
      )}
      {children && <div className={s.over}>{children}</div>}
    </div>
  );
}
