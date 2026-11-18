import {loadFont} from '@remotion/google-fonts/BeVietnamPro';

// shortcut: only Be Vietnam Pro is loaded; another captions.font needs its own loadFont here.
export const {fontFamily} = loadFont('normal', {weights: ['400', '700', '800'], subsets: ['vietnamese', 'latin']});
