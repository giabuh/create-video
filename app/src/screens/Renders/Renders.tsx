import {useCallback, useEffect, useRef, useState} from 'react';
import {Link, useNavigate, useParams} from 'react-router';
import {Film} from 'lucide-react';
import type {VersionInfo} from '../../../shared/types.ts';
import {useJobs} from '../../api/events.ts';
import {useCancelJob, useApprove, useDeleteRender, useOpenFolder, usePublish, useProject, useStartRender} from '../../api/hooks.ts';
import {Button, Chip, Dialog, EmptyState, Input, ErrorState, PageHeader, ProgressBar, Skeleton, fmtPct, toast} from '../../ui/index.ts';
import {VersionCard} from './VersionCard.tsx';
import s from './Renders.module.css';

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
  const publishJobs = useJobs().filter((j) => j.kind === 'publish' && j.project === slug && (j.state === 'running' || j.state === 'queued'));
  const [confirm, setConfirm] = useState<{v: VersionInfo; retry: boolean} | null>(null);
  const [name, setName] = useState('');
  const [toDelete, setToDelete] = useState<VersionInfo | null>(null);
  const [alsoDrive, setAlsoDrive] = useState(false);
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
    del.mutate({version: toDelete.name, drive: alsoDrive}, {
      onSuccess: (r) => { toast({title: `Đã xoá ${toDelete.name}`, tone: 'success'}); if (r.driveError) toast({title: 'Không xoá được trên Drive', description: r.driveError, tone: 'error'}); setToDelete(null); },
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
    body = <div className={s.grid}>{versions.map((v) => <VersionCard key={v.name} v={v} register={register} publishJob={publishJobs.find((j) => j.label.includes(` ${v.name} `))} onApprove={() => askName(v, false)} onRetry={() => askName(v, true)} onDelete={() => { setAlsoDrive(false); setToDelete(v); }} onOpenFolder={() => open.mutate(`projects/${slug}`, {onError: (e) => toast({title: 'Không mở được thư mục', description: e.message, tone: 'error'})})} />)}</div>;
  }

  const elapsed = job?.startedAt ? (now - job.startedAt) / 1000 : 0;
  return (
    <div className={s.page}>
      {header}
      <div className={s.layout}>
        {body}
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
      <Dialog open={!!toDelete} onOpenChange={(o) => { if (!o && !del.isPending) setToDelete(null); }} size="sm" title={`Xoá ${toDelete?.name ?? ''}?`}
        description="Xoá file video trên máy này. Storyboard của dự án vẫn giữ."
        footer={<>
          <Button variant="ghost" disabled={del.isPending} onClick={() => setToDelete(null)}>Huỷ</Button>
          <Button variant="danger" loading={del.isPending} onClick={doDelete}>Xoá</Button>
        </>}>
        {toDelete?.published?.state === 'done' && (
          <label className={s.check}><input type="checkbox" checked={alsoDrive} onChange={(e) => setAlsoDrive(e.target.checked)} /> Xoá cả trên Drive</label>
        )}
      </Dialog>
    </div>
  );
}
