import {spring, useCurrentFrame, useVideoConfig} from 'remotion';
import type {CaptionChunk} from '../types';

/** The chunk being spoken now (null between chunks), the time t in seconds, and its entry pop (0 -> 1). */
export const useActiveChunk = (chunks: CaptionChunk[]) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const c = chunks.find((x) => t >= x.start && t < x.end) ?? null;
  const pop = c ? spring({frame: Math.round((t - c.start) * fps), fps, config: {damping: 14}}) : 0;
  return {c, t, pop};
};
