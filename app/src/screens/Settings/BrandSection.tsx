import {useEffect, useMemo, useRef, useState} from 'react';
import {Player} from '@remotion/player';
import {useQueryClient} from '@tanstack/react-query';
import {Plus, Trash2} from 'lucide-react';
import {CtaCard} from '@studio/components/CtaCard';
import type {BrandFile, BrandSummary} from '../../../shared/types.ts';
import {DEFAULT_ACCENT2, DEFAULT_SURFACE} from '../../../shared/brandDefaults.ts';
import {qk, useCreateBrand, useDeleteBrand, useLogoCutout, useSaveBrand, useSaveConfig, useConfig} from '../../api/hooks.ts';
import {useUploads} from '../../api/upload.ts';
import type {HttpError} from '../../api/client.ts';
import {Button, Chip, ConfirmDialog, Dialog, Slider, DropZone, EmptyState, Field, Input, ColorField, Skeleton, toast} from '../../ui/index.ts';
import s from './Settings.module.css';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'] as const; // mirrors app/server/paths.ts (the server cannot be imported in the browser)
const PLACEHOLDER_ADDRESS = '[ĐỊA CHỈ] — để trống nếu không hiện';
const COLORS = [['primary', 'Chính'], ['accent', 'Nhấn (từ nổi bật)'], ['text', 'Chữ'], ['background', 'Nền cảnh motion'], ['accent2', 'Nhấn 2 (băng đỏ, ruy băng)'], ['surface', 'Nền sáng (ô trắng)']] as const;
const DEFAULT_COLORS = {accent2: DEFAULT_ACCENT2, surface: DEFAULT_SURFACE} as const;
const colorOf = (c: BrandFile['colors'], k: (typeof COLORS)[number][0]) => c[k] ?? DEFAULT_COLORS[k as keyof typeof DEFAULT_COLORS];

type Form = {name: string; title: string; logoSize: number; colors: BrandFile['colors']; phone: string; fanpage: string; address: string};
const toForm = (b: BrandFile): Form => ({name: b.name, title: b.cta?.title ?? '', logoSize: b.cta?.logoSize ?? 260, colors: b.colors, phone: b.cta?.phone ?? '', fanpage: b.cta?.fanpage ?? '', address: b.cta?.address ?? ''});
const same = (a: Form, b: Form) => a.name === b.name && a.title === b.title && a.logoSize === b.logoSize && a.phone === b.phone && a.fanpage === b.fanpage && a.address === b.address && COLORS.every(([k]) => colorOf(a.colors, k) === colorOf(b.colors, k));
// Uploads store "brands/<id>/<file>"; the pipeline prefixes the id itself, so accept both shapes.
const logoPath = (id: string, logo: string | null) => (logo ? (logo.startsWith('brands/') ? logo : `brands/${id}/${logo}`) : null);

export function BrandSection({brands}: {brands: BrandSummary[]}): React.JSX.Element {
  const [sel, setSel] = useState(() => (brands.find((b) => b.isDefault) ?? brands[0])?.id ?? null);
  const [drafts, setDrafts] = useState<Record<string, Form>>({});
  const [adding, setAdding] = useState(false);
  const cur = brands.find((b) => b.id === sel) ?? brands[0];
  return (
    <div className={s.brandRow}>
      <section className={`${s.card} ${s.list}`} aria-label="Danh sách brand">
        {brands.map((b) => (
          <button key={b.id} type="button" className={s.item} aria-current={b.id === cur?.id} onClick={() => setSel(b.id)}>
            <i className={s.dot} style={{background: (drafts[b.id] ?? b.brand).colors.primary}} />
            <span className={s.itemName}>{(drafts[b.id]?.name ?? b.brand.name) || b.id}</span>
            {b.isDefault && <Chip tone="success">Mặc định</Chip>}
          </button>
        ))}
        <button type="button" className={s.item} onClick={() => setAdding(true)}><Plus size={18} aria-hidden />Thêm brand</button>
      </section>
      {cur
        ? <BrandEditor key={cur.id} summary={cur} draft={drafts[cur.id] ?? null} setDraft={(f) => setDrafts((d) => {
            const {[cur.id]: _, ...rest} = d;
            return f ? {...rest, [cur.id]: f} : rest;
          })} />
        : <section className={`${s.card} ${s.editor}`}><EmptyState icon={<Plus size={28} />} title="Chưa có brand nào" action={<Button variant="primary" onClick={() => setAdding(true)}>Thêm brand</Button>} /></section>}
      <AddBrandDialog open={adding} onOpenChange={setAdding} onCreated={setSel} />
    </div>
  );
}

function AddBrandDialog({open, onOpenChange, onCreated}: {open: boolean; onOpenChange(o: boolean): void; onCreated(id: string): void}): React.JSX.Element {
  const create = useCreateBrand();
  const [name, setName] = useState('');
  const submit = () => create.mutate(name.trim(), {onSuccess: (b) => { onCreated(b.id); onOpenChange(false); setName(''); toast({title: `Đã tạo brand "${b.brand.name}"`, tone: 'success'}); }});
  const err = create.error as HttpError | null;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) create.reset(); onOpenChange(o); }} title="Thêm brand" description="Màu được sao chép từ brand mặc định, bạn chỉnh lại sau." size="sm"
      footer={<><Button variant="ghost" onClick={() => onOpenChange(false)}>Huỷ</Button><Button variant="primary" loading={create.isPending} loadingText="Đang tạo…" disabled={!name.trim()} onClick={submit}>Tạo brand</Button></>}>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim() && !create.isPending) submit(); }}>
        <Field label="Tên brand" error={err ? (err.status === 409 ? 'Brand này đã tồn tại' : err.message) : undefined}>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
      </form>
    </Dialog>
  );
}

function BrandEditor({summary, draft, setDraft}: {summary: BrandSummary; draft: Form | null; setDraft(f: Form | null): void}): React.JSX.Element {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const del = useDeleteBrand();
  const cutout = useLogoCutout();
  const {id, brand} = summary;
  const base = useMemo(() => toForm(brand), [brand]);
  const form = draft ?? base;
  const dirty = draft !== null && !same(draft, base);
  const qc = useQueryClient();
  const save = useSaveBrand();
  const config = useConfig();
  const saveConfig = useSaveConfig();
  const {items, upload} = useUploads();
  const handled = useRef(new Set<string>());
  const set = (p: Partial<Form>) => setDraft({...form, ...p});

  // A finished logo upload rewrote brand.json on the server: refetch to pick up the new logo and mtime.
  useEffect(() => {
    for (const it of items) {
      if (it.target !== 'logo' || it.state === 'uploading' || handled.current.has(it.id)) continue;
      handled.current.add(it.id);
      if (it.state === 'done') void qc.invalidateQueries({queryKey: qk.brands});
      else toast({title: 'Không tải được logo', description: it.error, tone: 'error'});
    }
  }, [items, qc]);
  const uploading = items.some((it) => it.target === 'logo' && it.state === 'uploading');

  const onSave = () => {
    const next: BrandFile = {...brand, name: form.name.trim() || brand.name, colors: form.colors, cta: {...brand.cta, title: form.title, logoSize: form.logoSize, phone: form.phone, fanpage: form.fanpage, address: form.address}};
    save.mutate({id, brand: next, baseMtime: summary.mtime}, {
      onSuccess: () => { setDraft(null); toast({title: 'Đã lưu brand', tone: 'success'}); },
      onError: (e) => {
        if (e.status === 409) { setDraft(null); void qc.invalidateQueries({queryKey: qk.brands}); toast({title: 'File vừa được sửa bên ngoài — đã tải lại', tone: 'info'}); }
        else toast({title: 'Không lưu được brand', description: e.message, tone: 'error'});
      },
    });
  };
  const makeDefault = () => {
    if (!config.data) return;
    saveConfig.mutate({config: {...config.data.data, defaults: {...config.data.data.defaults, brand: id}}, baseMtime: config.data.mtime}, {
      onSuccess: () => { void qc.invalidateQueries({queryKey: qk.brands}); toast({title: 'Đã đặt làm brand mặc định', tone: 'success'}); },
      onError: (e) => {
        if (e.status === 409) void qc.invalidateQueries({queryKey: qk.config});
        toast(e.status === 409 ? {title: 'config.json vừa được sửa bên ngoài — đã tải lại, thử lại nhé', tone: 'info'} : {title: 'Không lưu được cài đặt', description: e.message, tone: 'error'});
      },
    });
  };

  const logo = logoPath(id, brand.logo);
  const previewBrand = useMemo(() => ({name: form.name, logo, colors: form.colors}), [form.name, logo, form.colors]);
  const cta = useMemo(() => ({title: form.title || 'Đăng ký ngay', logoSize: form.logoSize, phone: form.phone, fanpage: form.fanpage, address: form.address, duration: 3}), [form.title, form.logoSize, form.phone, form.fanpage, form.address]);
  const inputProps = useMemo(() => ({cta, brand: previewBrand}), [cta, previewBrand]);
  const preview = (
    <div className={s.previewBox}>
      <Player component={CtaCard} inputProps={inputProps} compositionWidth={1080} compositionHeight={1920} fps={30} durationInFrames={90}
        initialFrame={89} acknowledgeRemotionLicense style={{width: '100%', height: '100%'}} />
    </div>
  );

  return (
    <>
      <section className={`${s.card} ${s.editor}`} aria-label="Sửa brand">
        <div className={s.head}>
          <h2>{brand.name}</h2>
          <Button className={s.mobilePreview} onClick={() => setPreviewOpen(true)}>Xem CTA</Button>
        </div>
        <div className={s.grid2}>
          <Field label="Tên"><Input value={form.name} onChange={(e) => set({name: e.target.value})} /></Field>
          <div>
            <span className={s.label}>Logo</span>
            <DropZone compact multiple={false} accept={IMAGE_EXTS} title="Logo" description="PNG nền trong" buttonLabel={logo ? 'Đổi logo' : 'Tải logo'}
              icon={logo ? <img className={s.logoImg} src={`/${logo}?v=${summary.mtime}`} alt={`Logo ${brand.name}`} /> : undefined}
              onFiles={(f) => void upload(f, 'logo', {brandId: id})}>
              {logo && <Button size="sm" variant="ghost" loading={cutout.isPending} loadingText="Đang tách…" onClick={() => cutout.mutate(id, {onSuccess: () => toast({title: 'Đã tách nền logo', tone: 'success'}), onError: (e) => toast({title: e.message, tone: 'info'})})}>Tách nền</Button>}
            </DropZone>
          </div>
        </div>
        <div>
          <span className={s.label}>Màu</span>
          <div className={s.colors}>
            {COLORS.map(([k, label]) => (
              <div key={k}><span className={s.label}>{label}</span><ColorField label={label} value={colorOf(form.colors, k)} onChange={(v) => set({colors: {...form.colors, [k]: v}})} /></div>
            ))}
          </div>
        </div>
        <h3>Thẻ CTA cuối video</h3>
        <Field label="Tiêu đề CTA" hint="Dòng chữ lớn trên thẻ cuối video. Mỗi video vẫn sửa riêng được."><Input value={form.title} placeholder="Đăng ký ngay" onChange={(e) => set({title: e.target.value})} /></Field>
        {logo && <Field label={`Cỡ logo trên CTA: ${form.logoSize}px`}><Slider aria-label="Cỡ logo trên CTA" min={120} max={800} step={10} value={form.logoSize} format={(v) => `${v}px`} onChange={(v) => set({logoSize: v})} /></Field>}
        <div className={s.grid2}>
          <Field label="Số điện thoại"><Input value={form.phone} placeholder="[SĐT] — để trống nếu không hiện" onChange={(e) => set({phone: e.target.value})} /></Field>
          <Field label="Fanpage"><Input value={form.fanpage} placeholder="[FANPAGE] — để trống nếu không hiện" onChange={(e) => set({fanpage: e.target.value})} /></Field>
        </div>
        <Field label="Địa chỉ"><Input value={form.address} placeholder={PLACEHOLDER_ADDRESS} onChange={(e) => set({address: e.target.value})} /></Field>
        <div className={s.saveBar}>
          <Button variant="primary" disabled={!dirty} loading={save.isPending} loadingText="Đang lưu…" onClick={onSave}>Lưu brand</Button>
          {summary.isDefault
            ? <Chip tone="success">Đang là mặc định</Chip>
            : <Button loading={saveConfig.isPending} loadingText="Đang lưu…" disabled={!config.data} onClick={makeDefault}>Đặt làm mặc định</Button>}
          {dirty && <span className={s.dirty} role="status">Có thay đổi chưa lưu</span>}
          {dirty && <Button variant="ghost" onClick={() => setDraft(null)}>Hoàn tác</Button>}
          {!summary.isDefault && <Button variant="danger" className={s.delBtn} onClick={() => setConfirmDel(true)}><Trash2 size={16} aria-hidden />Xoá brand</Button>}
        </div>
      </section>
      <section className={s.preview} aria-label="Xem trước CTA">
        <b>Xem trước CTA</b>
        {preview}
      </section>
      <ConfirmDialog open={confirmDel} onOpenChange={setConfirmDel} danger loading={del.isPending} title={`Xoá brand "${brand.name}"?`}
        description="Xoá cả thư mục brand (logo, màu, CTA). Không hoàn tác được. Brand mặc định hoặc brand đang được dự án dùng thì không xoá được." confirmLabel="Xoá brand"
        onConfirm={() => del.mutate(id, {onSuccess: () => { setConfirmDel(false); toast({title: 'Đã xoá brand', tone: 'success'}); }, onError: (e) => { setConfirmDel(false); toast({title: 'Không xoá được brand', description: e.message, tone: 'error'}); }})} />
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen} title="Xem trước CTA" size="sm">
        <div className={s.dialogPreview}>{preview}</div>
      </Dialog>
    </>
  );
}

export function BrandSkeleton(): React.JSX.Element {
  return (
    <div className={s.brandRow} aria-busy>
      <div className={`${s.card} ${s.list}`}><Skeleton height={44} /><Skeleton height={44} /></div>
      <div className={`${s.card} ${s.editor}`}><Skeleton height={28} width="40%" /><Skeleton height={44} /><Skeleton height={120} /><Skeleton height={44} /></div>
    </div>
  );
}
