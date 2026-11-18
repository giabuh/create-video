import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MOTION} from '../motion/registry';
import type {Brand, MotionItem} from '../types';

export const MotionLayer: React.FC<{item: MotionItem; brand: Brand}> = ({item, brand}) => {
  const C = MOTION[item.component];
  if (!C) throw new Error(`Unknown motion component "${item.component}" — add it to studio/src/motion/registry.ts`);
  return <AbsoluteFill><C {...item.props} brand={brand} /></AbsoluteFill>;
};
