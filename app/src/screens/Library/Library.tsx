import {useEffect, useMemo, useState} from 'react';
import {byUsage, projectCounts, usageLabel} from './usageCount.ts';
import {ImageOff, SearchX} from 'lucide-react';
import type {LibraryEntry} from '../../../shared/types.ts';
import {useLibrary, useMusic, useSfx} from '../../api/hooks.ts';
import {useUploads} from '../../api/upload.ts';
import {Button, Drawer, DropZone, EmptyState, ErrorState, Input, PageHeader, Segmented, Skeleton, Tabs, fmtSec} from '../../ui/index.ts';
import {Detail} from './Detail.tsx';
import {DriveButton, DriveDrawer} from './DriveSync.tsx';
import {MEDIA_EXTS} from '../../../shared/exts.ts';
import {MusicTab} from './Music.tsx';
import {SfxTab} from './Sfx.tsx';
import {UploadRows} from './Uploads.tsx';
import s from './Library.module.css';

type Kind = 'all' | 'video' | 'image';
type Ori = 'portrait' | 'landscape' | 'all';
const noDesc = (e: LibraryEntry) => !e.description.trim();
const stem = (n: string) => n.replace(/\.[^.]+$/, '');

function useWide(): boolean {
  const [w, setW] = useState(() => window.matchMedia('(min-width: 1100px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1100px)');
    const f = () => setW(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return w;
}

function Tile({name, e, used, on, onPick}: {name: string; e: LibraryEntry; used: number; on: boolean; onPick(): void}): React.JSX.Element {
  const [bad, setBad] = useState(false);
  return (
    <button type="button" className={`${s.tile} ${on ? s.on : ''}`} aria-pressed={on} onClick={onPick}>
      <div className={s.thumb}>
        {bad ? <div style={{display: 'grid', placeItems: 'center', height: '100%', color: 'var(--muted)'}}><ImageOff size={24} aria-hidden /></div>
          : <img src={`/library/thumbs/${encodeURIComponent(stem(name))}.jpg`} alt="" loading="lazy" onError={() => setBad(true)} />}
        <span className={`${s.badge} ${s.usedBadge}`} title="Số dự án đã dùng file này">{usageLabel(used)}</span>
        <span className={s.badge}>{e.type === 'video' && e.duration != null ? fmtSec(e.duration) : 'Ảnh'}</span>
      </div>
      <div className={s.meta}>
        <span className={s.name} title={name}>{name}</span>
        <span className={`${s.desc} ${noDesc(e) ? s.warn : ''}`}>{noDesc(e) ? 'Chưa mô tả' : e.description}</span>
      </div>
    </button>
  );
}

function MediaTab(): React.JSX.Element {
  const {upload} = useUploads();
  const q = useLibrary();
  const wide = useWide();
  const [kind, setKind] = useState<Kind>('all');
  const [ori, setOri] = useState<Ori>('all');
  const [todo, setTodo] = useState(false);
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const data = q.data?.data;
  const entries = useMemo(() => Object.entries(data ?? {}), [data]);
  const counts = useMemo(() => projectCounts(q.data?.usage ?? {}), [q.data?.usage]);
  const missing = entries.filter(([, e]) => noDesc(e)).length;
  const shown = useMemo(() => {
    const t = search.trim().toLowerCase();
    return entries.filter(([n, e]) => (kind === 'all' || e.type === kind) && (ori === 'all' || e.orientation === ori) && (!todo || noDesc(e))
      && (!t || n.toLowerCase().includes(t) || e.description.toLowerCase().includes(t) || e.tags.some((x) => x.toLowerCase().includes(t)))).sort(byUsage(counts));
  }, [entries, kind, ori, todo, search, counts]);
  const reset = () => { setKind('all'); setOri('all'); setTodo(false); setSearch(''); };
  const current = q.data && sel && q.data.data[sel] ? sel : null;
  const detail = q.data && current ? <Detail key={current} name={current} lib={q.data} onGone={() => setSel(null)} /> : null;

  return (
    <div className={s.stack}>
      <DropZone accept={MEDIA_EXTS} title="Kéo-thả ảnh/video vào đây" description="MP4, MOV, HEIC, JPG… Tự xoay đúng chiều, đổi về 30 fps, tạo thumbnail." buttonLabel="Chọn file"
        onFiles={(f) => void upload(f, 'media')}>
        <UploadRows target="media" />
      </DropZone>
      {q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} />
        : (
          <>
            <div className={s.filters}>
              <Segmented<Kind> aria-label="Loại media" value={kind} onChange={setKind} options={[{value: 'all', label: 'Tất cả'}, {value: 'video', label: 'Video'}, {value: 'image', label: 'Ảnh'}]} />
              <Segmented<Ori> aria-label="Hướng khung hình" value={ori} onChange={setOri} options={[{value: 'portrait', label: 'Dọc'}, {value: 'landscape', label: 'Ngang'}, {value: 'all', label: 'Tất cả'}]} />
              <button type="button" className={s.pill} aria-pressed={todo} onClick={() => setTodo(!todo)}>Chưa mô tả · {missing}</button>
              <div className={s.search}><Input type="search" aria-label="Tìm media" placeholder="Tìm theo tên, mô tả, tag…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            </div>
            <div className={s.body}>
              <div className={s.grid} aria-busy={q.isPending}>
                {q.isPending && Array.from({length: 8}, (_, i) => (
                  <div key={i} style={{display: 'flex', flexDirection: 'column', gap: 8}}><Skeleton height={128} radius={12} /><Skeleton height={14} width="70%" /><Skeleton height={12} width="50%" /></div>
                ))}
                {shown.map(([n, e]) => <Tile key={n} name={n} e={e} used={counts[n] ?? 0} on={n === current} onPick={() => setSel(n)} />)}
              </div>
              {wide && detail && <aside className={s.detail} aria-label="Chi tiết media">{detail}</aside>}
            </div>
            {q.data && entries.length === 0 && <EmptyState icon={<ImageOff size={28} />} title="Thư viện chưa có media" description="Kéo-thả ảnh hoặc video vào khung phía trên để bắt đầu." />}
            {q.data && entries.length > 0 && shown.length === 0 && (
              <EmptyState icon={<SearchX size={28} />} title="Không có media khớp bộ lọc" action={<Button onClick={reset}>Xoá bộ lọc</Button>} />
            )}
            {!wide && <Drawer open={!!detail} onOpenChange={(o) => { if (!o) setSel(null); }} title="Chi tiết media" width={420}>{detail}</Drawer>}
          </>
        )}
    </div>
  );
}

export function LibraryScreen(): React.JSX.Element {
  const [tab, setTab] = useState<'media' | 'music' | 'sfx'>('media');
  const lib = useLibrary();
  const music = useMusic();
  const sfx = useSfx();
  const [drive, setDrive] = useState(false);
  return (
    <>
      <PageHeader title="Thư viện" subtitle="Ảnh, video học viên và nhạc nền. File gốc không bị sửa — app tạo bản chuẩn hoá trong library/." actions={<DriveButton onClick={() => setDrive(true)} />} />
      <DriveDrawer open={drive} onOpenChange={setDrive} />
      <div className={s.tabs}>
        <Tabs<'media' | 'music' | 'sfx'> aria-label="Loại thư viện" value={tab} onChange={setTab} tabs={[
          {value: 'media', label: `Ảnh & video${lib.data ? ` · ${Object.keys(lib.data.data).length}` : ''}`},
          {value: 'music', label: `Nhạc${music.data ? ` · ${music.data.length}` : ''}`},
          {value: 'sfx', label: `Hiệu ứng âm thanh${sfx.data ? ` · ${sfx.data.length}` : ''}`},
        ]} />
      </div>
      {tab === 'media' ? <MediaTab /> : tab === 'music' ? <MusicTab /> : <SfxTab />}
    </>
  );
}
