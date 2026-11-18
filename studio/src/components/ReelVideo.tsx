// @remotion/media Video when rendering, OffthreadVideo in Studio preview
import React from 'react';
import {OffthreadVideo, useRemotionEnvironment} from 'remotion';
import {Video} from '@remotion/media';

export const ReelVideo: React.FC<{src: string; trimBefore: number; objectFit: 'contain' | 'cover'; style: React.CSSProperties}> = (p) => {
  const env = useRemotionEnvironment();
  return env.isRendering
    ? <Video src={p.src} muted trimBefore={p.trimBefore} objectFit={p.objectFit} style={p.style} />
    : <OffthreadVideo src={p.src} muted trimBefore={p.trimBefore} style={{...p.style, objectFit: p.objectFit}} />;
};
