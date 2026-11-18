// template name (storyboard "template") -> component; one folder per template
import type React from 'react';
import type {RenderProps} from '../types';
import {FastCut} from './fast-cut/FastCut';

export const TEMPLATES: Record<string, React.FC<RenderProps>> = {'fast-cut': FastCut};
