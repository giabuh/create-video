import {Drawer} from '../ui/index.ts';
import {ChatBody} from './ChatBody.tsx';

export function ChatPanel({open, onOpenChange}: {open: boolean; onOpenChange(o: boolean): void}): React.JSX.Element {
  return <Drawer open={open} onOpenChange={onOpenChange} title="Chat" width={640}><ChatBody active={open} /></Drawer>;
}
