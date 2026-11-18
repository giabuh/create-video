import {Tooltip as RTooltip} from 'radix-ui';
import o from './Overlay.module.css';

export function Tooltip({content, children, side = 'top'}: {content: React.ReactNode; children: React.ReactElement; side?: 'top' | 'right' | 'bottom' | 'left'}): React.JSX.Element {
  return (
    <RTooltip.Provider delayDuration={400} skipDelayDuration={200}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content side={side} sideOffset={6} className={o.tip}>{content}</RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}
