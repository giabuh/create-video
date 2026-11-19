import {useState} from 'react';
import {useDeleteProject, useProject} from '../../api/hooks.ts';
import {Button, Dialog, Skeleton, fmtBytes, toast} from '../../ui/index.ts';
import s from './Projects.module.css';

export function DeleteProjectDialog({slug, open, onOpenChange}: {slug: string; open: boolean; onOpenChange(o: boolean): void}): React.JSX.Element {
  const q = useProject(slug);
  const del = useDeleteProject(slug);
  const [picked, setPicked] = useState<string[]>([]);
  const versions = q.data?.versions ?? [];
  const done = versions.filter((v) => v.published?.state === 'done');
  const todo = versions.filter((v) => v.published?.state !== 'done');
  const n = picked.length;
  const toggle = (name: string) => setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : [...p, name]));
  const go = () => del.mutate({upload: picked}, {
    onSuccess: () => onOpenChange(false),
    onError: (e) => toast({title: 'Không xoá được dự án', description: e.message, tone: 'error'}),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && del.isPending) return; onOpenChange(o); }} size="sm"
      title={done.length === 0 && versions.length > 0 ? 'Chưa có bản nào trên Drive — xoá luôn hay đẩy lên Drive rồi xoá?' : `Xoá dự án ${slug}?`}
      description="Thư viện footage và nhạc không bị xoá."
      footer={<>
        <Button variant="ghost" disabled={del.isPending} onClick={() => onOpenChange(false)}>Huỷ</Button>
        <Button variant="danger" loading={del.isPending} disabled={q.isPending} onClick={go}>{n ? `Đẩy ${n} bản lên Drive rồi xoá` : 'Xoá luôn'}</Button>
      </>}>
      {q.isPending ? <Skeleton height={60} /> : (
        <div className={s.form}>
          {todo.map((v) => (
            <label key={v.name} className={s.check}>
              <input type="checkbox" checked={picked.includes(v.name)} onChange={() => toggle(v.name)} />
              {v.name} · {v.kind === 'draft' ? 'Nháp 540p' : '1080p'} · {fmtBytes(v.bytes)} · {new Date(v.mtime).toLocaleDateString('vi-VN')}
            </label>
          ))}
          {done.map((v) => <span key={v.name} className={s.sub}>{v.name} · Đã lên Drive · {v.published?.name}</span>)}
        </div>
      )}
    </Dialog>
  );
}
