import {describe, expect, it} from 'vitest';
import {duckSpans, musicVolumeAt} from '../../../../studio/src/components/duck.ts';

const music = {src: 'music/x.mp3', volume: 0.25, duckTo: 0.08, fadeOut: 1.5};
const v = (start: number, duration: number) => ({start, voice: {src: 'a.wav', duration}});

describe('music ducking', () => {
  it('stays ducked across the short pause between two spoken scenes', () => {
    const spans = duckSpans([v(0, 2), v(2.3, 2)]); // 0.3 s pauseAfter
    expect(spans).toEqual([[0, 4.3]]);
    expect(musicVolumeAt(2.15, music, spans, 20)).toBeCloseTo(0.08);
  });
  it('comes back up during a long silent scene', () => {
    const spans = duckSpans([v(0, 2), {start: 2.3, voice: null}, v(4.3, 2)]);
    expect(spans).toEqual([[0, 2], [4.3, 6.3]]);
    expect(musicVolumeAt(3.1, music, spans, 20)).toBeCloseTo(0.25);
  });
  it('drops to the drop level between start and end, ramping 0.15 s', () => {
    const m = {...music, drops: [[5, 7, 0]] as [number, number, number][]};
    expect(musicVolumeAt(6, m, [], 20)).toBe(0);
    expect(musicVolumeAt(4, m, [], 20)).toBe(music.volume);
    expect(musicVolumeAt(5 - 0.075, m, [], 20)).toBeCloseTo(music.volume / 2, 5);
    expect(musicVolumeAt(8, m, [], 20)).toBe(music.volume);
  });
  it('fades out at the end', () => {
    expect(musicVolumeAt(19.25, music, [], 20)).toBeCloseTo(0.125);
  });
});
