import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '../types';

interface Props {
  card: Card;
  columnId: number;
  onClick: (card: Card) => void;
  dragDisabled?: boolean;
}

function formatDueDate(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return { label: 'Today', status: 'today' };
  if (diffDays === 1) return { label: 'Tomorrow', status: 'upcoming' };
  if (diffDays === -1) return { label: 'Yesterday', status: 'overdue' };
  if (diffDays < 0) return { label: due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), status: 'overdue' };
  if (diffDays <= 7) return { label: due.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }), status: 'upcoming' };
  return { label: due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), status: 'upcoming' };
}

export default function KanbanCard({ card, columnId, onClick, dragDisabled }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `card-${card.id}`,
    data: { type: 'card', card, columnId },
    disabled: dragDisabled,
  });

  const checklist = card.checklist_items ?? [];
  const checked = checklist.filter((i) => i.is_checked).length;
  const total = checklist.length;
  const allDone = total > 0 && checked === total;
  const due = card.due_date ? formatDueDate(card.due_date) : null;
  const priorityLabel: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      className="kanban-card"
      onClick={() => onClick(card)}
    >
      {card.label_color && <div className="card-label" style={{ background: card.label_color }} />}
      <div className="card-title">{card.title}</div>

      {(due || total > 0 || card.description || card.priority) && (
        <div className="card-badges">
          {card.priority && (
            <span className={`badge badge-priority-${card.priority}`}>
              ● {priorityLabel[card.priority]}
            </span>
          )}

          {card.description && (
            <span className="badge badge-desc" title="Has description">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M1 2.75A.75.75 0 011.75 2h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 2.75zm0 5A.75.75 0 011.75 7h12.5a.75.75 0 010 1.5H1.75A.75.75 0 011 7.75zm0 5a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5a.75.75 0 01-.75-.75z" />
              </svg>
            </span>
          )}

          {due && (
            <span className={`badge badge-due badge-due-${due.status}`}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3.5a.5.5 0 00-1 0v1H2.5A1.5 1.5 0 001 6v7a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0015 13V6a1.5 1.5 0 00-1.5-1.5H12V3.5a.5.5 0 00-1 0V4.5H5V3.5zM2 7h12v6a.5.5 0 01-.5.5h-11A.5.5 0 012 13V7z" />
              </svg>
              {due.label}
            </span>
          )}

          {total > 0 && (
            <span className={`badge badge-checklist ${allDone ? 'badge-done' : ''}`}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
              {checked}/{total}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
