import {Outlet, useLocation} from 'react-router';
import {ConnectionBanner} from './ConnectionBanner.tsx';
import {Rail} from './Rail.tsx';
import {Sidebar} from './Sidebar.tsx';
import s from './Layout.module.css';

export function Layout(): React.JSX.Element {
  const {pathname} = useLocation();
  const compact = pathname.startsWith('/p/'); // editor and renders own their padding
  return (
    <div className={s.app}>
      <ConnectionBanner />
      <div className={s.body}>
        {compact ? <Rail /> : <Sidebar />}
        <main className={`${s.main} ${compact ? '' : s.padded}`}>
          <div key={pathname} className={s.page}><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
