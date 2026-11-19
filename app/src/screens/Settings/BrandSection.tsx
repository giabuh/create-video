import {useEffect, useMemo, useRef, useState} from 'react';
import {Player} from '@remotion/player';
import {useQueryClient} from '@tanstack/react-query';
import {Plus} from 'lucide-react';
import {CtaCard} from '@studio/components/CtaCard';
import type {BrandFile, BrandSummary} from '../../../shared/types.ts';
import {qk, useCreateBrand, useSaveBrand, useSaveConfig, useConfig} from '../../api/hooks.ts';
import {useUploads} from '../../api/upload.ts';
import type {HttpError} from '../../api/client.ts';
import {Button, Chip, Dialog, DropZone, EmptyState, Field, Input, ColorField, Skeleton, toast} from '../../ui/index.ts';
import s from './Settings.module.css';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.svg'] as const; // mirrors app/server/paths.ts (the server cannot be imported in the browser)
const PLACEHOLDER_ADDRESS = '[ĐỊA CHỈ] — để trống nếu không hiện';
const COLORS = [['primary', 'Chính'], ['accent', 'Nhấn (từ nổi bật)'], ['text', 'Chữ'], ['background', 'Nền cảnh motion']] as const;

type Form = {name: string; colors: BrandFile['colors']; phone: string; fanpage: string; address: string};
const toForm = (b: BrandFile): Form => ({name: b.name, colors: b.colors, phone: b.cta?.phone ?? '', fanpage: b.cta?.fanpage ?? '', address: b.cta?.address ?? ''});
const same = (a: Form, b: Form) => a.name === b.name && a.phone === b.phone && a.fanpage === b.fanpage && a.address === b.address && COLORS.every(([k]) => a.colors[k] === b.colors[k]);
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
    const next: BrandFile = {...brand, name: form.name.trim() || brand.name, colors: form.colors, cta: {...brand.cta, phone: form.phone, fanpage: form.fanpage, address: form.address}};
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
  const cta = useMemo(() => ({title: 'Đăng ký ngay', phone: form.phone, fanpage: form.fanpage, address: form.address, duration: 3}), [form.phone, form.fanpage, form.address]);
  const inputProps = useMemo(() => ({cta, brand: previewBrand}), [cta, previewBrand]);

  return (
    <>
      <section className={`${s.card} ${s.editor}`} aria-label="Sửa brand">
        <div className={s.head}>
          <h2>{brand.name}</h2>
          <span className={s.path}>brands/{id}/brand.json</span>
        </div>
        <div className={s.grid2}>
          <Field label="Tên"><Input value={form.name} onChange={(e) => set({name: e.target.value})} /></Field>
          <div>
            <span className={s.label}>Logo</span>
            <div className={s.logoBox}>
              {logo ? <img className={s.logoImg} src={`/${logo}?v=${summary.mtime}`} alt={`Logo ${brand.name}`} /> : <span className={`${s.logoImg} ${s.logoNone}`}>Chưa có</span>}
              <div style={{flex: 1, minWidth: 0}}>
                {uploading
                  ? <Button loading loadingText="Đang tải logo…">Tải logo</Button>
                  : <DropZone compact multiple={false} accept={IMAGE_EXTS} title="Logo" description="PNG nền trong" buttonLabel={logo ? 'Đổi logo' : 'Tải logo'} onFiles={(f) => void upload(f, 'logo', {brandId: id})} />}
              </div>
            </div>
          </div>
        </div>
        <div>
          <span className={s.label}>Màu</span>
          <div className={s.colors}>
            {COLORS.map(([k, label]) => (
              <div key={k}><span className={s.label}>{label}</span><ColorField label={label} value={form.colors[k]} onChange={(v) => set({colors: {...form.colors, [k]: v}})} /></div>
            ))}
          </div>
        </div>
        <div className={s.grid2}>
          <Field label="Số điện thoại (CTA)"><Input value={form.phone} placeholder="[SĐT] — để trống nếu không hiện" onChange={(e) => set({phone: e.target.value})} /></Field>
          <Field label="Fanpage"><Input value={form.fanpage} placeholder="[FANPAGE] — để trống nếu không hiện" onChange={(e) => set({fanpage: e.target.value})} /></Field>
        </div>
        <Field label="Địa chỉ"><Input value={form.address} placeholder={PLACEHOLDER_ADDRESS} onChange={(e) => set({address: e.target.value})} /></Field>
        <div className={s.actions}>
          <Button variant="primary" disabled={!dirty} loading={save.isPending} loadingText="Đang lưu…" onClick={onSave}>Lưu brand</Button>
          {summary.isDefault
            ? <Chip tone="success">Đang là mặc định</Chip>
            : <Button loading={saveConfig.isPending} loadingText="Đang lưu…" disabled={!config.data} onClick={makeDefault}>Đặt làm mặc định</Button>}
          {dirty && <span className={s.dirty} role="status">Có thay đổi chưa lưu</span>}
          {dirty && <Button variant="ghost" onClick={() => setDraft(null)}>Hoàn tác</Button>}
        </div>
      </section>
      <section className={s.preview} aria-label="Xem trước CTA">
        <div className={s.previewBox}>
          <Player component={CtaCard} inputProps={inputProps} compositionWidth={1080} compositionHeight={1920} fps={30} durationInFrames={90}
            autoPlay loop acknowledgeRemotionLicense style={{width: '100%', height: '100%'}} />
        </div>
        <span className={s.muted}>Xem trước thẻ CTA cuối video</span>
      </section>
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
