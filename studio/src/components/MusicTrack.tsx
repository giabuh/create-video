// ducks under every voice clip, fades out at the end
import React from 'react';
import {staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import type {Music, Scene} from '../types';

const RAMP = 0.25; // seconds

export const musicVolumeAt = (t: number, music: Music, scenes: Scene[], total: number): number => {
  let v = music.volume;
  for (const s of scenes) {
    if (!s.voice) continue;
    const a = s.start, b = s.start + s.voice.duration;
    const d = t < a ? a - t : t > b ? t - b : 0;
    if (d < RAMP) v = Math.min(v, music.volume + (music.duckTo - music.volume) * (1 - d / RAMP));
  }
  const fadeStart = total - music.fadeOut;
  return t > fadeStart ? v * Math.max(0, (total - t) / music.fadeOut) : v;
};

export const MusicTrack: React.FC<{music: Music; scenes: Scene[]; total: number}> = ({music, scenes, total}) => {
  const {fps} = useVideoConfig();
  return <Audio src={staticFile(music.src)} loop loopVolumeCurveBehavior="extend" volume={(f: number) => musicVolumeAt(f / fps, music, scenes, total)} />;
};
