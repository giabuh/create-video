// Fit text into a box by measuring it with the real font (@remotion/layout-utils), so nothing spills off the frame.
// Use with useFontsLoaded(): measuring before the font is ready would cache fallback-font widths.
import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {measureText} from '@remotion/layout-utils';
import {fontFamily, fontsReady} from './fonts';

let loadedOnce = false;
/** false until the bundled fonts are ready; holds the frame (delayRender) until then so renders are measured. */
export const useFontsLoaded = (): boolean => {
  const [loaded, setLoaded] = useState(loadedOnce || typeof document === 'undefined');
  const [handle] = useState(() => (loaded ? null : delayRender('Waiting for fonts to fit text')));
  useEffect(() => {
    if (loaded) return;
    let live = true;
    fontsReady.then(() => { loadedOnce = true; if (live) setLoaded(true); }, () => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [loaded]);
  useEffect(() => { if (loaded && handle !== null) continueRender(handle); }, [loaded, handle]);
  return loaded;
};

type Fit = {
  text: string; maxSize: number; width: number; height: number;
  weight?: number | string; lineHeight?: number; minSize?: number;
  wrap?: boolean;           // false: every '\n' line stays on one line
  gap?: number;             // extra space between lines, as a factor of the size (KineticText)
  padX?: number; padY?: number; // padding inside the box, as factors of the size (a text pill)
  family?: string;          // measure in this bundled font (default Be Vietnam Pro; headingFamily for Barlow)
};

/** Width in px of one line of text in the bundled font. */
export const widthOf = (text: string, size: number, weight: number | string, family: string = fontFamily) =>
  measureText({text, fontFamily: family, fontSize: size, fontWeight: String(weight)}).width;

/** Line count at `size`, or Infinity if some word cannot fit the width at all. */
const lineCount = (o: Required<Omit<Fit, 'maxSize' | 'minSize' | 'height'>>, size: number, avail: number): number => {
  let n = 0;
  for (const para of o.text.split('\n')) {
    if (!o.wrap) {
      if (widthOf(para, size, o.weight, o.family) > avail) return Infinity;
      n += 1;
      continue;
    }
    let line = '';
    n += 1;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (widthOf(word, size, o.weight, o.family) > avail) return Infinity;
      const next = line ? `${line} ${word}` : word;
      if (widthOf(next, size, o.weight, o.family) <= avail) line = next;
      else { n += 1; line = word; }
    }
  }
  return n;
};

// Results per input set: callers run every frame with inputs that change only per chunk. Not filled before the fonts
// are ready (loadedOnce), since fallback-font widths would be stale afterwards.
const fitCache = new Map<string, number>();
/** Largest font size <= maxSize (whole px) at which `text` fits width x height. */
export const fitFontSize = (f: Fit): number => {
  if (!loadedOnce) return computeFit(f);
  const key = JSON.stringify(f);
  let r = fitCache.get(key);
  if (r === undefined) {
    if (fitCache.size > 500) fitCache.clear();
    r = computeFit(f);
    fitCache.set(key, r);
  }
  return r;
};

const computeFit = (f: Fit): number => {
  const o = {text: f.text, width: f.width, weight: f.weight ?? 800, lineHeight: f.lineHeight ?? 1.12, wrap: f.wrap ?? true,
    gap: f.gap ?? 0, padX: f.padX ?? 0, padY: f.padY ?? 0, family: f.family ?? fontFamily};
  const fits = (s: number) => {
    const n = lineCount(o, s, f.width - 2 * o.padX * s);
    return n !== Infinity && n * s * o.lineHeight + (n - 1) * o.gap * s + 2 * o.padY * s <= f.height;
  };
  let lo = Math.max(1, Math.floor(f.minSize ?? 12)), hi = Math.floor(f.maxSize);
  if (fits(hi)) return hi;
  if (!fits(lo)) return lo;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fits(mid)) lo = mid; else hi = mid;
  }
  return lo;
};
