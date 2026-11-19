import {useState} from 'react';
import {Input} from './Field.tsx';
import {Popover} from './Popover.tsx';
import s from './ColorField.module.css';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function ColorField({value, onChange, label, presets = [], optional = false}: {value: string; onChange(v: string): void; label: string; presets?: string[]; optional?: boolean}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const valid = HEX.test(text) || (optional && text === '');
  return (
    <div className={s.row}>
      <Popover trigger={<button type="button" className={s.swatch} style={{background: HEX.test(value) ? value : 'transparent'}} aria-label={`${label}: chọn màu`} />}>
        <div className={s.pop}>
          <div className={s.native}><input type="color" value={HEX.test(value) ? value : '#000000'} aria-label={`${label}: bảng màu`} onChange={(e) => { setDraft(null); onChange(e.target.value.toUpperCase()); }} /></div>
          {presets.length > 0 && (
            <div className={s.presets}>
              {presets.map((c) => <button key={c} type="button" className={s.preset} style={{background: c}} aria-label={c} aria-pressed={c.toLowerCase() === value.toLowerCase()} onClick={() => { setDraft(null); onChange(c); }} />)}
            </div>
          )}
        </div>
      </Popover>
      <Input
        className={s.hex} value={text} maxLength={7} spellCheck={false} aria-label={`${label} (hex)`} invalid={!valid}
        onChange={(e) => { const v = e.target.value; setDraft(v); if (HEX.test(v)) onChange(v.toUpperCase()); }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}
