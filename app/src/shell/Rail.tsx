import {Briefcase, Palette} from 'lucide-react';
import {IconButton, Popover} from '../ui/index.ts';
import {JobsPanel, useActiveJobCount} from './JobsPanel.tsx';
import {NavList} from './nav.tsx';
import {Mark} from './Sidebar.tsx';
import {ThemeControls} from './ThemeControls.tsx';
import {WorkerStatus} from './WorkerStatus.tsx';
import s from './Rail.module.css';

export function Rail(): React.JSX.Element {
  const count = useActiveJobCount();
  return (
    <aside className={s.rail}>
      <Mark />
      <NavList compact />
      <div className={s.bottom}>
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
