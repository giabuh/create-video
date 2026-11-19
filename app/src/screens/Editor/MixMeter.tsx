import type {Mix} from '../../../shared/types.ts';
import s from './MixMeter.module.css';

const ROWS: {key: keyof Mix; label: string; color: string}[] = [
  {key: 'real', label: 'Thật', color: 'var(--mix-real)'},
  {key: 'motion', label: 'Motion', color: 'var(--mix-motion)'},
  {key: 'other', label: 'Khác', color: 'var(--mix-other)'},
];
const pct = (f: number) => Math.round(f * 100);

export function MixMeter({actual, target}: {actual: Mix | null; target: Mix}): React.JSX.Element {
  return (
    <div className={s.mix} role="group" aria-label="Tỉ lệ mix so với mục tiêu">
      {ROWS.map(({key, label, color}) => {
        const a = actual?.[key] ?? null;
        const diff = a === null ? 0 : a - target[key];
        const off = Math.abs(diff) > 0.08;
        return (
          <span key={key} className={off ? s.off : undefined} title={a === null ? undefined : off ? `${label} lệch mục tiêu ${pct(Math.abs(diff))}%` : undefined}>
            <i className={s.dot} style={{background: color}} />
            {label} <b>{a === null ? '—' : `${pct(a)}%`}</b> <span className={s.target}>/ {pct(target[key])}</span>
            {off && <span aria-label={diff > 0 ? 'cao hơn mục tiêu' : 'thấp hơn mục tiêu'}> {diff > 0 ? '▲' : '▼'}</span>}
          </span>
        );
      })}
    </div>
  );
}
