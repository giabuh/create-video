import {useCallback, useEffect, useRef, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router';
import {Film} from 'lucide-react';
import type {VersionInfo} from '../../../shared/types.ts';
import {useJobs} from '../../api/events.ts';
import {useCancelJob, useApprove, useDeleteRender, useDriveDelete, useDriveStatus, useOpenFolder, usePublish, useProject, useStartRender} from '../../api/hooks.ts';
import {Button, Chip, Dialog, EmptyState, Input, ErrorState, PageHeader, ProgressBar, Skeleton, fmtPct, toast} from '../../ui/index.ts';
import {VersionCard} from './VersionCard.tsx';
import {deleteMessage, driveRow} from './driveRow.ts';
import s from './Renders.module.css';

type DeleteScope = 'local' | 'drive' | 'both';
const SCOPE: Record<DeleteScope, {label: string; desc: string; btn: string}> = {
  local: {label: 'Chỉ xoá trên máy (giữ bản trên Drive)', desc: 'Xoá file video trên máy này.', btn: 'Xoá trên máy'},
  drive: {label: 'Chỉ xoá trên Drive (giữ file trên máy)', desc: 'Xoá bản trên Drive (thư mục xuat-ban/), file trên máy vẫn giữ.', btn: 'Xoá trên Drive'},
  both: {label: 'Xoá cả trên máy và Drive', desc: 'Xoá file video trên máy này và bản trên Drive.', btn: 'Xoá cả hai'},
};
const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function RendersScreen(): React.JSX.Element {
  const slug = useParams().slug ?? '';
  const nav = useNavigate();
  const project = useProject(slug);
  const approve = useApprove(slug);
  const open = useOpenFolder();
  const start = useStartRender(slug);
  const cancel = useCancelJob();
  const job = useJobs().find((j) => j.kind === 'render' && j.project === slug && (j.state === 'running' || j.state === 'queued'));
  const videos = useRef(new Map<string, HTMLVideoElement>());
  const register = useCallback((name: string, el: HTMLVideoElement | null) => { if (el) videos.current.set(name, el); else videos.current.delete(name); }, []);
  const publish = usePublish(slug);
  const del = useDeleteRender(slug);
  const allJobs = useJobs();
  const driveJobs = allJobs.filter((j) => (j.kind === 'publish' || j.kind === 'drive-delete') && j.project === slug); // newest first
  const drive = useDriveStatus(slug);
  const driveDel = useDriveDelete(slug);
  const settled = driveJobs.filter((j) => j.state !== 'running' && j.state !== 'queued').map((j) => j.id).join();
  const firstSettled = useRef(true);
  const refetchDrive = drive.refetch;
  useEffect(() => { if (firstSettled.current) { firstSettled.current = false; return; } void refetchDrive(); }, [settled, refetchDrive]);
  const [confirm, setConfirm] = useState<{v: VersionInfo; retry: boolean} | null>(null);
  const [name, setName] = useState('');
  const [toDelete, setToDelete] = useState<VersionInfo | null>(null);
  const [scope, setScope] = useState<DeleteScope>('local');
  const rmOnDrive = (version: string) => driveDel.mutate({version}, {onError: (e) => toast({title: 'Không xoá được trên Drive', description: e.message, tone: 'error'})});
  const askName = (v: VersionInfo, retry: boolean) => { setName(v.published?.name ?? `${slug}-${v.name}`); setConfirm({v, retry}); };
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!job) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, [job]);

  const versions = [...(project.data?.versions ?? [])].sort((a, b) => b.n - a.n);
  const playAll = () => videos.current.forEach((el) => { el.currentTime = 0; void el.play().catch(() => {}); });
  const render = () => start.mutate(undefined, {onError: (e) => toast({title: 'Không bắt đầu được render', description: e.message, tone: 'error'})});
  const doApprove = () => {
    if (!confirm) return;
    const {v, retry} = confirm;
    const body = {version: v.name, name: name.trim()};
    const fail = (title: string) => (e: Error) => { toast({title, description: e.message, tone: 'error'}); setConfirm(null); };
    if (retry) publish.mutate(body, {onSuccess: () => { toast({title: `Đang đẩy ${v.name} lên Drive`, tone: 'info'}); setConfirm(null); }, onError: fail('Không đẩy được lên Drive')});
    else approve.mutate(body, {
      onSuccess: () => { toast({title: `Đã duyệt ${v.name} · đang đẩy lên Drive`, tone: 'success'}); setConfirm(null); },
      onError: fail('Không duyệt được'),
    });
  };
  const doDelete = () => {
    if (!toDelete) return;
    const v = toDelete.name;
    if (scope === 'drive') return driveDel.mutate({version: v}, {
      onSuccess: () => { toast({title: `Đang xoá ${v} trên Drive · bản trên máy vẫn giữ`, tone: 'info'}); setToDelete(null); },
      onError: (e) => { toast({title: 'Không xoá được trên Drive', description: e.message, tone: 'error'}); setToDelete(null); },
    });
    del.mutate({version: v, drive: scope === 'both'}, {
      onSuccess: (r) => { toast({title: deleteMessage(v, !!r.driveJob, toDelete.published?.state === 'done'), tone: 'success'}); setToDelete(null); },
      onError: (e) => { toast({title: 'Không xoá được', description: e.message, tone: 'error'}); setToDelete(null); },
    });
  };

  const crumb = <span className={s.crumb}><Link to="/">Dự án</Link> / <Link to={`/p/${encodeURIComponent(slug)}`}>{slug}</Link> / Bản render</span>;
  const header = (
    <PageHeader title="Bản render" subtitle={<>{crumb} · Mỗi lần render tạo bản mới, không bao giờ ghi đè.</>}
      actions={<>
        <Button onClick={() => nav(`/p/${encodeURIComponent(slug)}`)}>← Về trình sửa</Button>
        <Button disabled={versions.length < 2} onClick={playAll}>Phát đồng thời</Button>
      </>} />
  );

  let body: React.JSX.Element;
  if (project.isPending) {
    body = <div className={s.grid}>{[0, 1, 2].map((i) => <div key={i} className={s.card}><Skeleton height={24} width="50%" /><Skeleton height={320} radius={10} /><Skeleton height={80} /><Skeleton height={34} /></div>)}</div>;
  } else if (project.isError) {
    body = <ErrorState error={project.error} onRetry={() => void project.refetch()} />;
  } else if (versions.length === 0) {
    body = <EmptyState icon={<Film size={28} />} title="Chưa có bản render" description="Render một bản nháp để xem thử video."
      action={<Button variant="primary" loading={start.isPending || !!job} loadingText="Đang render…" onClick={render}>Render nháp</Button>} />;
  } else {
    body = <div className={s.grid}>{versions.map((v) => <VersionCard key={v.name} v={v} size={project.data.size} register={register} row={driveRow(v.name, v.published, driveJobs.find((j) => j.ref === v.name), drive.isPending ? undefined : drive.data)} onCancel={(j) => cancel.mutate(j.id)} onApprove={() => askName(v, false)} onRetry={() => { const j = driveJobs.find((x) => x.ref === v.name); if (j?.kind === 'drive-delete' && j.state === 'failed') rmOnDrive(v.name); else askName(v, true); }} onDelete={() => { setScope('local'); setToDelete(v); }} onOpenFolder={() => open.mutate(`projects/${slug}`, {onError: (e) => toast({title: 'Không mở được thư mục', description: e.message, tone: 'error'})})} />)}</div>;
  }

  const orphans = drive.data?.orphans ?? [];
  const driveBar = (
    <div className={s.driveBar}>
      <span>{drive.isFetching ? 'Đang kiểm tra Drive…' : drive.data ? `Kiểm tra Drive lúc ${new Date(drive.data.checkedAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}` : 'Chưa kiểm tra Drive'}</span>
      <Button size="sm" variant="ghost" loading={drive.isFetching} onClick={() => void drive.refetch()}>Kiểm tra lại</Button>
      {(drive.data?.error || drive.isError) && <span className={s.driveErr}>Không kiểm tra được Drive: {drive.data?.error ?? drive.error?.message}</span>}
    </div>
  );
  const orphanList = orphans.length > 0 && (
    <section className={s.orphans} aria-label="Chỉ còn trên Drive">
      <b>Chỉ còn trên Drive</b>
      {orphans.map((o) => {
        const running = driveJobs.some((j) => j.ref === o.version && j.kind === 'drive-delete' && (j.state === 'running' || j.state === 'queued'));
        return (
          <div key={o.version} className={s.orphan}>
            <div className={s.oname}>
              <span title={o.name}>{o.name}</span>
              <span className={s.hint}>{o.version} · {new Date(o.at).toLocaleDateString('vi-VN')}{o.onDrive ? '' : ' · Không còn trên Drive'}</span>
            </div>
            <Button size="sm" variant="secondary" loading={running} loadingText="Đang xoá…" onClick={() => rmOnDrive(o.version)}>{o.onDrive ? 'Xoá trên Drive' : 'Xoá bản ghi'}</Button>
          </div>
        );
      })}
    </section>
  );
  const elapsed = job?.startedAt ? (now - job.startedAt) / 1000 : 0;
  return (
    <div className={s.page}>
      {header}
      {versions.length > 0 && driveBar}
      <div className={s.layout}>
        <div className={s.main}>{body}{orphanList}</div>
        <aside className={s.side}>
          {job ? (
            <section className={s.card}>
              <div className={s.row}><b>{job.label}</b><Chip tone="info">{job.state === 'queued' ? 'Đang chờ' : 'Đang render'}</Chip>{job.progress != null && <span className={s.pct}>{fmtPct(job.progress)}</span>}</div>
              <ProgressBar value={job.progress} tone="info" label="Tiến độ render" />
              <div className={s.hint}>{[job.step, job.startedAt && `đã ${mmss(elapsed)}`, job.etaSeconds != null && `còn ~${mmss(job.etaSeconds)}`].filter(Boolean).join(' · ')}</div>
              {job.cancellable && <Button size="sm" onClick={() => cancel.mutate(job.id)} loading={cancel.isPending}>Huỷ</Button>}
            </section>
          ) : (
            <section className={s.card}>
              <b>“Duyệt bản này” làm gì?</b>
              <p className={s.muted}>Duyệt = chốt bản này, lưu storyboard vào git và đẩy file lên Drive (thư mục xuat-ban/). Các bản khác chỉ nằm trên máy này; xoá khi không cần.</p>
            </section>
          )}
        </aside>
      </div>
      <Dialog open={!!confirm} onOpenChange={(o) => { if (!o && !approve.isPending && !publish.isPending) setConfirm(null); }} size="sm"
        title={confirm?.retry ? `Thử lại đẩy ${confirm.v.name}` : `Duyệt ${confirm?.v.name ?? ''}?`}
        description={confirm?.retry ? undefined : confirm?.v.hasSnapshot === false
          ? 'Bản này không có snapshot storyboard, nên chỉ ghi nhận việc duyệt, không lưu storyboard vào git.'
          : 'Đánh dấu bản này là bản đã chốt, lưu snapshot storyboard vào git và đẩy file lên Drive.'}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(null)} disabled={approve.isPending || publish.isPending}>Huỷ</Button>
          <Button variant="primary" loading={approve.isPending || publish.isPending} disabled={!name.trim()} onClick={doApprove}>{confirm?.retry ? 'Thử lại' : 'Duyệt bản này'}</Button>
        </>}>
        <label className={s.field}>Tên file trên Drive
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <span className={s.hint}>Lưu vào thư mục xuat-ban/ trên Drive</span>
        </label>
      </Dialog>
      <Dialog open={!!toDelete} onOpenChange={(o) => { if (!o && !del.isPending && !driveDel.isPending) setToDelete(null); }} size="sm" title={`Xoá ${toDelete?.name ?? ''}?`}
        description={`${SCOPE[toDelete?.published?.state === 'done' ? scope : 'local'].desc} Storyboard của dự án vẫn giữ.`}
        footer={<>
          <Button variant="ghost" disabled={del.isPending || driveDel.isPending} onClick={() => setToDelete(null)}>Huỷ</Button>
          <Button variant="danger" loading={del.isPending || driveDel.isPending} onClick={doDelete}>{SCOPE[toDelete?.published?.state === 'done' ? scope : 'local'].btn}</Button>
        </>}>
        {toDelete?.published?.state === 'done' && (
          <div className={s.radios} role="radiogroup" aria-label="Phạm vi xoá">
            {(Object.keys(SCOPE) as DeleteScope[]).map((k) => (
              <label key={k} className={s.check}><input type="radio" name="del-scope" checked={scope === k} onChange={() => setScope(k)} /> {SCOPE[k].label}</label>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
