import {useEffect, useState} from 'react';
import {Tabs} from '../../ui/index.ts';
import {useEditor} from './EditorContext.tsx';
import {InspectorCta} from './InspectorCta.tsx';
import {InspectorScene} from './InspectorScene.tsx';
import {InspectorVideo} from './InspectorVideo.tsx';
import s from './Inspector.module.css';

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
