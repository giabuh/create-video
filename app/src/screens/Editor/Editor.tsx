import {useEffect, useState} from 'react';
import {useParams} from 'react-router';
import {useProject} from '../../api/hooks.ts';
import {ErrorState, Segmented, Skeleton} from '../../ui/index.ts';
import {EditorProvider, useEditor} from './EditorContext.tsx';
import {Inspector} from './Inspector.tsx';
import {PreviewPane} from './PreviewPane.tsx';
import {SceneList} from './SceneList.tsx';
import {Timeline} from './Timeline.tsx';
import {TopBar} from './TopBar.tsx';
import s from './Editor.module.css';

// focus is somewhere that owns the key itself
const OWN_KEYS = 'input,textarea,select,[contenteditable],[role=slider],[role=menuitem],[role=option],[role=radio],[role=tab],[role=switch],[aria-roledescription=sortable],[role=dialog] *';
const OWN_SPACE = `${OWN_KEYS},button,a,summary,[role=button]`;

function useEditorKeys(): void {
  const {storyboard, selectedId, select, seekToScene, playerRef, save} = useEditor();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save.flush(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (e.key === ' ' && !t?.closest(OWN_SPACE)) { e.preventDefault(); playerRef.current?.toggle(); }
      else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !t?.closest(OWN_KEYS)) {
        const ids = storyboard.scenes.map((x) => x.id);
        const i = selectedId ? ids.indexOf(selectedId) : -1;
        const next = ids[Math.max(0, Math.min(ids.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (!next || next === selectedId) return;
        e.preventDefault(); select(next); seekToScene(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [storyboard.scenes, selectedId, select, seekToScene, playerRef, save]);
}

type Panel = 'scenes' | 'edit' | 'timeline';

function EditorBody(): React.JSX.Element {
  useEditorKeys();
  const [panel, setPanel] = useState<Panel>('scenes');
  return (
    <div className={s.root} data-panel={panel}>
      <TopBar />
      <div className={s.work}>
        <div className={s.left}><SceneList /></div>
        <div className={s.center}><PreviewPane /></div>
        <div className={s.right}><Inspector /></div>
      </div>
      <div className={s.dock}>
        <Segmented<Panel> className={s.panels} aria-label="Bảng làm việc" value={panel} onChange={setPanel} options={[
          {value: 'scenes', label: 'Cảnh'}, {value: 'edit', label: 'Chỉnh sửa'}, {value: 'timeline', label: 'Timeline'},
        ]} />
      </div>
      <div id="editor-timeline" className={s.timeline}><Timeline /></div>
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
          <div className={s.left}><Skeleton height={100} /><Skeleton height={100} /><Skeleton height={100} /></div>
          <div className={s.center}><Skeleton width="100%" height="100%" radius={18} /></div>
          <div className={s.right}><Skeleton height={400} radius={14} /></div>
        </div>
      </div>
    );
  }
  return <EditorProvider key={slug} slug={slug} detail={q.data}><EditorBody /></EditorProvider>;
}
