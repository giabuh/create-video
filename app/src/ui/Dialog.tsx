import {Dialog as RDialog} from 'radix-ui';
import {X} from 'lucide-react';
import {Button} from './Button.tsx';
import {IconButton} from './IconButton.tsx';
import o from './Overlay.module.css';

const W = {sm: 400, md: 520, lg: 720};

export function Dialog({open, onOpenChange, title, description, size = 'md', children, footer}: {
  open: boolean; onOpenChange(o: boolean): void; title: string; description?: string; size?: 'sm' | 'md' | 'lg'; children: React.ReactNode; footer?: React.ReactNode;
}): React.JSX.Element {
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className={o.scrim} />
        <RDialog.Content className={o.dialog} style={{'--w': `${W[size]}px`} as React.CSSProperties} {...(description ? {} : {'aria-describedby': undefined})}>
          <div className={o.head}>
            <div style={{flex: 1}}>
              <RDialog.Title className={o.title}>{title}</RDialog.Title>
              {description ? <RDialog.Description className={o.desc}>{description}</RDialog.Description> : null}
            </div>
            <RDialog.Close asChild><IconButton label="Đóng" icon={<X size={20} />} size="sm" /></RDialog.Close>
          </div>
          <div className={o.body}>{children}</div>
          {footer && <div className={o.foot}>{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export function ConfirmDialog({open, onOpenChange, title, description, confirmLabel, danger, loading, onConfirm}: {
  open: boolean; onOpenChange(o: boolean): void; title: string; description: string; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm(): void;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }} title={title} description={description} size="sm"
      footer={<>
        <Button variant="ghost" disabled={loading} onClick={() => onOpenChange(false)}>Huỷ</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      {null}
    </Dialog>
  );
}
