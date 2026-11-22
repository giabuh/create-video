import {useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router';
import {Film, FolderPlus, MoreVertical, Plus} from 'lucide-react';
import type {ProjectStatus, ProjectSummary} from '../../../shared/types.ts';
import {slugify} from '../../../shared/slugify.ts';
import {useJobs} from '../../api/events.ts';
import {useBrands, useCancelDelete, useCreateProject, useDeleteProject, useProjects, useTemplates, useVoices} from '../../api/hooks.ts';
import {Button, Chip, Dialog, DropdownMenu, EmptyState, ErrorState, Field, IconButton, Input, PageHeader, ProgressBar, Segmented, Select, Skeleton, VideoThumb, fmtRelTime, fmtSec, toast} from '../../ui/index.ts';
import type {Tone} from '../../ui/index.ts';
import {DeleteProjectDialog} from './DeleteProjectDialog.tsx';
import s from './Projects.module.css';

type Filter = 'all' | 'doing' | 'approved' | 'new';

const matches = (st: ProjectStatus, f: Filter) => f === 'all' || (f === 'doing' ? st === 'rendering' || st === 'draft' : f === 'approved' ? st === 'approved' : st === 'new');

function statusChip(p: ProjectSummary): React.JSX.Element {
  const v = p.latest ? ` v${p.latest.n}` : '';
  const [tone, text]: [Tone, string] =
    p.status === 'deleting' ? (p.deleting?.state === 'failed' ? ['danger', 'Xoá dở: lỗi Drive'] : ['info', 'Đang xoá']) :
    p.status === 'rendering' ? ['accent', 'Đang render'] :
    p.status === 'approved' ? ['success', `Đã duyệt${p.approved ? ` ${p.approved.replace(/^reel-/, '')}` : v}`] :
    p.status === 'draft' ? ['warning', `Chưa duyệt${v}`] : ['neutral', 'Chưa render'];
  return <Chip tone={tone} icon={p.status === 'rendering' ? <Film size={14} aria-hidden /> : undefined}>{text}</Chip>;
}

const cap = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

function Card({p}: {p: ProjectSummary}): React.JSX.Element {
  const meta = [`${p.sceneCount} cảnh`, p.totalSeconds != null ? fmtSec(p.totalSeconds) : 'chưa tạo giọng', p.voice && cap(p.voice)].filter(Boolean).join(' · ');
  const [askDelete, setAskDelete] = useState(false);
  const retry = useDeleteProject(p.slug), cancel = useCancelDelete(p.slug);
  const deleting = p.status === 'deleting';
  const failed = p.deleting?.state === 'failed';
  const job = useJobs().find((j) => j.kind === 'delete-project' && j.project === p.slug && (j.state === 'running' || j.state === 'queued'));
  const inner = (
    <>
      <div className={s.thumb}><VideoThumb aspect={`${p.size.width} / ${p.size.height}`} src={p.latest ? `/${p.latest.file}` : null} label={p.firstCaption || 'Chưa render'} /></div>
      <div className={s.meta}>
        <div className={s.row}><span className={s.name} title={p.slug}>{p.slug}</span>{statusChip(p)}</div>
        <div className={s.sub}>{meta}</div>
        <div className={s.sub}>Sửa {fmtRelTime(p.mtime)}</div>
      </div>
    </>
  );
  const fail = (e: {message: string}) => toast({title: 'Không thực hiện được', description: e.message, tone: 'error'});
  return (
    <div className={s.cardWrap}>
      {deleting
        ? <div className={s.card} aria-disabled>{inner}</div>
        : <Link to={`/p/${encodeURIComponent(p.slug)}`} className={s.card}>{inner}</Link>}
      {deleting && !failed && (
        <div className={s.delBar}>
          <ProgressBar value={job?.progress ?? null} size="sm" label={`Đang xoá ${p.slug}`} />
          <span className={s.sub} title={job?.step}>{job?.step || 'Đang xoá…'}</span>
        </div>
      )}
      {failed && (
        <div className={s.failBar}>
          <span className={s.sub} title={p.deleting?.error}>{p.deleting?.error ?? 'Đẩy lên Drive lỗi'}</span>
          <Button size="sm" variant="danger" loading={retry.isPending} onClick={() => retry.mutate(undefined, {onError: fail})}>Thử lại</Button>
          <Button size="sm" variant="ghost" loading={cancel.isPending} onClick={() => cancel.mutate(undefined, {onError: fail})}>Huỷ xoá</Button>
        </div>
      )}
      {!deleting && (
        <div className={s.menuBtn}>
          <DropdownMenu align="end" trigger={<IconButton label={`Tuỳ chọn ${p.slug}`} icon={<MoreVertical size={18} aria-hidden />} />}
            items={[{label: 'Xoá dự án', danger: true, onSelect: () => setAskDelete(true)}]} />
        </div>
      )}
      {askDelete && <DeleteProjectDialog slug={p.slug} open={askDelete} onOpenChange={setAskDelete} />}
    </div>
  );
}

function NewDialog({open, onOpenChange}: {open: boolean; onOpenChange(o: boolean): void}): React.JSX.Element {
  const nav = useNavigate();
  const templates = useTemplates(), brands = useBrands(), voices = useVoices();
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [tpl, setTpl] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);
  const [voice, setVoice] = useState<string | null>(null);
  const [format, setFormat] = useState<'doc' | 'ngang'>('doc');
  const [err, setErr] = useState<string>();
  // fall back to the server defaults (first entry marked default) until the user picks
  const tplV = tpl ?? templates.data?.[0] ?? null;
  const brandV = brand ?? brands.data?.find((b) => b.isDefault)?.id ?? brands.data?.[0]?.id ?? null;
  const voiceV = voice ?? voices.data?.find((v) => v.isDefault)?.name ?? voices.data?.[0]?.name ?? null;
  const valid = name.trim() !== '';
  const submit = () => {
    if (!valid || create.isPending) return;
    setErr(undefined);
    create.mutate({name: name.trim(), template: tplV ?? undefined, brand: brandV ?? undefined, voice: voiceV ?? undefined, ...(tplV === 'explainer' ? {format} : {})}, {
      onSuccess: (p) => nav(`/p/${encodeURIComponent(p.slug)}`),
      onError: (e) => setErr(e.status === 409 ? 'Đã có dự án tên này' : e.message),
    });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Dự án mới" description="Chọn mẫu, brand và giọng — rồi bàn kịch bản với Claude trong trình sửa."
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Huỷ</Button><Button variant="primary" loading={create.isPending} loadingText="Đang tạo…" disabled={!valid} onClick={submit}>Tạo dự án</Button></>}>
      <form className={s.form} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Tên dự án" error={err} hint={name.trim() ? `Thư mục: projects/${slugify(name)}` : undefined}>
          <Input value={name} autoFocus onChange={(e) => { setName(e.target.value); setErr(undefined); }} placeholder="vd. Khai giảng lớp mới" />
        </Field>
        <Field label="Mẫu"><Select value={tplV} onChange={setTpl} options={(templates.data ?? []).map((t) => ({value: t, label: t}))} placeholder="Chọn mẫu" /></Field>
        {tplV === 'explainer' && <Field label="Khổ"><Segmented aria-label="Khổ video" value={format} onChange={(v) => setFormat(v === 'ngang' ? 'ngang' : 'doc')} options={[{value: 'doc' as const, label: 'Dọc 9:16'}, {value: 'ngang' as const, label: 'Ngang 16:9'}]} /></Field>}
        <Field label="Brand"><Select value={brandV} onChange={setBrand} options={(brands.data ?? []).map((b) => ({value: b.id, label: b.brand.name || b.id}))} placeholder="Chọn brand" /></Field>
        <Field label="Giọng"><Select value={voiceV} onChange={setVoice} options={(voices.data ?? []).map((v) => ({value: v.name, label: cap(v.name)}))} placeholder="Chọn giọng" /></Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export function ProjectsScreen(): React.JSX.Element {
  const {data, isPending, error, refetch} = useProjects();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [gen, setGen] = useState(0); // remount on open (fresh form), never on close (keeps the exit animation)
  const openNew = () => { setGen((g) => g + 1); setOpen(true); };
  const count = (f: Filter) => (data ?? []).filter((p) => matches(p.status, f)).length;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ?? []).filter((p) => matches(p.status, filter) && (!t || p.slug.toLowerCase().includes(t) || p.firstCaption.toLowerCase().includes(t)));
  }, [data, filter, q]);
  const newBtn = <Button variant="primary" icon={<Plus size={18} aria-hidden />} onClick={openNew}>Dự án mới</Button>;

  let body: React.JSX.Element;
  if (error) body = <ErrorState error={error} onRetry={() => void refetch()} />;
  else if (isPending) body = <div className={s.grid}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={420} radius={14} />)}</div>;
  else if (data.length === 0) body = <EmptyState icon={<FolderPlus size={28} />} title="Chưa có dự án nào" description="Tạo dự án đầu tiên: chọn mẫu, brand và giọng." action={newBtn} />;
  else body = (
    <>
      <div className={s.tools}>
        <Segmented<Filter> className={s.statusFilter} aria-label="Lọc dự án" value={filter} onChange={setFilter} options={[
          {value: 'all', label: `Tất cả · ${count('all')}`}, {value: 'doing', label: `Đang làm · ${count('doing')}`},
          {value: 'approved', label: `Đã duyệt · ${count('approved')}`}, {value: 'new', label: `Chưa render · ${count('new')}`}]} />
      </div>
      <div className={s.grid}>
        {shown.map((p) => <Card key={p.slug} p={p} />)}
        <button type="button" className={s.new} onClick={openNew}>
          <Plus size={28} aria-hidden /><b>Tạo dự án mới</b><span>Chọn mẫu, brand và giọng — rồi bàn kịch bản với Claude</span>
        </button>
      </div>
      {shown.length === 0 && <p className={s.sub}>Không có dự án khớp bộ lọc.</p>}
    </>
  );

  return (
    <>
      <PageHeader title="Dự án" subtitle="Mở lại video đang làm hoặc tạo dự án mới."
        actions={<><Input className={s.search} type="search" aria-label="Tìm dự án" placeholder="Tìm dự án…" value={q} onChange={(e) => setQ(e.target.value)} />{newBtn}</>} />
      {body}
      <NewDialog key={gen} open={open} onOpenChange={setOpen} />
    </>
  );
}
