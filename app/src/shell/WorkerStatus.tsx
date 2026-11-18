import {useWorkerStatus} from '../api/events.ts';
import {Tooltip} from '../ui/index.ts';
import s from './WorkerStatus.module.css';

export function useWorkerLabel(): {tone: 'idle' | 'loading' | 'ready' | 'error'; text: string; reason: string | null} {
  const w = useWorkerStatus();
  switch (w.state) {
    case 'loading': return {tone: 'loading', text: 'Đang nạp model giọng…', reason: null};
    case 'ready': return {tone: 'ready', text: `Model giọng đã nạp · ${w.device === 'cuda' ? 'GPU' : 'CPU'}`, reason: null};
    case 'error': return {tone: 'error', text: 'Model giọng lỗi', reason: w.error ?? 'Không rõ nguyên nhân'};
    default: return {tone: 'idle', text: 'Model giọng chưa nạp', reason: null};
  }
}

export function WorkerStatus({dotOnly}: {dotOnly?: boolean}): React.JSX.Element {
  const {tone, text, reason} = useWorkerLabel();
  const body = (
    <div className={`${s.status} ${dotOnly ? s.dotOnly : ''}`} role="status" aria-label={dotOnly ? text : undefined} tabIndex={reason || dotOnly ? 0 : undefined}>
      <span className={`${s.dot} ${s[tone]}`} aria-hidden />
      {!dotOnly && text}
    </div>
  );
  const tip = reason ?? (dotOnly ? text : null);
  return tip ? <Tooltip content={tip} side={dotOnly ? 'right' : 'top'}>{body}</Tooltip> : body;
}
