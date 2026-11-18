import {useEffect, useRef, useState} from 'react';
import {Pause, Play} from 'lucide-react';
import {useWaveform} from './waveform.ts';
import s from './AudioPlayer.module.css';

let current: HTMLAudioElement | null = null; // only one player at a time

const mmss = (t: number) => (Number.isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '0:00');

export function AudioPlayer({src, label, bars = 48, compact, accent = 'accent'}: {src: string; label?: string; bars?: number; compact?: boolean; accent?: 'accent' | 'voice' | 'info'}): React.JSX.Element {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  const {peaks, error} = useWaveform(src, bars);

  useEffect(() => { setPlaying(false); setT(0); setDur(0); }, [src]);
  useEffect(() => { const a = audio.current; return () => { a?.pause(); if (current === a) current = null; }; }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      if (current && current !== a) current.pause();
      current = a;
      void a.play().catch(() => setPlaying(false));
    } else a.pause();
  };
  const seek = (frac: number) => { const a = audio.current; if (a && dur) a.currentTime = Math.min(1, Math.max(0, frac)) * dur; };
  const frac = dur ? t / dur : 0;

  return (
    <div className={`${s.root} ${s[accent]} ${compact ? s.compact : ''}`}>
      <audio ref={audio} src={src} preload="metadata"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setT(0); }}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDur(e.currentTarget.duration)} />
      <button type="button" className={s.play} onClick={toggle} aria-label={playing ? 'Tạm dừng' : 'Phát'}>
        {playing ? <Pause size={18} fill="currentColor" aria-hidden /> : <Play size={18} fill="currentColor" aria-hidden />}
      </button>
      {label && !compact && <span className={s.label}>{label}</span>}
      {error ? <span className={`${s.wave} ${s.err}`}>Không đọc được sóng âm</span> : (
        <div
          className={s.wave} role="slider" tabIndex={0} aria-label={label ? `Tua ${label}` : 'Tua'} aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(t)} aria-valuetext={`${mmss(t)} / ${mmss(dur)}`}
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width); }}
          onKeyDown={(e) => {
            const a = audio.current;
            if (!a) return;
            if (e.key === 'ArrowRight') { e.preventDefault(); a.currentTime = Math.min(dur, a.currentTime + 2); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); a.currentTime = Math.max(0, a.currentTime - 2); }
          }}
        >
          {(peaks ?? Array.from({length: bars}, () => 0.35)).map((p, i) => (
            <span key={i} className={`${s.bar} ${peaks ? '' : s.sk}`} data-done={peaks && i / bars < frac ? '' : undefined} style={{height: `${Math.max(8, p * 100)}%`}} />
          ))}
        </div>
      )}
      <span className={s.time}>{mmss(playing || t > 0 ? t : dur)}</span>
    </div>
  );
}
