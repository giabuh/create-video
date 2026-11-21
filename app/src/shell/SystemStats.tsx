import {useQuery} from '@tanstack/react-query';
import type {SystemStats as Stats} from '../../shared/types.ts';
import {api} from '../api/client.ts';
import {Tooltip, fmtNum} from '../ui/index.ts';
import s from './SystemStats.module.css';

const gb = (mib: number) => fmtNum(mib / 1024, 1);
const pct = (used: number, total: number) => Math.round((100 * used) / total);

/** Live CPU / RAM / GPU load of this machine, to watch what a render costs. */
export function SystemStats(): React.JSX.Element | null {
  const {data} = useQuery({queryKey: ['system'], queryFn: ({signal}) => api<Stats>('/system', {signal}), refetchInterval: 2000});
  if (!data) return null;
  const rows: [string, number, string][] = [
    ['CPU', data.cpu, `CPU ${data.cpu}%`],
    ['RAM', pct(data.ram.usedMiB, data.ram.totalMiB), `RAM ${gb(data.ram.usedMiB)} / ${gb(data.ram.totalMiB)} GB`],
    ...(data.gpu ? [
      ['GPU', data.gpu.percent, `GPU ${data.gpu.percent}% · ${data.gpu.name}`],
      ['VRAM', pct(data.gpu.usedMiB, data.gpu.totalMiB), `VRAM ${gb(data.gpu.usedMiB)} / ${gb(data.gpu.totalMiB)} GB`],
    ] as [string, number, string][] : []),
  ];
  return (
    <Tooltip side="right" content={<div className={s.tip}>{rows.map(([k, , d]) => <div key={k}>{d}</div>)}</div>}>
      <div className={s.stats} role="group" aria-label={rows.map(([, , d]) => d).join(', ')} tabIndex={0}>
        {rows.map(([k, v]) => (
          <div key={k} className={s.row}>
            <span className={s.label}>{k}</span><b className={s.val}>{v}</b>
            <span className={s.bar} aria-hidden><span className={v >= 85 ? s.hot : ''} style={{width: `${Math.min(v, 100)}%`}} /></span>
          </div>
        ))}
      </div>
    </Tooltip>
  );
}
