import {useConnection} from '../api/events.ts';
import {Spinner} from '../ui/index.ts';
import s from './ConnectionBanner.module.css';

export function ConnectionBanner(): React.JSX.Element | null {
  if (useConnection() !== 'lost') return null;
  return <div className={s.banner} role="alert"><Spinner size={16} />Mất kết nối với server — đang thử lại…</div>;
}
