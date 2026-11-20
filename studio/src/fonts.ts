// Be Vietnam Pro and Barlow Condensed are bundled with the repo (studio/src/assets/fonts/{be-vietnam-pro,barlow-condensed}, SIL OFL 1.1),
// so renders and the app's Player work offline. Subsets and unicode ranges follow Google Fonts / Fontsource.
// shortcut: only Be Vietnam Pro is loaded; another captions.font needs its own files + loadFont here.
import {loadFont} from '@remotion/fonts';
import latin400 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-latin-400-normal.woff2';
import latin700 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-latin-700-normal.woff2';
import latin800 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-latin-800-normal.woff2';
import latinExt400 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-latin-ext-400-normal.woff2';
import latinExt700 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-latin-ext-700-normal.woff2';
import latinExt800 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-latin-ext-800-normal.woff2';
import vi400 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-vietnamese-400-normal.woff2';
import vi700 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-vietnamese-700-normal.woff2';
import vi800 from './assets/fonts/be-vietnam-pro/be-vietnam-pro-vietnamese-800-normal.woff2';

import bcVi800 from './assets/fonts/barlow-condensed/barlow-condensed-vietnamese-800-normal.woff2';
import bcVi900 from './assets/fonts/barlow-condensed/barlow-condensed-vietnamese-900-normal.woff2';
import bcLatinExt800 from './assets/fonts/barlow-condensed/barlow-condensed-latin-ext-800-normal.woff2';
import bcLatinExt900 from './assets/fonts/barlow-condensed/barlow-condensed-latin-ext-900-normal.woff2';
import bcLatin800 from './assets/fonts/barlow-condensed/barlow-condensed-latin-800-normal.woff2';
import bcLatin900 from './assets/fonts/barlow-condensed/barlow-condensed-latin-900-normal.woff2';

export const fontFamily = 'Be Vietnam Pro';
/** Heading/number font (Barlow Condensed 800/900, uppercase), bundled like the body font. */
export const headingFamily = 'Barlow Condensed';

const RANGES = {
  vietnamese: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB',
  latinExt: 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
};
const FILES: Array<[keyof typeof RANGES, string, string]> = [
  ['vietnamese', '400', vi400], ['vietnamese', '700', vi700], ['vietnamese', '800', vi800],
  ['latinExt', '400', latinExt400], ['latinExt', '700', latinExt700], ['latinExt', '800', latinExt800],
  ['latin', '400', latin400], ['latin', '700', latin700], ['latin', '800', latin800],
];

const HEADING_FILES: Array<[keyof typeof RANGES, string, string]> = [
  ['vietnamese', '800', bcVi800], ['vietnamese', '900', bcVi900],
  ['latinExt', '800', bcLatinExt800], ['latinExt', '900', bcLatinExt900],
  ['latin', '800', bcLatin800], ['latin', '900', bcLatin900],
];

/** Resolves when every face is loaded (immediately outside a browser, e.g. unit tests importing the motion registry). */
export const fontsReady: Promise<unknown> = typeof FontFace === 'undefined'
  ? Promise.resolve()
  : Promise.all([
    ...FILES.map(([subset, weight, url]) => loadFont({family: fontFamily, url, weight, style: 'normal', unicodeRange: RANGES[subset], format: 'woff2'})),
    ...HEADING_FILES.map(([subset, weight, url]) => loadFont({family: headingFamily, url, weight, style: 'normal', unicodeRange: RANGES[subset], format: 'woff2'})),
  ]);
