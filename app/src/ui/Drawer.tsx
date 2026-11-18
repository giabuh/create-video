import {Dialog as RDialog} from 'radix-ui';
import {X} from 'lucide-react';
import {IconButton} from './IconButton.tsx';
import o from './Overlay.module.css';

export function Drawer({open, onOpenChange, title, side = 'right', width = 420, children, footer}: {
  open: boolean; onOpenChange(o: boolean): void; title: string; side?: 'right' | 'left'; width?: number; children: React.ReactNode; footer?: React.ReactNode;
}): React.JSX.Element {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={o.scrim} />
        <RDialog.Content className={`${o.drawer} ${o[side]}`} style={{'--w': `${width}px`} as React.CSSProperties} aria-describedby={undefined}>
          <div className={o.head}>
            <RDialog.Title className={o.title}>{title}</RDialog.Title>
            <RDialog.Close asChild><IconButton label="Đóng" icon={<X size={20} />} size="sm" /></RDialog.Close>
          </div>
          <div className={o.body}>{children}</div>
          {footer && <div className={o.foot}>{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}
