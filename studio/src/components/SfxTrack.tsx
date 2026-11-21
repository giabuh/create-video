// sound effects; a held one (until) stops at its layer end with a 0.1 s fade
import React from 'react';
import {Sequence, staticFile, useVideoConfig} from 'remotion';
import {Audio} from '@remotion/media';

type Sfx = {src: string; start: number; volume: number; until?: number};
export const SfxTrack: React.FC<{sfx: Sfx[]}> = ({sfx}) => {
  const {fps} = useVideoConfig();
  return <>{sfx.map((x, i) => {
    const len = x.until === undefined ? undefined : Math.max(1, Math.round((x.until - x.start) * fps));
    const fade = Math.round(0.1 * fps);
    const volume = len === undefined ? x.volume : (f: number) => x.volume * Math.min(1, Math.max(0, (len - f) / fade));
    return (
      <Sequence key={`sfx-${i}`} from={Math.round(x.start * fps)} durationInFrames={len} name={`sfx:${x.src}`}>
        <Audio src={staticFile(x.src)} volume={volume} />
      </Sequence>
    );
  })}</>;
};
