export type MixPct = [number, number, number];

/** Set slot `i` to `v` (percent) and rescale the other two proportionally so the total stays 100. */
export function rescaleMix(m: MixPct, i: 0 | 1 | 2, v: number): MixPct {
  const val = Math.min(100, Math.max(0, Math.round(v)));
  const [a, b] = ([0, 1, 2] as const).filter((k) => k !== i);
  const rest = 100 - val;
  const sum = m[a] + m[b];
  const first = sum === 0 ? Math.round(rest / 2) : Math.round((m[a] / sum) * rest);
  const out: MixPct = [0, 0, 0];
  out[i] = val; out[a] = first; out[b] = rest - first;
  return out;
}
