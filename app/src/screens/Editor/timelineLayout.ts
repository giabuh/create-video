export const MIN_PPS = 48; // px per second floor; below this the track scrolls horizontally

/** px per second: fit the container, but never below MIN_PPS. */
export const pxPerSecond = (containerPx: number, totalSeconds: number): number =>
  totalSeconds > 0 ? Math.max(MIN_PPS, containerPx / totalSeconds) : MIN_PPS;

/** Ruler ticks every 1 s; labelled every 2 s, plus the end (total) label. */
export function rulerTicks(totalSeconds: number): {t: number; label: boolean}[] {
  const out: {t: number; label: boolean}[] = [];
  for (let t = 0; t <= Math.floor(totalSeconds + 1e-9); t++) out.push({t, label: t % 2 === 0});
  return out;
}

/** Decimal comma, one digit: 3.6 -> "3,6". */
export const fmtSec = (n: number): string => n.toFixed(1).replace('.', ',');

export const timeFromX = (x: number, pps: number, totalSeconds: number): number =>
  Math.max(0, Math.min(totalSeconds, x / pps));
