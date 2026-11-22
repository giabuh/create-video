import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import type {PlayerRef} from '@remotion/player';
import type {ProjectDetail, RenderProps, Storyboard} from '../../../shared/types.ts';
import type {SaveState} from '../../api/autosave.ts';
import {api} from '../../api/client.ts';
import {useAutosave} from '../../api/autosave.ts';
import {usePreview} from '../../api/hooks.ts';
import {useDoneJobIds} from '../../api/events.ts';
import {toastConflict} from '../../api/saveError.ts';
import {toast} from '../../ui/index.ts';
import {sceneStart, shouldAdopt} from './editorState.ts';

export type EditorCtx = {
  slug: string; storyboard: Storyboard; update(fn: (sb: Storyboard) => Storyboard): void;
  detail: ProjectDetail; renderProps: RenderProps | null; stale: string[]; errors: string[];
  playerRef: React.RefObject<PlayerRef | null>; seekToScene(id: string): void;
  save: SaveState & {flush(): Promise<void>; retry(): Promise<void>; dirty: boolean};
  previewing: boolean; previewOk: boolean;
};

const Ctx = createContext<EditorCtx | null>(null);
export function useEditor(): EditorCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useEditor must be used inside <EditorProvider>');
  return c;
}

type Preview = {renderProps: RenderProps | null; stale: string[]; errors: string[]; ok: boolean};

export function EditorProvider({slug, detail, children}: {slug: string; detail: ProjectDetail; children: React.ReactNode}): React.JSX.Element {
  const [storyboard, setStoryboard] = useState(detail.storyboard.data);
  const [baseMtime, setBaseMtime] = useState(detail.storyboard.mtime);
  const [preview, setPreview] = useState<Preview>({renderProps: detail.renderProps, stale: detail.stale, errors: [], ok: true});
  const [inflight, setInflight] = useState(0);
  const playerRef = useRef<PlayerRef | null>(null);
  const seq = useRef(0);
  const {mutateAsync} = usePreview(slug);

  const runPreview = useCallback(() => {
    const n = ++seq.current; // an older response that resolves late must not replace a newer one
    setInflight((c) => c + 1);
    mutateAsync().then(
      (r) => { if (n === seq.current) setPreview((p) => ({renderProps: r.renderProps ?? p.renderProps, stale: r.stale, errors: r.errors, ok: r.ok})); },
      (e: unknown) => { if (n === seq.current) toast({title: 'Không dựng được bản xem trước', description: e instanceof Error ? e.message : String(e), tone: 'error'}); },
    ).finally(() => setInflight((c) => c - 1));
  }, [mutateAsync]);

  const save = useAutosave<Storyboard>({
    value: storyboard, baseMtime,
    save: async (v, base) => (await api<{mtime: number}>(`/projects/${encodeURIComponent(slug)}/storyboard`, {method: 'PUT', body: {storyboard: v, baseMtime: base}})).mtime,
    onSaved: (m) => { setBaseMtime(m); runPreview(); },
    onConflict: (cur) => {
      setStoryboard(cur.data); setBaseMtime(cur.mtime); runPreview(); // value and baseMtime together, see useAutosave
      toastConflict();
    },
  });

  // adopt an external edit (refetch after a `changed` event), never an older copy over newer local edits
  useEffect(() => {
    if (!shouldAdopt({serverMtime: detail.storyboard.mtime, baseMtime, dirty: save.dirty, saving: save.state === 'saving'})) return;
    setStoryboard(detail.storyboard.data); setBaseMtime(detail.storyboard.mtime); runPreview();
  }, [detail.storyboard, baseMtime, save.dirty, save.state, runPreview]);

  // never prepared yet: build the first preview
  useEffect(() => { if (!detail.renderProps && storyboard.scenes.length) runPreview(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // voice / render for this project finished: timings and stale list changed
  const done = useDoneJobIds(slug);
  const seenDone = useRef<string | null>(null);
  useEffect(() => {
    const prev = seenDone.current?.split(',');
    seenDone.current = done;
    if (prev && done.split(',').some((id) => id && !prev.includes(id))) runPreview();
  }, [done, runPreview]);

  const seekToScene = useCallback((id: string) => {
    const t = sceneStart(preview.renderProps, id);
    if (t !== null && preview.renderProps) playerRef.current?.seekTo(Math.round(t * preview.renderProps.fps));
  }, [preview.renderProps]);

  const value = useMemo<EditorCtx>(() => ({
    slug, storyboard, update: setStoryboard, detail, renderProps: preview.renderProps, stale: preview.stale, errors: preview.errors,
    playerRef, seekToScene, save, previewing: inflight > 0, previewOk: preview.ok,
  }), [slug, storyboard, detail, preview, seekToScene, save, inflight]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

