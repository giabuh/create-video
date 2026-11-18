import {Popover as RPopover} from 'radix-ui';
import o from './Overlay.module.css';

export function Popover({trigger, children, side = 'bottom', align = 'start', open, onOpenChange}: {
  trigger: React.ReactElement; children: React.ReactNode; side?: 'top' | 'right' | 'bottom' | 'left'; align?: 'start' | 'center' | 'end'; open?: boolean; onOpenChange?(o: boolean): void;
}): React.JSX.Element {
  return (
    <RPopover.Root open={open} onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content side={side} align={align} sideOffset={8} collisionPadding={12} className={`${o.popup} ${o.pad}`}>{children}</RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}
