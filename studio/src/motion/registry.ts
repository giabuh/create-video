// one entry per file studio/src/motion/<Name>.tsx exporting <Name>
import type React from 'react';
import {Checklist} from './Checklist';
import {CountUp} from './CountUp';
import {DateBadge} from './DateBadge';
import {KineticText} from './KineticText';
import {LowerThird} from './LowerThird';
import {PriceTag} from './PriceTag';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MOTION: Record<string, React.ComponentType<any>> = {
  KineticText, CountUp, Checklist, PriceTag, DateBadge, LowerThird,
};
