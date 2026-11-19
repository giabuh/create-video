import {useEffect, useState} from 'react';
import {Check, ChevronDown, TriangleAlert, X} from 'lucide-react';
import type {Job} from '../../shared/types.ts';
import {useCancelJob} from '../api/hooks.ts';
import {useJobs} from '../api/events.ts';
import {IconButton, ProgressBar, fmtClock, fmtPct} from '../ui/index.ts';
import s from './JobsPanel.module.css';

const live = (j: Job) => j.state === 'queued' || j.state === 'running';
export const useActiveJobCount = (): number => useJobs().filter(live).length;

function eta(sec: number | null): string | null {
  if (sec == null) return null;
  return sec < 60 ? `còn ~${Math.max(1, Math.round(sec))} giây` : `còn ~${Math.round(sec / 60)} phút`;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function Running({job}: {job: Job}): React.JSX.Element {
  const cancel = useCancelJob();
  const queued = job.state === 'queued';
  const now = useNow(!queued);
  const elapsed = !queued && job.startedAt ? fmtClock(Math.max(0, (now - job.startedAt) / 1000)) : null;
  const meta = [job.project, queued ? 'Đang chờ' : job.step, elapsed, queued ? null : eta(job.etaSeconds)].filter(Boolean).join(' · ');
  return (
    <li className={s.job}>
      <div className={s.row}>
        <span className={s.title}>{job.label}</span>
        {job.progress != null && !queued && <span className={s.pct}>{fmtPct(job.progress)}</span>}
        {job.cancellable && <IconButton label={`Huỷ ${job.label}`} size="sm" icon={<X size={16} />} disabled={cancel.isPending} onClick={() => cancel.mutate(job.id)} />}
      </div>
      <ProgressBar value={queued ? 0 : job.progress} tone="info" size="sm" label={job.label} />
      <div className={s.meta}>{meta}</div>
    </li>
  );
}

function Finished({job}: {job: Job}): React.JSX.Element {
  const ok = job.state === 'done';
  const failed = job.state === 'failed';
  return (
    <li className={`${s.fin} ${ok ? s.ok : failed ? s.bad : ''}`}>
      {ok ? <Check size={16} aria-hidden /> : failed ? <TriangleAlert size={16} aria-hidden /> : <X size={16} aria-hidden />}
      <span className={s.finText}>
        {job.label} · {ok ? 'xong' : failed ? job.error ?? 'lỗi' : 'đã huỷ'}
        {failed && job.log.length > 0 && <details className={s.log}><summary>Xem log</summary><pre>{job.log.slice(-20).join('\n')}</pre></details>}
      </span>
    </li>
  );
}

export function JobsPanel(): React.JSX.Element {
  const jobs = useJobs();
  const [open, setOpen] = useState(false);
  const active = jobs.filter(live);
  const recent = jobs.filter((j) => !live(j)).slice(0, 8);
  return (
    <section className={s.panel} aria-label="Tác vụ">
      <h2 className={s.head}>Tác vụ đang chạy</h2>
      {active.length ? <ul className={s.list}>{active.map((j) => <Running key={j.id} job={j} />)}</ul> : <p className={s.empty}>Không có tác vụ nào</p>}
      {recent.length > 0 && (
        <>
          <button type="button" className={s.toggle} aria-expanded={open} onClick={() => setOpen(!open)}>
            <ChevronDown size={16} aria-hidden className={open ? s.flip : undefined} />Gần đây ({recent.length})
          </button>
          {open && <ul className={s.list}>{recent.map((j) => <Finished key={j.id} job={j} />)}</ul>}
        </>
      )}
    </section>
  );
}
