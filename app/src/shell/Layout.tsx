import {useEffect, useState} from 'react';
import {Menu, MessageSquare} from 'lucide-react';
import {Link, Outlet, useLocation, useMatch} from 'react-router';
import {IconButton, Popover} from '../ui/index.ts';
import {setChatOpen, useChatBusy, useChatOpen} from '../api/chat.ts';
import {ChatPanel} from './ChatPanel.tsx';
import {JobsPanel} from './JobsPanel.tsx';
import {NavList} from './nav.tsx';
import {WorkerStatus} from './WorkerStatus.tsx';
import {ConnectionBanner} from './ConnectionBanner.tsx';
import {Rail} from './Rail.tsx';
import {ThemeControls} from './ThemeControls.tsx';
import {Mark, Sidebar} from './Sidebar.tsx';
import s from './Layout.module.css';

function MobileNav({onChat}: {onChat(): void}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const busy = useChatBusy() !== null;
  return (
    <header className={s.mobile}>
      <Link to="/" className={s.brand}><Mark />Reel Studio</Link>
      <div className={s.mobileActions}>
      <IconButton label="Chat với Claude" onClick={onChat} icon={<span className={s.chatIcon}><MessageSquare size={22} aria-hidden />{busy && <span className={s.dot} aria-hidden />}</span>} />
      <Popover open={open} onOpenChange={setOpen} align="end" trigger={<IconButton label="Mở menu điều hướng" icon={<Menu size={22} aria-hidden />} />}>
        <div className={s.mobileMenu}>
          <NavList onNavigate={() => setOpen(false)} />
          <JobsPanel />
          <WorkerStatus />
          <ThemeControls />
        </div>
      </Popover>
      </div>
    </header>
  );
}

const focusDockedChat = () => document.querySelector<HTMLTextAreaElement>('[data-chat-docked] textarea')?.focus();

export function Layout(): React.JSX.Element {
  const chatOpen = useChatOpen();
  const {pathname} = useLocation();
  const compact = pathname.startsWith('/p/'); // editor and renders own their padding
  const editor = useMatch('/p/:slug') !== null;
  const openChat = editor ? focusDockedChat : () => setChatOpen(true);
  useEffect(() => { if (editor) setChatOpen(false); }, [editor]); // the Editor docks its own chat
  return (
    <div className={s.app}>
      <ConnectionBanner />
      <MobileNav onChat={openChat} />
      {!editor && <ChatPanel open={chatOpen} onOpenChange={setChatOpen} />}
      <div className={s.body}>
        <div className={s.desktopNav}>{compact ? <Rail onChat={openChat} /> : <Sidebar onChat={openChat} />}</div>
        <main className={`${s.main} ${compact ? '' : s.padded} ${editor ? s.editor : ''}`}>
          <div key={pathname} className={s.page}><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
