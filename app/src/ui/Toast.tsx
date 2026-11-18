import {useSyncExternalStore} from 'react';
import {Toast as RToast} from 'radix-ui';
import {CheckCircle2, Info, TriangleAlert, X} from 'lucide-react';
import {IconButton} from './IconButton.tsx';
import {Button} from './Button.tsx';
import o from './Overlay.module.css';

type ToastInput = {title: string; description?: string; tone?: 'info' | 'success' | 'error'; action?: {label: string; onClick(): void}; duration?: number};
type Item = ToastInput & {id: number};

const MAX = 4;
let items: Item[] = [];
let nextId = 1;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function toast(t: ToastInput): void {
  items = [...items, {...t, id: nextId++}].slice(-MAX);
  emit();
}
const dismiss = (id: number) => { items = items.filter((x) => x.id !== id); emit(); };

const ICON = {info: Info, success: CheckCircle2, error: TriangleAlert};

export function Toaster(): React.JSX.Element {
  const list = useSyncExternalStore(subscribe, () => items);
  return (
    <RToast.Provider swipeDirection="right" label="Thông báo">
      {list.map((t) => {
        const tone = t.tone ?? 'info';
        const Icon = ICON[tone];
        return (
          <RToast.Root key={t.id} duration={t.duration ?? (tone === 'error' ? 8000 : 5000)} className={`${o.toast} ${o[`t-${tone}`]}`}
            onOpenChange={(open) => { if (!open) setTimeout(() => dismiss(t.id), 150); }}>
            <Icon size={20} className={o.toastIcon} aria-hidden />
            <div className={o.toastText}>
              <RToast.Title className={o.toastTitle}>{t.title}</RToast.Title>
              {t.description && <RToast.Description className={o.toastDesc}>{t.description}</RToast.Description>}
            </div>
            {t.action && <RToast.Action asChild altText={t.action.label}><Button size="sm" onClick={t.action.onClick}>{t.action.label}</Button></RToast.Action>}
            <RToast.Close asChild><IconButton label="Đóng thông báo" icon={<X size={18} />} size="sm" /></RToast.Close>
          </RToast.Root>
        );
      })}
      <RToast.Viewport className={o.viewport} />
    </RToast.Provider>
  );
}
