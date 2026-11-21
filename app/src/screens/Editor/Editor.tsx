import {useEffect} from 'react';
import {useParams} from 'react-router';
import {useProject} from '../../api/hooks.ts';
import {ErrorState, Skeleton} from '../../ui/index.ts';
import {EditorProvider, useEditor} from './EditorContext.tsx';
import {ChatBody} from '../../shell/ChatBody.tsx';
import {PreviewPane} from './PreviewPane.tsx';
import {SceneStrip} from './SceneStrip.tsx';
import {TopBar} from './TopBar.tsx';
import s from './Editor.module.css';

// focus is somewhere that owns the key itself
const OWN_KEYS = 'input,textarea,select,[contenteditable],[role=slider],[role=menuitem],[role=option],[role=radio],[role=tab],[role=switch],[aria-roledescription=sortable],[role=dialog] *';
const OWN_SPACE = `${OWN_KEYS},button,a,summary,[role=button]`;

function useEditorKeys(): void {
  const {playerRef} = useEditor();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (e.key === ' ' && !t?.closest(OWN_SPACE)) { e.preventDefault(); playerRef.current?.toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playerRef]);
}

function EditorBody(): React.JSX.Element {
  useEditorKeys();
  return (
    <div className={s.root}>
      <TopBar />
      <div className={s.work}>
        <div className={s.center}><PreviewPane /><SceneStrip /></div>
        <aside className={s.chat} data-chat-docked aria-label="Chat"><ChatBody active /></aside>
      </div>
    </div>
  );
}

export function EditorScreen(): React.JSX.Element {
  const {slug = ''} = useParams();
  const q = useProject(slug);
  if (q.isError) return <div className={s.state}><ErrorState title="Không tải được dự án" error={q.error} onRetry={() => void q.refetch()} /></div>;
  if (!q.data) {
    return (
      <div className={s.root} aria-busy>
        <div className={s.top}><Skeleton height={40} /></div>
        <div className={s.work}>
          <div className={s.center}><Skeleton width="100%" height="100%" radius={18} /></div>
          <div className={s.chat}><Skeleton height={400} radius={14} /></div>
        </div>
      </div>
    );
  }
  return <EditorProvider key={slug} slug={slug} detail={q.data}><EditorBody /></EditorProvider>;
}
