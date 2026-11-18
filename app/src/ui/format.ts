// Vietnamese number/time formatting (comma decimals, dot thousands).
const nf = (min: number, max: number) => new Intl.NumberFormat('vi-VN', {minimumFractionDigits: min, maximumFractionDigits: max});

export const fmtNum = (n: number, decimals = 0): string => nf(decimals, decimals).format(n);
export const fmtSec = (n: number): string => `${fmtNum(n, 1)} s`;

export function fmtClock(sec: number): string {
  const t = Math.floor(Math.max(0, sec) * 10 + 1e-6); // floor to tenths so 59.96 never shows 60
  const m = Math.floor(t / 600);
  const s = Math.floor((t % 600) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${t % 10}`;
}

export function fmtBytes(n: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${fmtNum(n, i === 0 ? 0 : 1)} ${units[i]}`;
}

export const fmtPct = (f: number): string => `${Math.round(f * 100)}%`;

export function fmtRelTime(ms: number, now: number = Date.now()): string {
  const s = (now - ms) / 1000;
  if (s < 45) return 'vừa xong';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(s / 3600);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'hôm qua';
  if (d < 30) return `${d} ngày trước`;
  return new Date(ms).toLocaleDateString('vi-VN');
}

export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
}
