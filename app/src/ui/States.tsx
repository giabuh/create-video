import {AlertTriangle, RotateCw} from 'lucide-react';
import {Button} from './Button.tsx';
import s from './States.module.css';

export function EmptyState({icon, title, description, action}: {icon: React.ReactNode; title: string; description?: string; action?: React.ReactNode}): React.JSX.Element {
  return (
    <div className={s.state}>
      <div className={s.icon} aria-hidden>{icon}</div>
      <h2 className={s.title}>{title}</h2>
      {description && <p className={s.desc}>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({title = 'Không tải được dữ liệu', error, onRetry}: {title?: string; error: unknown; onRetry?(): void}): React.JSX.Element {
  // fetch() rejects with a TypeError (English browser text) when the API is unreachable
  const msg = error instanceof TypeError ? 'Không kết nối được tới server.' : error instanceof Error ? error.message : String(error);
  return (
    <div className={s.state} role="alert">
      <div className={`${s.icon} ${s.danger}`} aria-hidden><AlertTriangle size={28} /></div>
      <h2 className={s.title}>{title}</h2>
      <p className={s.desc}>{msg}</p>
      {onRetry && <Button icon={<RotateCw size={16} aria-hidden />} onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}
