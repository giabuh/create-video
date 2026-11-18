import {useState} from 'react';
import {Film, GripVertical, MoreHorizontal, Pencil, Plus, Trash2} from 'lucide-react';
import {
  AudioPlayer, Button, Chip, ColorField, ConfirmDialog, Dialog, DropdownMenu, DropZone, Drawer, EmptyState, ErrorState, Field, IconButton, Input,
  NumberField, PageHeader, Popover, ProgressBar, RangeSlider, Segmented, Select, Skeleton, Slider, SortableList, Spinner, Switch, Tabs, TagInput,
  Textarea, Toaster, Tooltip, VideoThumb, toast, useTheme,
} from '../../ui/index.ts';
import type {TextSize, ThemeChoice} from '../../ui/index.ts';
import s from './UiGallery.module.css';

function Section({title, children}: {title: string; children: React.ReactNode}): React.JSX.Element {
  return <section className={s.sec}><h2>{title}</h2>{children}</section>;
}

const VOICES = [{value: 'phuong', label: 'Phương', hint: 'nữ'}, {value: 'binh', label: 'Bình', hint: 'nam'}, {value: 'ngoc', label: 'Ngọc', hint: 'nữ'}, {value: 'tam', label: 'Tâm', hint: 'nam', disabled: true}];

export function UiGallery(): React.JSX.Element {
  const {theme, setTheme, textSize, setTextSize} = useTheme();
  const [voice, setVoice] = useState<string | null>('phuong');
  const [tags, setTags] = useState(['khoá học', 'tiếng Anh']);
  const [n, setN] = useState<number | null>(1.5);
  const [vol, setVol] = useState(0.6);
  const [range, setRange] = useState<[number, number]>([2, 6.5]);
  const [on, setOn] = useState(true);
  const [seg, setSeg] = useState('real');
  const [tab, setTab] = useState('scenes');
  const [color, setColor] = useState('#F5B83D');
  const [dlg, setDlg] = useState(false);
  const [cfm, setCfm] = useState(false);
  const [cfmBusy, setCfmBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropLog, setDropLog] = useState('Chưa có file nào.');
  const [items, setItems] = useState(['Cảnh 1 — Mở đầu', 'Cảnh 2 — Học viên', 'Cảnh 3 — Giáo viên', 'Cảnh 4 — Ưu đãi', 'Cảnh 5 — Kêu gọi']);

  return (
    <div className={s.page}>
      <Toaster />
      <div className={s.top}>
        <PageHeader title="Thư viện giao diện" subtitle="Mọi thành phần UI, cả hai giao diện." />
        <div className={s.row}>
          <Segmented aria-label="Giao diện" size="sm" value={theme} onChange={(v) => setTheme(v as ThemeChoice)} options={[{value: 'system', label: 'Hệ thống'}, {value: 'light', label: 'Sáng'}, {value: 'dark', label: 'Tối'}]} />
          <Segmented aria-label="Cỡ chữ giao diện" size="sm" value={textSize} onChange={(v) => setTextSize(v as TextSize)} options={[{value: 'md', label: 'Vừa'}, {value: 'lg', label: 'Lớn'}, {value: 'xl', label: 'Rất lớn'}]} />
        </div>
      </div>

      <Section title="Buttons">
        <div className={s.row}>
          <Button variant="primary">Chính</Button><Button>Phụ</Button><Button variant="ghost">Nhẹ</Button><Button variant="danger">Xoá</Button>
          <Button size="sm">Nhỏ</Button><Button size="lg" variant="primary">Lớn</Button>
          <Button variant="primary" loading={loading} loadingText="Đang tạo giọng…" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 2000); }}>Tạo giọng</Button>
          <Button disabled>Vô hiệu</Button>
          <IconButton label="Thêm cảnh" icon={<Plus size={20} />} variant="secondary" />
        </div>
      </Section>

      <Section title="Fields">
        <div className={s.grid}>
          <Field label="Tiêu đề" hint="Hiển thị trên video"><Input placeholder="Nhập tiêu đề" /></Field>
          <Field label="Lời thoại"><Textarea autosize placeholder="Gõ nhiều dòng để thấy ô tự giãn" /></Field>
          <Field label="Tốc độ đọc"><NumberField value={n} onChange={setN} step={0.05} min={0.5} max={2} suffix="x" /></Field>
          <Field label="Giọng đọc"><Select value={voice} onChange={setVoice} options={VOICES} placeholder="Chọn giọng" /></Field>
          <Field label="Thẻ"><TagInput value={tags} onChange={setTags} placeholder="Gõ rồi Enter" suggestions={['học viên', 'giáo viên', 'ưu đãi', 'lớp học', 'IELTS']} /></Field>
          <Field label="Âm lượng"><Slider value={vol} onChange={setVol} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} /></Field>
          <Field label="Đoạn dùng được (giây)"><RangeSlider aria-label="Đoạn dùng được" value={range} onChange={setRange} min={0} max={10} step={0.1} format={(v) => `${v.toFixed(1)}s`} /></Field>
          <Switch checked={on} onChange={setOn} label="Phụ đề tự động" />
          <Field label="Nguồn cảnh"><Segmented aria-label="Nguồn cảnh" value={seg} onChange={setSeg} options={[{value: 'real', label: 'Quay thật'}, {value: 'motion', label: 'Đồ hoạ'}, {value: 'other', label: 'Khác'}]} /></Field>
          <Field label="Màu thương hiệu"><ColorField label="Màu thương hiệu" value={color} onChange={setColor} presets={['#F5B83D', '#6E9BFF', '#4CC38A', '#FF6B6B', '#CDB6FF']} /></Field>
        </div>
        <Tabs aria-label="Tab mẫu" value={tab} onChange={setTab} tabs={[{value: 'scenes', label: 'Cảnh'}, {value: 'voice', label: 'Giọng đọc'}, {value: 'music', label: 'Nhạc', badge: <Chip tone="accent">3</Chip>}]} />
      </Section>

      <Section title="Feedback">
        <div className={s.row}>
          {(['neutral', 'info', 'accent', 'success', 'warning', 'danger', 'voice'] as const).map((t) => <Chip key={t} tone={t}>{t}</Chip>)}
          <Spinner size={24} />
        </div>
        <div className={s.grid}>
          <ProgressBar value={0.45} label="Đang chuẩn hoá 45%" />
          <ProgressBar value={null} label="Đang chờ…" />
          <div><Skeleton height={20} /><div style={{height: 8}} /><Skeleton height={20} width="60%" /></div>
        </div>
        <div className={s.grid}>
          <div className={s.card}><EmptyState icon={<Film size={28} />} title="Chưa có cảnh nào" description="Thêm cảnh đầu tiên cho reel." action={<Button variant="primary">Thêm cảnh</Button>} /></div>
          <div className={s.card}><ErrorState error={new Error('Server không phản hồi')} onRetry={() => toast({title: 'Đang thử lại…'})} /></div>
        </div>
        <div className={s.row}>
          <Button onClick={() => toast({title: 'Đã lưu', description: 'Storyboard đã được cập nhật.', tone: 'success'})}>Toast thành công</Button>
          <Button onClick={() => toast({title: 'Đang dựng khung hình', tone: 'info', action: {label: 'Xem', onClick: () => {}}})}>Toast thông tin</Button>
          <Button onClick={() => toast({title: 'Lỗi lưu', description: 'Không ghi được file.', tone: 'error'})}>Toast lỗi</Button>
        </div>
      </Section>

      <Section title="Overlays">
        <div className={s.row}>
          <Button onClick={() => setDlg(true)}>Mở Dialog</Button>
          <Button onClick={() => setCfm(true)}>Xác nhận xoá</Button>
          <Button onClick={() => setDrawer(true)}>Mở Drawer</Button>
          <Popover trigger={<Button>Popover</Button>}><p style={{margin: 0, maxWidth: 220}}>Nội dung popover tuỳ ý.</p></Popover>
          <DropdownMenu trigger={<IconButton label="Thêm thao tác" icon={<MoreHorizontal size={20} />} variant="secondary" />} items={[
            {label: 'Đổi tên', icon: <Pencil size={16} />, onSelect: () => toast({title: 'Đổi tên'})}, 'separator',
            {label: 'Xoá', icon: <Trash2 size={16} />, danger: true, onSelect: () => toast({title: 'Xoá', tone: 'error'})},
          ]} />
          <Tooltip content="Gợi ý sau 400 ms"><Button variant="ghost">Rê chuột vào đây</Button></Tooltip>
        </div>
        <Dialog open={dlg} onOpenChange={setDlg} title="Đổi tên dự án" description="Tên mới hiển thị trong thư viện." footer={<><Button variant="ghost" onClick={() => setDlg(false)}>Huỷ</Button><Button variant="primary" onClick={() => setDlg(false)}>Lưu</Button></>}>
          <Field label="Tên dự án"><Input defaultValue="Khoá IELTS tháng 12" /></Field>
        </Dialog>
        <ConfirmDialog open={cfm} onOpenChange={setCfm} title="Xoá cảnh này?" description="Không thể hoàn tác." confirmLabel="Xoá cảnh" danger loading={cfmBusy}
          onConfirm={() => { setCfmBusy(true); setTimeout(() => { setCfmBusy(false); setCfm(false); }, 1200); }} />
        <Drawer open={drawer} onOpenChange={setDrawer} title="Tiến trình" footer={<Button onClick={() => setDrawer(false)}>Đóng</Button>}>
          <ProgressBar value={0.3} label="Cảnh 2/5" />
        </Drawer>
      </Section>

      <Section title="Media">
        <AudioPlayer src="/voices/phuong-short.wav" label="Phương" accent="voice" />
        <AudioPlayer src="/voices/phuong-full.wav" compact />
        <div className={s.thumbs}>
          <VideoThumb src="/voices/none.mp4" label="clip-001.mp4" />
          <VideoThumb label="Chưa chọn video" />
        </div>
        <DropZone accept={['.mp4', '.mov', '.jpg', '.png']} title="Kéo thả video vào đây" description="mp4, mov, jpg, png" buttonLabel="Chọn file" onFiles={(f) => setDropLog(`Đã nhận: ${f.map((x) => x.name).join(', ')}`)} />
        <p className={s.log} role="status">{dropLog}</p>
      </Section>

      <Section title="SortableList">
        <SortableList aria-label="Danh sách cảnh" items={items} getId={(x) => x} onReorder={setItems}
          renderItem={(t, {handleProps}) => (
            <div className={s.sortRow}>
              <button type="button" className={s.handle} aria-label={`Kéo để sắp xếp: ${t}`} {...handleProps}><GripVertical size={18} aria-hidden /></button>
              {t}
            </div>
          )} />
      </Section>
    </div>
  );
}
