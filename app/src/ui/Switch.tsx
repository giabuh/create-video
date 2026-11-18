import {useId} from 'react';
import {Switch as RSwitch} from 'radix-ui';
import s from './Switch.module.css';

export function Switch({checked, onChange, label, id}: {checked: boolean; onChange(v: boolean): void; label: string; id?: string}): React.JSX.Element {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <span className={s.row}>
      <RSwitch.Root id={sid} className={s.root} checked={checked} onCheckedChange={onChange}><RSwitch.Thumb className={s.thumb} /></RSwitch.Root>
      <label htmlFor={sid}>{label}</label>
    </span>
  );
}
