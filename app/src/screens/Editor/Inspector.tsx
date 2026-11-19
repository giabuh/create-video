import {useEffect, useState} from 'react';
import {Skeleton, Tabs} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import s from './Inspector.module.css';

// Task 16 replaces these three bodies (new files, imported here).
export const InspectorScene = (): React.JSX.Element => <Skeleton height={240} />;
export const InspectorVideo = (): React.JSX.Element => <Skeleton height={240} />;
export const InspectorCta = (): React.JSX.Element => <Skeleton height={240} />;

type Tab = 'scene' | 'video' | 'cta';

export function Inspector(): React.JSX.Element {
  const {selectedId} = useEditor();
  const [tab, setTab] = useState<Tab>('scene');
  useEffect(() => { setTab((t) => (selectedId === 'cta' ? 'cta' : t === 'cta' ? 'scene' : t)); }, [selectedId]);
  return (
    <aside className={s.panel} aria-label="Thuộc tính">
      <Tabs<Tab> value={tab} onChange={setTab} aria-label="Thuộc tính"
        tabs={[{value: 'scene', label: selectedId && selectedId !== 'cta' ? `Cảnh ${selectedId}` : 'Cảnh'}, {value: 'video', label: 'Toàn video'}, {value: 'cta', label: 'CTA'}]} />
      <div className={s.body} id="editor-inspector-body">
        {tab === 'scene' ? <InspectorScene /> : tab === 'video' ? <InspectorVideo /> : <InspectorCta />}
      </div>
    </aside>
  );
}
