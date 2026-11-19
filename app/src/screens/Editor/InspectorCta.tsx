import {useBrands} from '../../api/hooks.ts';
import {Field, Input, NumberField, Switch} from '../../ui/index.ts';
import type {CtaSpec} from '../../../shared/types.ts';
import {useEditor} from './EditorContext.tsx';
import s from './Inspector.module.css';

export function InspectorCta(): React.JSX.Element {
  const {storyboard: sb, setStoryboard, renderProps} = useEditor();
  const brands = useBrands();
  const brand = brands.data?.find((b) => b.id === (sb.brand ?? brands.data?.find((x) => x.isDefault)?.id))?.brand;
  const cta = sb.cta;
  const set = (p: Partial<CtaSpec>) => {
    const n: Record<string, unknown> = {...cta, ...p};
    for (const k of Object.keys(n)) if (n[k] === undefined || n[k] === '') delete n[k];
    setStoryboard({...sb, cta: n as CtaSpec});
  };
  const text = (key: 'phone' | 'fanpage' | 'address', label: string) => (
    <Field label={label} hint="Để trống để dùng thông tin của thương hiệu.">
      <Input value={cta?.[key] ?? ''} placeholder={brand?.cta?.[key] ?? ''} onChange={(e) => set({[key]: e.target.value})} />
    </Field>
  );
  return (
    <div className={s.stack}>
      <Switch checked={!!cta} label="Có thẻ CTA" onChange={(on) => setStoryboard({...sb, cta: on ? {title: ''} : null})} />
      {cta && (
        <>
          <Field label="Tiêu đề"><Input value={cta.title} placeholder={brand?.name ? `[TIÊU ĐỀ] — ${brand.name}` : '[TIÊU ĐỀ]'} onChange={(e) => set({title: e.target.value})} /></Field>
          {text('phone', 'Số điện thoại')}
          {text('fanpage', 'Fanpage')}
          {text('address', 'Địa chỉ')}
          <Field label="Thời lượng (giây)"><NumberField value={cta.duration ?? null} min={1} step={0.5} onChange={(v) => set({duration: v ?? undefined})} /></Field>
          {renderProps?.cta && cta.duration == null && <p className={s.muted}>Đang dùng thời lượng mặc định: {renderProps.cta.duration}s.</p>}
        </>
      )}
    </div>
  );
}
