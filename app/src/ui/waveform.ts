import {useEffect, useState} from 'react';

export function peaksFromSamples(samples: Float32Array, bars: number): number[] {
  const peaks = new Array<number>(bars).fill(0);
  if (samples.length === 0 || bars <= 0) return peaks;
  const size = samples.length / bars;
  for (let b = 0; b < bars; b++) {
    const end = Math.min(samples.length, Math.max(Math.floor((b + 1) * size), Math.floor(b * size) + 1));
    let m = 0;
    for (let i = Math.floor(b * size); i < end; i++) m = Math.max(m, Math.abs(samples[i]));
    peaks[b] = m;
  }
  const top = Math.max(...peaks);
  return top > 0 ? peaks.map((p) => p / top) : peaks;
}

const cache = new Map<string, number[]>();

export function useWaveform(src: string | null, bars: number): {peaks: number[] | null; error: boolean} {
  const key = src ? `${src}#${bars}` : null;
  const [state, setState] = useState<{key: string | null; peaks: number[] | null; error: boolean}>({key: null, peaks: null, error: false});
  useEffect(() => {
    if (!key || !src) return;
    const hit = cache.get(key);
    if (hit) { setState({key, peaks: hit, error: false}); return; }
    let live = true;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(src, {signal: ctrl.signal});
        if (!res.ok) throw new Error(String(res.status));
        const ctx = new AudioContext();
        try {
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          const peaks = peaksFromSamples(buf.getChannelData(0), bars);
          cache.set(key, peaks);
          if (live) setState({key, peaks, error: false});
        } finally { void ctx.close(); }
      } catch {
        if (live) setState({key, peaks: null, error: true});
      }
    })();
    return () => { live = false; ctrl.abort(); };
  }, [key, src, bars]);
  return state.key === key ? {peaks: state.peaks, error: state.error} : {peaks: null, error: false};
}
