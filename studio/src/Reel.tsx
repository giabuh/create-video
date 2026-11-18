import React from 'react';
import {TEMPLATES} from './templates';
import type {RenderProps} from './types';
import './fonts';

export const Reel: React.FC<RenderProps> = (props) => {
  const T = TEMPLATES[props.template];
  if (!T) throw new Error(`Unknown template "${props.template}" — register it in studio/src/templates/index.ts`);
  return <T {...props} />;
};
