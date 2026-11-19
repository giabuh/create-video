// ducks under the voice (see duck.ts), fades out at the end
import React from 'react';
import {staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';
import type {Music, Scene} from '../types';
import {duckSpans, musicVolumeAt} from './duck';

export const MusicTrack: React.FC<{music: Music; scenes: Scene[]; total: number}> = ({music, scenes, total}) => {
  const {fps} = useVideoConfig();
  const spans = React.useMemo(() => duckSpans(scenes), [scenes]);
  return <Audio src={staticFile(music.src)} loop loopVolumeCurveBehavior="extend" volume={(f: number) => musicVolumeAt(f / fps, music, spans, total)} />;
};
