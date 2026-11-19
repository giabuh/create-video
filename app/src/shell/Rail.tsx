import {Briefcase, MessageSquare, Palette} from 'lucide-react';
import {IconButton, Popover} from '../ui/index.ts';
import {useChatBusy} from '../api/chat.ts';
import {JobsPanel, useActiveJobCount} from './JobsPanel.tsx';
import {NavList} from './nav.tsx';
import {Mark} from './Sidebar.tsx';
import {ThemeControls} from './ThemeControls.tsx';
import {WorkerStatus} from './WorkerStatus.tsx';
import s from './Rail.module.css';

export function Rail({onChat}: {onChat(): void}): React.JSX.Element {
  const count = useActiveJobCount();
  const busy = useChatBusy() !== null;
  return (
    <aside className={s.rail}>
      <Mark />
      <NavList compact />
      <div className={s.bottom}>
        <IconButton label="Chat với Claude" onClick={onChat} icon={<span className={s.badgeWrap}><MessageSquare size={22} />{busy && <span className={s.dot} aria-hidden />}</span>} />
        <Popover side="right" align="end" trigger={
          <IconButton label={count ? `Tác vụ (${count} đang chạy)` : 'Tác vụ'} icon={
            <span className={s.badgeWrap}><Briefcase size={22} />{count > 0 && <span className={s.badge} aria-hidden>{count}</span>}</span>
          } />
        }>
          <div className={s.pop}><JobsPanel /></div>
        </Popover>
        <WorkerStatus dotOnly />
        <Popover side="right" align="end" trigger={<IconButton label="Giao diện và cỡ chữ" icon={<Palette size={22} />} />}>
          <ThemeControls />
        </Popover>
      </div>
    </aside>
  );
}
