import React from 'react';
import {useVideoConfig} from 'remotion';
import type {TransitionPresentation} from '@remotion/transitions';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {cube} from '@remotion/transitions/cube';
import {flip} from '@remotion/transitions/flip';
import {pushCut} from '@remotion/transitions/push-cut';
import {wipe} from '@remotion/transitions/wipe';
import type {Transition} from '../types';

// Scene transitions that animate BOTH scenes (@remotion/transitions presentations), driven by hand: ReelFrame keeps the
// outgoing scene running under the incoming one and passes each side its own progress (0..1).
const NAMES = ['push', 'cube', 'wipe', 'flip', 'clockWipe'] as const;
export const isPresentation = (t: Transition): boolean => (NAMES as readonly string[]).includes(t);

const noop = () => {};

export const ScenePresentation: React.FC<{
  type: Transition; direction: 'entering' | 'exiting'; progress: number; accent: string; durationInFrames: number; children: React.ReactNode;
}> = ({type, direction, progress, accent, durationInFrames, children}) => {
  const {width, height} = useVideoConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pres: TransitionPresentation<any> =
    type === 'push' ? pushCut({flashColor: accent, flashOpacity: 0.7, incomingEndScale: 1}) // end at 1: the scene is unwrapped when the transition ends, so no snap
    : type === 'cube' ? cube({direction: 'from-right'})
    : type === 'wipe' ? wipe({direction: 'from-bottom-left'})
    : type === 'flip' ? flip({direction: 'from-right'})
    : clockWipe({width, height});
  const C = pres.component as React.ComponentType<Record<string, unknown>>;
  return (
    <C presentationDirection={direction} presentationProgress={progress} passedProps={pres.props}
      presentationDurationInFrames={durationInFrames} onElementImage={noop} onUnmount={noop} bothEnteringAndExiting={false}>
      {children}
    </C>
  );
};
