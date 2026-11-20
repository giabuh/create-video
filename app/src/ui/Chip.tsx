import {X} from 'lucide-react';
import s from './Chip.module.css';

export type Tone = 'neutral' | 'info' | 'accent' | 'success' | 'warning' | 'danger' | 'voice';

export function Chip({tone = 'neutral', onRemove, removeLabel = 'Xoá', icon, children}: {tone?: Tone; onRemove?(): void; removeLabel?: string; icon?: React.ReactNode; children: React.ReactNode}): React.JSX.Element {
  return (
    <span className={`${s.chip} ${s[tone]}`} title={typeof children === 'string' ? children : undefined}>
      {icon}
      <span className={s.text}>{children}</span>
      {onRemove && (
        <button type="button" className={s.remove} aria-label={removeLabel} onClick={onRemove}>
          <X size={14} aria-hidden />
        </button>
      )}
    </span>
  );
}
