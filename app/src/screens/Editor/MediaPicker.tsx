import {useMemo, useState} from 'react';
import {ImageOff} from 'lucide-react';
import {useLibrary} from '../../api/hooks.ts';
import {Button, Drawer, EmptyState, ErrorState, Input, Segmented, Skeleton, fmtSec} from '../../ui/index.ts';
import s from './Inspector.module.css';

const stem = (n: string) => n.replace(/\.[^.]+$/, '');
type Kind = 'all' | 'video' | 'image';
type Ori = 'all' | 'portrait' | 'landscape';

function Tile({name, type, duration, on, onPick}: {name: string; type: 'video' | 'image'; duration: number | null; on: boolean; onPick(): void}): React.JSX.Element {
  const [bad, setBad] = useState(false);
  return (
    <button type="button" className={`${s.pickTile} ${on ? s.pickOn : ''}`} aria-pressed={on} onClick={onPick} title={name}>
      <span className={s.pickThumb}>
        {bad ? <ImageOff size={22} aria-hidden /> : <img src={`/library/thumbs/${encodeURIComponent(stem(name))}.jpg`} alt="" loading="lazy" onError={() => setBad(true)} />}
        <span className={s.pickBadge}>{type === 'video' && duration != null ? fmtSec(duration) : 'Ảnh'}</span>
      </span>
      <span className={s.pickName}>{name}</span>
    </button>
  );
}

export function MediaPicker({open, onOpenChange, onAdd}: {open: boolean; onOpenChange(o: boolean): void; onAdd(names: string[]): void}): React.JSX.Element {
  const lib = useLibrary();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const [ori, setOri] = useState<Ori>('all');
  const [sel, setSel] = useState<string[]>([]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return Object.entries(lib.data?.data ?? {}).filter(([n, e]) =>
      (kind === 'all' || e.type === kind) && (ori === 'all' || e.orientation === ori)
      && (!t || `${n} ${e.description} ${e.tags.join(' ')}`.toLowerCase().includes(t)));
  }, [lib.data, q, kind, ori]);
  const close = (o: boolean) => { if (!o) setSel([]); onOpenChange(o); };
  const toggle = (n: string) => setSel((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]));
  return (
    <Drawer open={open} onOpenChange={close} title="Chọn từ thư viện" width={520}
      footer={<Button variant="primary" disabled={!sel.length} onClick={() => { onAdd(sel); close(false); }}>{sel.length ? `Thêm ${sel.length} file` : 'Chọn file để thêm'}</Button>}>
      <div className={s.stack}>
        <Input placeholder="Tìm theo tên, mô tả, thẻ…" aria-label="Tìm trong thư viện" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className={s.row}>
          <Segmented<Kind> aria-label="Loại" size="sm" value={kind} onChange={setKind} options={[{value: 'all', label: 'Tất cả'}, {value: 'video', label: 'Video'}, {value: 'image', label: 'Ảnh'}]} />
          <Segmented<Ori> aria-label="Chiều" size="sm" value={ori} onChange={setOri} options={[{value: 'all', label: 'Mọi chiều'}, {value: 'portrait', label: 'Dọc'}, {value: 'landscape', label: 'Ngang'}]} />
        </div>
        {lib.isPending ? <Skeleton height={200} />
          : lib.isError ? <ErrorState error={lib.error} onRetry={() => void lib.refetch()} />
          : rows.length === 0 ? <EmptyState icon={<ImageOff size={28} aria-hidden />} title="Không có file phù hợp" description="Thử đổi bộ lọc hoặc nạp thêm media ở màn Thư viện." />
          : <div className={s.pickGrid}>{rows.map(([n, e]) => <Tile key={n} name={n} type={e.type} duration={e.duration} on={sel.includes(n)} onPick={() => toggle(n)} />)}</div>}
      </div>
    </Drawer>
  );
}
