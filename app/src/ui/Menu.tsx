import {DropdownMenu as RMenu} from 'radix-ui';
import o from './Overlay.module.css';

export type MenuItem = {label: string; icon?: React.ReactNode; onSelect(): void; danger?: boolean; disabled?: boolean};

export function DropdownMenu({trigger, items, align = 'start'}: {trigger: React.ReactElement; items: (MenuItem | 'separator')[]; align?: 'start' | 'end'}): React.JSX.Element {
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align={align} sideOffset={6} collisionPadding={12} className={o.popup} style={{minWidth: 200}}>
          {items.map((it, i) => it === 'separator'
            ? <RMenu.Separator key={i} className={o.sep} />
            : <RMenu.Item key={i} disabled={it.disabled} onSelect={it.onSelect} className={`${o.item} ${it.danger ? o.danger : ''}`}>{it.icon}{it.label}</RMenu.Item>)}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}
