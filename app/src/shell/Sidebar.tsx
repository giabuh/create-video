import {MessageSquare} from 'lucide-react';
import {Button} from '../ui/index.ts';
import {useChatBusy} from '../api/chat.ts';
import {JobsPanel} from './JobsPanel.tsx';
import {NavList} from './nav.tsx';
import {ThemeControls} from './ThemeControls.tsx';
import {WorkerStatus} from './WorkerStatus.tsx';
import s from './Sidebar.module.css';

export function Mark(): React.JSX.Element { return <span className={s.mark} aria-hidden>R</span>; }

export function Sidebar({onChat}: {onChat(): void}): React.JSX.Element {
  const busy = useChatBusy() !== null;
  return (
    <aside className={s.side}>
      <div className={s.logo}><Mark /><div><b>Reel Studio</b><small>create-video</small></div></div>
      <NavList />
      <div className={s.bottom}>
        <Button variant="ghost" icon={<MessageSquare size={18} aria-hidden />} onClick={onChat}>Chat với Claude{busy && <span className={s.dot} aria-label="Claude đang chạy" />}</Button>
        <JobsPanel />
        <WorkerStatus />
        <ThemeControls />
      </div>
    </aside>
  );
}
