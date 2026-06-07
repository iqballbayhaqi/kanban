import { useState, useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Column, Card } from '../types';
import KanbanCard from './KanbanCard';
import api from '../api';
import { useDialog } from '../contexts/DialogContext';

interface Props {
  column: Column;
  onCardAdded: (card: Card) => void;
  onCardClick: (card: Card) => void;
  onColumnDeleted: (colId: number) => void;
  onColumnRenamed: (colId: number, title: string) => void;
  filterPriority: string;
}

export default function KanbanColumn({ column, onCardAdded, onCardClick, onColumnDeleted, onColumnRenamed, filterPriority }: Props) {
  const { confirm } = useDialog();
  const [addingCard, setAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [colTitle, setColTitle] = useState(column.title);
  const [showMenu, setShowMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (addingCard) textareaRef.current?.focus(); }, [addingCard]);
  useEffect(() => { setColTitle(column.title); }, [column.title]);

  const isFiltered = !!filterPriority;
  const visibleCards = isFiltered
    ? column.cards.filter((c) => c.priority === filterPriority)
    : column.cards;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `col-${column.id}`,
    data: { type: 'column', column },
    disabled: isFiltered,
  });

  // Droppable target for cards when column is empty
  const { setNodeRef: setDropRef } = useDroppable({
    id: `colDrop-${column.id}`,
    data: { type: 'column-drop', columnId: column.id },
  });

  const addCard = async () => {
    if (!newCardTitle.trim()) { setAddingCard(false); return; }
    try {
      const { data } = await api.post('/cards', { title: newCardTitle.trim(), column_id: column.id });
      onCardAdded(data);
      setNewCardTitle('');
      setAddingCard(false);
    } catch (err) { console.error(err); }
  };

  const renameColumn = async () => {
    setEditingTitle(false);
    if (!colTitle.trim() || colTitle === column.title) { setColTitle(column.title); return; }
    try {
      await api.put(`/columns/${column.id}`, { title: colTitle });
      onColumnRenamed(column.id, colTitle);
    } catch { setColTitle(column.title); }
  };

  const deleteColumn = async () => {
    setShowMenu(false);
    const ok = await confirm(`List "${column.title}" dan semua card di dalamnya akan dihapus.`, {
      title: 'Hapus List?', confirmLabel: 'Hapus', variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/columns/${column.id}`);
    onColumnDeleted(column.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`kanban-column${isFiltered ? ' filtered' : ''}`}
    >
      {/* drag handle is the header */}
      <div className="column-header" {...attributes} {...listeners}>
        {editingTitle ? (
          <input
            className="column-title-input"
            value={colTitle}
            onChange={(e) => setColTitle(e.target.value)}
            onBlur={renameColumn}
            onKeyDown={(e) => {
              if (e.key === 'Enter') renameColumn();
              if (e.key === 'Escape') { setColTitle(column.title); setEditingTitle(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
          />
        ) : (
          <h3 className="column-title" onClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}>
            {column.title}
          </h3>
        )}
        {isFiltered && !editingTitle && (
          <span className="col-count">
            {visibleCards.length}<small>/{column.cards.length}</small>
          </span>
        )}
        <div className="column-menu-wrap" onClick={(e) => e.stopPropagation()}>
          <button
            className="column-menu-btn"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setShowMenu(!showMenu)}
          >
            ···
          </button>
          {showMenu && (
            <div className="column-menu">
              <button onClick={() => { setShowMenu(false); setEditingTitle(true); }}>Rename</button>
              <button className="danger" onClick={deleteColumn}>Delete</button>
            </div>
          )}
        </div>
      </div>

      <SortableContext items={visibleCards.map((c) => `card-${c.id}`)} strategy={verticalListSortingStrategy}>
        <div ref={setDropRef} className="column-cards">
          {visibleCards.map((card) => (
            <KanbanCard key={card.id} card={card} columnId={column.id} onClick={onCardClick} dragDisabled={isFiltered} />
          ))}
          {isFiltered && visibleCards.length === 0 && (
            <div className="col-empty-filter">No {filterPriority} priority cards</div>
          )}
        </div>
      </SortableContext>

      <div className="column-footer">
        {addingCard ? (
          <div className="add-card-form">
            <textarea
              ref={textareaRef}
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Enter card title..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(); }
                if (e.key === 'Escape') setAddingCard(false);
              }}
            />
            <div className="add-card-actions">
              <button className="btn-primary btn-sm" onClick={addCard}>Add Card</button>
              <button className="btn-ghost btn-sm" onClick={() => { setAddingCard(false); setNewCardTitle(''); }}>✕</button>
            </div>
          </div>
        ) : (
          <button className="add-card-btn" onClick={() => setAddingCard(true)}>+ Add a card</button>
        )}
      </div>
    </div>
  );
}
