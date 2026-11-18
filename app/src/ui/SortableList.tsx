import {DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors} from '@dnd-kit/core';
import type {DragEndEvent} from '@dnd-kit/core';
import {SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import s from './SortableList.module.css';

type Handle = {handleProps: React.HTMLAttributes<HTMLElement>; isDragging: boolean};

function Row({id, render}: {id: string; render(h: Handle): React.ReactNode}): React.JSX.Element {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id});
  return (
    <li ref={setNodeRef} className={`${s.item} ${isDragging ? s.dragging : ''}`} style={{transform: CSS.Translate.toString(transform), transition}}>
      {render({handleProps: {...attributes, ...listeners} as React.HTMLAttributes<HTMLElement>, isDragging})}
    </li>
  );
}

export function SortableList<T>({items, getId, onReorder, renderItem, ...aria}: {
  items: T[]; getId(t: T): string; onReorder(items: T[]): void; renderItem(t: T, h: Handle): React.ReactNode; 'aria-label': string;
}): React.JSX.Element {
  const sensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 4}}), useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}));
  const ids = items.map(getId);
  const onDragEnd = ({active, over}: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(items, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={s.list} aria-label={aria['aria-label']}>
          {items.map((t) => <Row key={getId(t)} id={getId(t)} render={(h) => renderItem(t, h)} />)}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
