import s from './ProgressBar.module.css';

export function ProgressBar({value, tone = 'accent', size = 'md', label}: {value: number | null; tone?: 'info' | 'accent' | 'success' | 'danger'; size?: 'sm' | 'md'; label?: string}): React.JSX.Element {
  const pct = value == null ? null : Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className={`${s.track} ${s[size]}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct == null ? undefined : Math.round(pct)}
    >
      {pct == null
        ? <div className={`${s.fill} ${s[tone]} ${s.indeterminate}`} />
        : <div className={`${s.fill} ${s[tone]}`} style={{width: `${pct}%`}} />}
    </div>
  );
}
