import {JobsPanel} from './JobsPanel.tsx';
import {NavList} from './nav.tsx';
import {ThemeControls} from './ThemeControls.tsx';
import {WorkerStatus} from './WorkerStatus.tsx';
import s from './Sidebar.module.css';

export function Mark(): React.JSX.Element { return <span className={s.mark} aria-hidden>R</span>; }

export function Sidebar(): React.JSX.Element {
  return (
    <aside className={s.side}>
      <div className={s.logo}><Mark /><div><b>Reel Studio</b><small>create-video</small></div></div>
      <NavList />
      <div className={s.bottom}>
        <JobsPanel />
        <WorkerStatus />
        <ThemeControls />
      </div>
    </aside>
  );
}
