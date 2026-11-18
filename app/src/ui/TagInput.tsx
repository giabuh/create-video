import {useId, useState} from 'react';
import {Chip} from './Chip.tsx';
import type {Tone} from './Chip.tsx';
import o from './Overlay.module.css';
import s from './TagInput.module.css';

export function TagInput({value, onChange, placeholder, suggestions = [], id, tone = 'neutral'}: {
  value: string[]; onChange(v: string[]): void; placeholder?: string; suggestions?: string[]; id?: string; tone?: Tone;
}): React.JSX.Element {
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const [hi, setHi] = useState(-1);
  const listId = useId();
  const q = text.trim().toLowerCase();
  const shown = suggestions.filter((x) => !value.includes(x) && (!q || x.toLowerCase().includes(q))).slice(0, 8);
  const open = focus && shown.length > 0;

  const add = (raw: string) => {
    const t = raw.trim();
    setText(''); setHi(-1);
    if (t && !value.includes(t)) onChange([...value, t]);
  };
  return (
    <div className={s.box}>
      <div className={s.wrap} onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); (e.currentTarget.querySelector('input') as HTMLInputElement).focus(); } }}>
        {value.map((t) => <Chip key={t} tone={tone} removeLabel={`Xoá ${t}`} onRemove={() => onChange(value.filter((x) => x !== t))}>{t}</Chip>)}
        <input
          id={id} className={s.input} value={text} placeholder={value.length ? undefined : placeholder}
          role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && hi >= 0 ? `${listId}-${hi}` : undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) {
              const parts = v.split(',').map((x) => x.trim());
              const tail = parts.pop() ?? '';
              const fresh = parts.filter((x, i) => x && !value.includes(x) && parts.indexOf(x) === i);
              if (fresh.length) onChange([...value, ...fresh]);
              setText(tail); setHi(-1);
            } else { setText(v); setHi(-1); }
          }}
          onFocus={() => setFocus(true)}
          onBlur={() => { setFocus(false); add(text); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); add(open && hi >= 0 ? shown[hi] : text); }
            else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
            else if (e.key === 'ArrowDown' && open) { e.preventDefault(); setHi((hi + 1) % shown.length); }
            else if (e.key === 'ArrowUp' && open) { e.preventDefault(); setHi((hi - 1 + shown.length) % shown.length); }
            else if (e.key === 'Escape') setFocus(false);
          }}
        />
      </div>
      {open && (
        <ul id={listId} role="listbox" className={`${o.popup} ${s.list}`} data-open>
          {shown.map((x, i) => (
            <li key={x} id={`${listId}-${i}`} role="option" aria-selected={i === hi} className={`${o.item} ${s.opt}`}
              onMouseDown={(e) => { e.preventDefault(); add(x); }} onMouseEnter={() => setHi(i)}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
