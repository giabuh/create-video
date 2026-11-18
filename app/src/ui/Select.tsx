import {Select as RSelect} from 'radix-ui';
import {Check, ChevronDown} from 'lucide-react';
import o from './Overlay.module.css';
import s from './Select.module.css';

export type Option<T extends string> = {value: T; label: string; hint?: string; icon?: React.ReactNode; disabled?: boolean};

export function Select<T extends string>({value, onChange, options, placeholder, id, size = 'md', disabled, ...aria}: {
  value: T | null; onChange(v: T): void; options: Option<T>[]; placeholder?: string; id?: string; 'aria-label'?: string; size?: 'sm' | 'md'; disabled?: boolean;
}): React.JSX.Element {
  const cur = options.find((x) => x.value === value);
  return (
    <RSelect.Root value={value ?? undefined} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
      <RSelect.Trigger id={id} aria-label={aria['aria-label']} className={`${s.trigger} ${s[size]}`}>
        <span className={s.val}>{cur ? <>{cur.icon}{cur.label}</> : <RSelect.Value placeholder={placeholder} />}</span>
        <ChevronDown size={18} className={s.chev} aria-hidden />
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content position="popper" sideOffset={6} className={`${o.popup} ${s.content}`}>
          <RSelect.Viewport>
            {options.map((x) => (
              <RSelect.Item key={x.value} value={x.value} disabled={x.disabled} className={o.item}>
                <RSelect.ItemText><span className={s.itemText}>{x.icon}{x.label}</span></RSelect.ItemText>
                {x.hint && <span className={s.hint}>{x.hint}</span>}
                <RSelect.ItemIndicator className={s.check}><Check size={16} aria-hidden /></RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}
