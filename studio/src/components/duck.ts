// pure music-ducking math (no Remotion imports, so it is unit-testable)
import type {Music, Scene} from '../types';

const RAMP = 0.25; // seconds
// Gaps between two lines shorter than this stay ducked: a short swell between every scene
// made the narration sound chopped into separate takes.
export const DUCK_HOLD = 1.0;

/** Voice intervals [start, end] in seconds, with gaps shorter than DUCK_HOLD merged into one. */
export const duckSpans = (scenes: Pick<Scene, 'start' | 'voice'>[]): Array<[number, number]> => {
  const spans: Array<[number, number]> = [];
  for (const s of scenes) {
    if (!s.voice) continue;
    const a = s.start, b = s.start + s.voice.duration;
    const last = spans[spans.length - 1];
    if (last && a - last[1] < DUCK_HOLD) last[1] = Math.max(last[1], b);
    else spans.push([a, b]);
  }
  return spans;
};

export const musicVolumeAt = (t: number, music: Music, spans: Array<[number, number]>, total: number): number => {
  let v = music.volume;
  for (const [a, b] of spans) {
    const d = t < a ? a - t : t > b ? t - b : 0;
    if (d < RAMP) v = Math.min(v, music.volume + (music.duckTo - music.volume) * (1 - d / RAMP));
  }
  const fadeStart = total - music.fadeOut;
  return t > fadeStart ? v * Math.max(0, (total - t) / music.fadeOut) : v;
};
