import React from 'react';
import {Composition} from 'remotion';
import smoke from '../fixtures/smoke-props.json';
import {Reel} from './Reel';
import type {RenderProps} from './types';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    defaultProps={smoke as unknown as RenderProps}
    durationInFrames={1}
    fps={30}
    width={1080}
    height={1920}
    calculateMetadata={({props}) => ({
      durationInFrames: Math.max(1, Math.ceil(props.totalSeconds * props.fps)),
      fps: props.fps,
      width: props.width,
      height: props.height,
    })}
  />
);
