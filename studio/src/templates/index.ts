// template name (storyboard "template") -> component; one folder per template
import type React from 'react';
import type {RenderProps} from '../types';
import {FastCut} from './fast-cut/FastCut';
import {Slideshow} from './slideshow/Slideshow';
import {SplitCompare} from './split-compare/SplitCompare';
import {Testimonial} from './testimonial/Testimonial';

export const TEMPLATES: Record<string, React.FC<RenderProps>> = {
  'fast-cut': FastCut, testimonial: Testimonial, 'split-compare': SplitCompare, slideshow: Slideshow,
};
