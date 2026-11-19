import {useEffect, useRef, useState} from 'react';
import {Link} from 'react-router';
import {Plus, Trash2} from 'lucide-react';
import type {LibraryEntry, LibraryResponse} from '../../../shared/types.ts';
import {useDeleteLibraryEntry, useSaveLibraryEntry} from '../../api/hooks.ts';
import {useJobs} from '../../api/events.ts';
import {Button, ConfirmDialog, Field, IconButton, RangeSlider, TagInput, Textarea, VideoThumb, fmtSec, fmtNum, toast} from '../../ui/index.ts';
import s from './Library.module.css';

const ORI = {portrait: 'dọc', landscape: 'ngang', square: 'vuông'} as const;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function Detail({name, lib, onGone}: {name: string; lib: LibraryResponse; onGone(): void}): React.JSX.Element {
  const server = lib.data[name];
  const [draft, setDraft] = useState<LibraryEntry>(server);
  const last = useRef(server);
  // Follow the server copy unless the user has unsaved edits.
  useEffect(() => {
    if (same(draft, last.current)) setDraft(server);
    last.current = server;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [server]);
  const [confirm, setConfirm] = useState(false);
  const save = useSaveLibraryEntry();
  const del = useDeleteLibraryEntry();
  const ingesting = useJobs().some((j) => j.kind === 'ingest' && (j.state === 'running' || j.state === 'queued'));
  const tags = [...new Set(Object.values(lib.data).flatMap((e) => e.tags))].sort();
  const used = lib.usage[name] ?? [];
  const slugs = [...new Set(used.map((u) => u.split(' · ')[0]))];
  const dirty = !same(draft, server);
  const dur = draft.duration ?? 0;
  const url = `/library/${encodeURIComponent(name)}`;
  const kind = draft.type === 'video' ? 'Video' : 'Ảnh';
  const setRange = (i: number, v: [number, number]) => setDraft({...draft, goodRanges: draft.goodRanges.map((r, j) => (j === i ? [r1(v[0]), r1(v[1])] : r))});

  const onSave = () => {
    if (ingesting) return toast({title: 'Đang nhập media, thử lại sau ít giây', tone: 'info'});
    save.mutate({name, entry: draft, baseMtime: lib.mtime}, {onSuccess: () => toast({title: 'Đã lưu mô tả', tone: 'success'})});
  };
  const onDelete = () => {
    if (ingesting) { setConfirm(false); return toast({title: 'Đang nhập media, thử lại sau ít giây', tone: 'info'}); }
    if (slugs.length) { setConfirm(false); return toast({title: 'Không xoá được: media đang được dùng', description: `Dự án: ${slugs.join(', ')}`, tone: 'error'}); }
    del.mutate(name, {onSuccess: () => { setConfirm(false); toast({title: `Đã xoá ${name}`, tone: 'success'}); onGone(); }, onError: () => setConfirm(false)});
  };

  return (
    <div className={s.form}>
      <div className={s.prev}>
        {draft.type === 'video'
          ? <div style={{width: `min(100%, ${(320 * draft.width) / draft.height}px)`, margin: '0 auto'}}><VideoThumb src={url} aspect={`${draft.width} / ${draft.height}`} label={name} playable contain /></div>
          : <img src={url} alt={name} />}
      </div>
      <div>
        <b style={{overflowWrap: 'anywhere'}}>{name}</b>
        <div className={s.cap}>{kind} {ORI[draft.orientation]} · {draft.width}×{draft.height}{draft.duration != null && ` · ${fmtSec(draft.duration)}`}</div>
      </div>
      <Field label="Mô tả (giúp Claude chọn đúng cảnh)">
        <Textarea rows={2} autosize value={draft.description} onChange={(e) => setDraft({...draft, description: e.target.value})} />
      </Field>
      <Field label="Tag">
        <TagInput value={draft.tags} onChange={(t) => setDraft({...draft, tags: t})} suggestions={tags} placeholder="Thêm tag…" />
      </Field>
      {draft.type === 'video' && (
        <div>
          <span className={s.lbl}>Đoạn dùng được</span>
          <div className={s.ranges}>
            {draft.goodRanges.map(([a, b], i) => (
              <div className={s.range} key={i}>
                <RangeSlider min={0} max={dur} step={0.1} format={fmtSec} value={[a, b ?? dur]} onChange={(v) => setRange(i, v)} aria-label={`Đoạn ${i + 1}`} />
                <IconButton label={`Xoá đoạn ${i + 1}`} size="sm" icon={<Trash2 size={16} />} onClick={() => setDraft({...draft, goodRanges: draft.goodRanges.filter((_, j) => j !== i)})} />
              </div>
            ))}
          </div>
          <div className={s.cap} style={{margin: 'var(--sp-3) 0'}}>
            {draft.goodRanges.length ? draft.goodRanges.map(([a, b]) => `${fmtNum(a, 1)}–${fmtNum(b ?? dur, 1)} s`).join(' · ') : 'Chưa có đoạn nào — Claude sẽ dùng cả video'}
          </div>
          <Button size="sm" icon={<Plus size={16} aria-hidden />} onClick={() => setDraft({...draft, goodRanges: [...draft.goodRanges, [0, dur]]})}>Thêm đoạn</Button>
        </div>
      )}
      <div className={s.links}>
        <span className={s.cap}>Đang dùng trong:</span>
        {slugs.length ? used.map((u) => <Link key={u} to={`/p/${encodeURIComponent(u.split(' · ')[0])}`}>{u}</Link>) : <span className={s.cap}>chưa dự án nào</span>}
      </div>
      <div className={s.actions}>
        <Button variant="primary" size="sm" loading={save.isPending} loadingText="Đang lưu…" disabled={!dirty} onClick={onSave}>Lưu</Button>
        <Button size="sm" onClick={() => setConfirm(true)}>Xoá khỏi thư viện</Button>
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} danger loading={del.isPending} title="Xoá khỏi thư viện?" confirmLabel="Xoá"
        description={`${name} sẽ bị xoá khỏi thư viện (file chuẩn hoá và thumbnail). File gốc không bị sửa.`} onConfirm={onDelete} />
    </div>
  );
}
