import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  DndContext,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import api from '../api';
import { Board, Column, Card } from '../types';
import KanbanColumn from '../components/KanbanColumn';
import CardModal from '../components/CardModal';

const FILTER_PRIORITIES = [
  { value: 'low',    label: 'Low'    },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High'   },
  { value: 'urgent', label: 'Urgent' },
];

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [addingCol, setAddingCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [filterPriority, setFilterPriority] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    api.get(`/boards/${id}`)
      .then((r) => { setBoard(r.data); setColumns(r.data.columns || []); })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [id]);

  const findColByCardId = (cardId: number) =>
    columns.find((c) => c.cards.some((card) => card.id === cardId));

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current;
    if (data?.type === 'card') setActiveCard(data.card);
    else if (data?.type === 'column') setActiveColumn(data.column);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over || active.data.current?.type !== 'card') return;

    const activeCardId: number = active.data.current.card.id;
    const overData = over.data.current;

    let destColId: number | undefined;
    let overCardId: number | undefined;

    if (overData?.type === 'card') {
      destColId = overData.columnId;
      overCardId = overData.card.id;
    } else if (overData?.type === 'column-drop') {
      destColId = overData.columnId;
    } else if (overData?.type === 'column') {
      destColId = overData.column.id;
    }

    if (destColId === undefined) return;

    const srcCol = findColByCardId(activeCardId);
    if (!srcCol) return;

    if (srcCol.id === destColId) {
      // Same column — reorder
      if (overCardId === undefined || overCardId === activeCardId) return;
      setColumns((prev) =>
        prev.map((col) => {
          if (col.id !== destColId) return col;
          const oldIdx = col.cards.findIndex((c) => c.id === activeCardId);
          const newIdx = col.cards.findIndex((c) => c.id === overCardId);
          if (oldIdx === -1 || newIdx === -1) return col;
          return { ...col, cards: arrayMove(col.cards, oldIdx, newIdx) };
        })
      );
    } else {
      // Cross-column move
      setColumns((prev) => {
        const cols = prev.map((c) => ({ ...c, cards: [...c.cards] }));
        const src = cols.find((c) => c.id === srcCol.id)!;
        const dst = cols.find((c) => c.id === destColId)!;
        const cardIdx = src.cards.findIndex((c) => c.id === activeCardId);
        if (cardIdx === -1) return prev;
        const [card] = src.cards.splice(cardIdx, 1);
        card.column_id = destColId!;
        if (overCardId !== undefined) {
          const insertIdx = dst.cards.findIndex((c) => c.id === overCardId);
          dst.cards.splice(insertIdx >= 0 ? insertIdx : dst.cards.length, 0, card);
        } else {
          dst.cards.push(card);
        }
        return cols;
      });
    }
  };

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveCard(null);
    setActiveColumn(null);
    if (!over) return;

    if (active.data.current?.type === 'column') {
      const activeColId: number = active.data.current.column.id;
      const overColId: number | undefined = over.data.current?.column?.id;
      if (!overColId || activeColId === overColId) return;
      const oldIdx = columns.findIndex((c) => c.id === activeColId);
      const newIdx = columns.findIndex((c) => c.id === overColId);
      if (oldIdx === newIdx) return;
      const reordered = arrayMove(columns, oldIdx, newIdx);
      setColumns(reordered);
      try {
        await api.put(`/columns/reorder/${id}`, { columnIds: reordered.map((c) => c.id) });
      } catch {
        api.get(`/boards/${id}`).then((r) => setColumns(r.data.columns || []));
      }
      return;
    }

    // Persist card move
    const cardId: number = active.data.current?.card?.id;
    if (!cardId) return;
    const destCol = columns.find((col) => col.cards.some((c) => c.id === cardId));
    if (!destCol) return;
    const position = destCol.cards.findIndex((c) => c.id === cardId);
    try {
      await api.put(`/cards/${cardId}/move`, { column_id: destCol.id, position });
    } catch {
      api.get(`/boards/${id}`).then((r) => setColumns(r.data.columns || []));
    }
  };

  const onCardAdded = (colId: number) => (card: Card) =>
    setColumns((prev) => prev.map((col) => col.id === colId ? { ...col, cards: [...col.cards, card] } : col));

  const onCardUpdate = (updated: Card) =>
    setColumns((prev) => prev.map((col) => ({
      ...col, cards: col.cards.map((c) => (c.id === updated.id ? updated : c)),
    })));

  const onCardDelete = (cardId: number) =>
    setColumns((prev) => prev.map((col) => ({ ...col, cards: col.cards.filter((c) => c.id !== cardId) })));

  const onColumnDeleted = (colId: number) =>
    setColumns((prev) => prev.filter((c) => c.id !== colId));

  const onColumnRenamed = (colId: number, title: string) =>
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, title } : c)));

  const addColumn = async () => {
    if (!newColTitle.trim()) { setAddingCol(false); return; }
    try {
      const { data } = await api.post('/columns', { title: newColTitle.trim(), board_id: Number(id) });
      setColumns((prev) => [...prev, data]);
      setNewColTitle('');
      setAddingCol(false);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div className="page-loading">Loading board...</div>;
  if (!board) return null;

  const bgStyle = (): React.CSSProperties => {
    if (board.wallpaper_url) {
      if (board.wallpaper_url.includes('gradient')) return { background: board.wallpaper_url };
      return { backgroundImage: `url(${board.wallpaper_url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' };
    }
    return { background: board.color };
  };

  const hasPhoto = board.wallpaper_url && !board.wallpaper_url.includes('gradient');

  return (
    <div className={`board-page ${hasPhoto ? 'board-page-photo' : ''}`} style={bgStyle()}>
      <header className="board-topbar">
        <button className="btn-back" onClick={() => navigate('/')}>← Boards</button>
        <h1 className="board-topbar-title">{board.title}</h1>
        <div className="board-filter">
          <span className="board-filter-label">Priority:</span>
          <button
            className={`filter-btn${!filterPriority ? ' active' : ''}`}
            onClick={() => setFilterPriority('')}
          >All</button>
          {FILTER_PRIORITIES.map(({ value, label }) => (
            <button
              key={value}
              className={`filter-btn filter-btn-${value}${filterPriority === value ? ' active' : ''}`}
              onClick={() => setFilterPriority(filterPriority === value ? '' : value)}
            >{label}</button>
          ))}
        </div>
      </header>

      <div className="board-content">
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={columns.map((c) => `col-${c.id}`)} strategy={horizontalListSortingStrategy}>
            <div className="columns-container">
              {columns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  column={col}
                  onCardAdded={onCardAdded(col.id)}
                  onCardClick={setSelectedCard}
                  onColumnDeleted={onColumnDeleted}
                  onColumnRenamed={onColumnRenamed}
                  filterPriority={filterPriority}
                />
              ))}

              <div className="add-column-wrap">
                {addingCol ? (
                  <div className="add-column-form">
                    <input
                      type="text"
                      value={newColTitle}
                      onChange={(e) => setNewColTitle(e.target.value)}
                      placeholder="Enter list title..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addColumn();
                        if (e.key === 'Escape') { setAddingCol(false); setNewColTitle(''); }
                      }}
                    />
                    <div className="add-card-actions">
                      <button className="btn-primary btn-sm" onClick={addColumn}>Add List</button>
                      <button className="btn-ghost btn-sm" onClick={() => { setAddingCol(false); setNewColTitle(''); }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button className="add-column-btn" onClick={() => setAddingCol(true)}>
                    + Add another list
                  </button>
                )}
              </div>
            </div>
          </SortableContext>

          {/* DragOverlay renders at document.body — always follows mouse precisely */}
          {createPortal(
            <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18,0.67,0.6,1.22)' }}>
              {activeCard && (
                <div className="kanban-card overlay-card">
                  {activeCard.label_color && <div className="card-label" style={{ background: activeCard.label_color }} />}
                  <div className="card-title">{activeCard.title}</div>
                </div>
              )}
              {activeColumn && (
                <div className="kanban-column overlay-column">
                  <div className="column-header">
                    <h3 className="column-title">{activeColumn.title}</h3>
                  </div>
                  <div className="column-cards">
                    {activeColumn.cards.slice(0, 4).map((card) => (
                      <div key={card.id} className="kanban-card">
                        {card.label_color && <div className="card-label" style={{ background: card.label_color }} />}
                        <div className="card-title">{card.title}</div>
                      </div>
                    ))}
                    {activeColumn.cards.length > 4 && (
                      <div className="overlay-more">+{activeColumn.cards.length - 4} more</div>
                    )}
                  </div>
                </div>
              )}
            </DragOverlay>,
            document.body
          )}
        </DndContext>
      </div>

      {selectedCard && (
        <CardModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onUpdate={onCardUpdate}
          onDelete={onCardDelete}
        />
      )}
    </div>
  );
}
