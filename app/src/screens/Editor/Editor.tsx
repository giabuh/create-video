import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {MessageSquare} from 'lucide-react';
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
const OWN_SPACE = `${OWN_KEYS},button,a,summary,[role=button],[role=separator]`;
const CHAT_MIN = 318;
const PREVIEW_MIN = 320;

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
  const {detail, renderProps} = useEditor();
  const workRef = useRef<HTMLDivElement>(null);
  const drag = useRef({x: 0, width: 0});
  const [workSize, setWorkSize] = useState({width: 0, height: 0});
  const [requestedWidth, setRequestedWidth] = useState<number>();
  useLayoutEffect(() => {
    const work = workRef.current;
    if (!work) return;
    const measure = () => setWorkSize({width: work.clientWidth, height: work.clientHeight});
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(work);
    return () => observer.disconnect();
  }, []);
  const maxWidth = Math.max(CHAT_MIN, Math.min(840, workSize.width - PREVIEW_MIN));
  const clampWidth = (width: number) => Math.round(Math.max(CHAT_MIN, Math.min(maxWidth, width)));
  const {width, height} = renderProps ?? detail.size;
  const ratio = width > 0 && height > 0 ? width / height : 9 / 16;
  // Reserve space for a height-fitted preview and the workspace padding.
  const previewWidth = Math.max(PREVIEW_MIN, workSize.height * ratio + 48);
  const chatWidth = clampWidth(requestedWidth ?? workSize.width - previewWidth);
  const resizeChat = (width: number) => setRequestedWidth(clampWidth(width));
  return (
    <div className={s.root}>
      <TopBar />
      <div ref={workRef} className={s.work} style={{'--chat-width': `${chatWidth}px`} as React.CSSProperties}>
        <div className={s.center}><PreviewPane /><SceneStrip /></div>
        <aside id="editor-chat" className={s.chat} data-chat-docked aria-labelledby="editor-chat-heading">
          <div className={s.splitter} role="separator" tabIndex={0} aria-label="Đổi độ rộng chat"
            aria-controls="editor-chat" aria-orientation="vertical"
            aria-valuemin={CHAT_MIN} aria-valuemax={maxWidth} aria-valuenow={chatWidth}
            onPointerDown={(e) => {
              if (!e.isPrimary || e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = {x: e.clientX, width: chatWidth};
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) resizeChat(drag.current.width + drag.current.x - e.clientX);
            }}
            onKeyDown={(e) => {
              switch (e.key) {
                case 'ArrowLeft': resizeChat(chatWidth + 24); break;
                case 'ArrowRight': resizeChat(chatWidth - 24); break;
                case 'Home': resizeChat(CHAT_MIN); break;
                case 'End': resizeChat(maxWidth); break;
                default: return;
              }
              e.preventDefault();
            }}
          />
          <h2 id="editor-chat-heading" className={s.chatHeading}><MessageSquare size={17} aria-hidden />Chat</h2>
          <ChatBody active autoFocus={false} />
        </aside>
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
