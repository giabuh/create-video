import {useRef, useState} from 'react';
import {UploadCloud} from 'lucide-react';
import {Button} from './Button.tsx';
import s from './DropZone.module.css';

export function DropZone({accept, multiple = true, onFiles, title, description, buttonLabel, compact, icon, children}: {
  accept: readonly string[]; multiple?: boolean; onFiles(files: File[]): void; title: string; description?: string; buttonLabel: string; compact?: boolean; icon?: React.ReactNode; children?: React.ReactNode;
}): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const exts = accept.map((x) => x.toLowerCase());
  const take = (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => exts.some((e) => f.name.toLowerCase().endsWith(e)));
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div
      className={`${s.zone} ${compact ? s.compact : ''} ${over ? s.over : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
    >
      {icon ?? <UploadCloud size={compact ? 24 : 36} className={s.icon} aria-hidden />}
      <div>
        <div className={s.title}>{title}</div>
        {description && <div className={s.desc}>{description}</div>}
      </div>
      {children}
      <Button variant={compact ? 'secondary' : 'primary'} size={compact ? 'sm' : 'md'} onClick={() => input.current?.click()}>{buttonLabel}</Button>
      <input ref={input} type="file" className={s.input} multiple={multiple} accept={exts.join(',')} tabIndex={-1} aria-hidden
        onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
    </div>
  );
}
