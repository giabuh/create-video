import {Cloud} from 'lucide-react';
import {useEffect, useRef} from 'react';
import {useCancelJob} from '../../api/hooks.ts';
import {useJobs} from '../../api/events.ts';
import {useApplySyncResult, useStartSync, useSyncStatus} from '../../api/sync.ts';
import {Button, Drawer, ErrorState, ProgressBar, Skeleton, fmtPct, toast} from '../../ui/index.ts';
import {FOLDER_LABEL, fmtWhen, syncTotals} from './syncFormat.ts';
import s from './Library.module.css';

export function DriveButton({onClick}: {onClick(): void}): React.JSX.Element {
  const running = useJobs().some((j) => j.kind === 'sync' && (j.state === 'running' || j.state === 'queued'));
  return <Button icon={<Cloud size={18} aria-hidden />} loading={running} loadingText="Đang đồng bộ…" onClick={onClick}>Drive</Button>;
}

export function DriveDrawer({open, onOpenChange}: {open: boolean; onOpenChange(o: boolean): void}): React.JSX.Element {
  const q = useSyncStatus(open);
  const jobs = useJobs();
  const job = jobs.find((j) => j.kind === 'sync' && (j.state === 'running' || j.state === 'queued'));
  const apply = useApplySyncResult();
  const push = useStartSync('push'), pull = useStartSync('pull'), cancel = useCancelJob();
  // refresh the table from the result of the latest finished sync job (once per job)
  const last = jobs.find((j) => j.kind === 'sync' && j.state === 'done');
  const seen = useRef<string | null>(last?.id ?? null);
  useEffect(() => { if (last && last.id !== seen.current) { seen.current = last.id; apply(last); } }, [last, apply]);
  const fail = (e: {message: string}) => toast({title: 'Không đồng bộ được', description: e.message, tone: 'error'});
  const busy = !!job || push.isPending || pull.isPending;
  const st = q.data;
  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Đồng bộ Google Drive" width={460}
      footer={<>
        <Button disabled={busy} onClick={() => pull.mutate(undefined, {onError: fail})}>Kéo về máy</Button>
        <Button variant="primary" disabled={busy} onClick={() => push.mutate(undefined, {onError: fail})}>Đẩy lên Drive</Button>
      </>}>
      <div className={s.syncBody}>
        <p className={s.syncNote}>Chỉ thêm file mới, không bao giờ xoá và không ghi đè file mới hơn.</p>
        {job && (
          <div className={s.syncJob}>
            <b>{job.label}</b>
            <ProgressBar value={job.progress} size="sm" label={job.label} />
            <div className={s.syncJobRow}>
              <span className={s.ellipsis} title={job.step}>{job.step || 'Đang chờ…'}{job.progress != null ? ` · ${fmtPct(job.progress)}` : ''}</span>
              {job.cancellable && <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate(job.id, {onError: fail})}>Huỷ</Button>}
            </div>
          </div>
        )}
        {q.isPending ? <Skeleton height={140} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : st && (
          <>
            {st.error && <p className={s.syncErr} title={st.error}>Không kiểm tra được Drive: {st.error}</p>}
            {!st.error && <p className={s.syncNote}>{(() => { const t = syncTotals(st); return `${t.localOnly} file chưa lên Drive · ${t.driveOnly} file chỉ có trên Drive · ${t.differ} file khác nhau`; })()}</p>}
            <table className={s.syncTable}>
              <thead><tr><th>Thư mục</th><th title="Chưa lên Drive">Chưa lên</th><th title="Chỉ có trên Drive">Chỉ Drive</th><th title="Khác nhau">Khác</th><th title="Khớp">Khớp</th></tr></thead>
              <tbody>
                {st.folders.map((f) => (
                  <tr key={f.name}><td>{FOLDER_LABEL[f.name]}</td><td>{f.localOnly}</td><td>{f.driveOnly}</td><td>{f.differ}</td><td>{f.same}</td></tr>
                ))}
              </tbody>
            </table>
            <dl className={s.syncWhen}>
              <dt>Đẩy lần cuối</dt><dd>{fmtWhen(st.lastPush)}</dd>
              <dt>Kéo lần cuối</dt><dd>{fmtWhen(st.lastPull)}</dd>
              <dt>Kiểm tra lúc</dt><dd>{q.isFetching ? 'Đang kiểm tra Drive…' : fmtWhen(st.checkedAt)}</dd>
            </dl>
            <Button size="sm" className={s.syncCheck} onClick={() => void q.refetch()} loading={q.isFetching} disabled={busy}>Kiểm tra lại</Button>
          </>
        )}
      </div>
    </Drawer>
  );
}
