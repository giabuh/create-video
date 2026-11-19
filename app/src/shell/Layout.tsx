import {useState} from 'react';
import {Menu} from 'lucide-react';
import {Link, Outlet, useLocation, useMatch} from 'react-router';
import {IconButton, Popover} from '../ui/index.ts';
import {JobsPanel} from './JobsPanel.tsx';
import {NavList} from './nav.tsx';
import {WorkerStatus} from './WorkerStatus.tsx';
import {ConnectionBanner} from './ConnectionBanner.tsx';
import {Rail} from './Rail.tsx';
import {Mark, Sidebar} from './Sidebar.tsx';
import s from './Layout.module.css';

function MobileNav(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <header className={s.mobile}>
      <Link to="/" className={s.brand}><Mark />Reel Studio</Link>
      <Popover open={open} onOpenChange={setOpen} align="end" trigger={<IconButton label="Mở menu điều hướng" icon={<Menu size={22} aria-hidden />} />}>
        <div className={s.mobileMenu}>
          <NavList onNavigate={() => setOpen(false)} />
          <JobsPanel />
          <WorkerStatus />
        </div>
      </Popover>
    </header>
  );
}

export function Layout(): React.JSX.Element {
  const {pathname} = useLocation();
  const compact = pathname.startsWith('/p/'); // editor and renders own their padding
  const editor = useMatch('/p/:slug') !== null;
  return (
    <div className={s.app}>
      <ConnectionBanner />
      <MobileNav />
      <div className={s.body}>
        <div className={s.desktopNav}>{compact ? <Rail /> : <Sidebar />}</div>
        <main className={`${s.main} ${compact ? '' : s.padded} ${editor ? s.editor : ''}`}>
          <div key={pathname} className={s.page}><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
