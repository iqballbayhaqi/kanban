import { useState, useRef } from 'react';
import { Card, ChecklistItem } from '../types';
import api from '../api';
import DatePicker from './DatePicker';
import { useDialog } from '../contexts/DialogContext';

const PRIORITIES = [
  { value: 'low',    label: 'Low'    },
  { value: 'medium', label: 'Medium' },
  { value: 'high',   label: 'High'   },
  { value: 'urgent', label: 'Urgent' },
];

const LABELS = [
  { color: '#61bd4f', name: 'Green' },
  { color: '#f2d600', name: 'Yellow' },
  { color: '#ff9f1a', name: 'Orange' },
  { color: '#eb5a46', name: 'Red' },
  { color: '#c377e0', name: 'Purple' },
  { color: '#0079bf', name: 'Blue' },
  { color: '#00c2e0', name: 'Sky' },
  { color: '#51e898', name: 'Lime' },
  { color: '#ff78cb', name: 'Pink' },
];

interface Props {
  card: Card;
  onClose: () => void;
  onUpdate: (card: Card) => void;
  onDelete: (cardId: number) => void;
}

export default function CardModal({ card, onClose, onUpdate, onDelete }: Props) {
  const { confirm } = useDialog();
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.description || '');
  const [label, setLabel] = useState(card.label_color || '');
  const [dueDate, setDueDate] = useState(card.due_date || '');
  const [priority, setPriority] = useState(card.priority || '');
  const [items, setItems] = useState<ChecklistItem[]>(card.checklist_items || []);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState('');
  const newItemRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setClosing(true);
    setTimeout(onClose, 180);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/cards/${card.id}`, {
        title,
        description: desc,
        label_color: label || null,
        due_date: dueDate || null,
        priority: priority || null,
      });
      onUpdate({ ...data, checklist_items: items });
      handleClose();
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    const ok = await confirm(`"${card.title}" akan dihapus secara permanen.`, {
      title: 'Hapus Card?', confirmLabel: 'Hapus', variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/cards/${card.id}`);
    onDelete(card.id);
    handleClose();
  };

  const addItem = async () => {
    if (!newItemTitle.trim()) return;
    try {
      const { data } = await api.post(`/cards/${card.id}/checklist`, { title: newItemTitle.trim() });
      setItems((prev) => [...prev, data]);
      setNewItemTitle('');
      newItemRef.current?.focus();
    } catch (err) { console.error(err); }
  };

  const toggleItem = async (item: ChecklistItem) => {
    const newChecked = item.is_checked ? 0 : 1;
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_checked: newChecked } : i));
    try {
      await api.put(`/checklist/${item.id}`, { is_checked: newChecked === 1 });
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_checked: item.is_checked } : i));
    }
  };

  const saveItemTitle = async (item: ChecklistItem) => {
    const trimmed = editingItemTitle.trim();
    setEditingItemId(null);
    if (!trimmed || trimmed === item.title) { setEditingItemTitle(''); return; }
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, title: trimmed } : i));
    try {
      await api.put(`/checklist/${item.id}`, { title: trimmed });
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, title: item.title } : i));
    }
    setEditingItemTitle('');
  };

  const deleteItem = async (itemId: number) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try { await api.delete(`/checklist/${itemId}`); }
    catch { /* revert would need original state, skip for simplicity */ }
  };

  const checked = items.filter((i) => i.is_checked).length;
  const total = items.length;
  const progress = total > 0 ? Math.round((checked / total) * 100) : 0;

  return (
    <div className={`modal-overlay${closing ? ' is-closing' : ''}`} onClick={handleClose}>
      <div className={`modal modal-card${closing ? ' is-closing' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Card</h3>
          <button className="modal-close" onClick={handleClose}>✕</button>
        </div>

        {label && <div className="card-label-bar" style={{ background: label }} />}

        {/* Title */}
        <div className="form-group">
          <label>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>

        {/* Description */}
        <div className="form-group">
          <label>Description</label>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Add a description..." />
        </div>

        <div className="modal-row">
          {/* Due Date — custom picker */}
          <div className="form-group" style={{ flex: 1 }}>
            <label>Due Date</label>
            <DatePicker value={dueDate} onChange={setDueDate} />
          </div>

          {/* Label */}
          <div className="form-group" style={{ flex: 1 }}>
            <label>Label</label>
            <div className="label-picker">
              <button className={`label-none ${!label ? 'selected' : ''}`} onClick={() => setLabel('')}>None</button>
              {LABELS.map((l) => (
                <button
                  key={l.color}
                  className={`label-swatch ${label === l.color ? 'selected' : ''}`}
                  style={{ background: l.color }}
                  title={l.name}
                  onClick={() => setLabel(l.color)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Priority */}
        <div className="form-group">
          <label>Priority</label>
          <div className="priority-picker">
            {PRIORITIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`priority-btn priority-btn-${value}${priority === value ? ' active' : ''}`}
                onClick={() => setPriority(priority === value ? '' : value)}
              >
                <span className="priority-dot" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="form-group">
          <div className="checklist-header">
            <label>Checklist</label>
            {total > 0 && <span className="checklist-count">{checked}/{total}</span>}
          </div>

          {total > 0 && (
            <div className="checklist-progress">
              <span className="checklist-pct">{progress}%</span>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%`, background: progress === 100 ? '#61bd4f' : '#0079bf' }}
                />
              </div>
            </div>
          )}

          <div className="checklist-items">
            {items.map((item) => (
              <div key={item.id} className="checklist-item">
                <input
                  type="checkbox"
                  checked={item.is_checked === 1}
                  onChange={() => toggleItem(item)}
                  className="checklist-checkbox"
                />
                {editingItemId === item.id ? (
                  <input
                    className="checklist-item-input"
                    value={editingItemTitle}
                    onChange={(e) => setEditingItemTitle(e.target.value)}
                    onBlur={() => saveItemTitle(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveItemTitle(item);
                      if (e.key === 'Escape') { setEditingItemId(null); setEditingItemTitle(''); }
                    }}
                    autoFocus
                  />
                ) : (
                  <span
                    className={`checklist-item-title ${item.is_checked ? 'checked' : ''}`}
                    onClick={() => { setEditingItemId(item.id); setEditingItemTitle(item.title); }}
                  >
                    {item.title}
                  </span>
                )}
                <button className="checklist-delete-btn" onClick={() => deleteItem(item.id)}>✕</button>
              </div>
            ))}
          </div>

          {addingItem ? (
            <div className="checklist-add-form">
              <input
                ref={newItemRef}
                type="text"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                placeholder="Add an item..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addItem();
                  if (e.key === 'Escape') { setAddingItem(false); setNewItemTitle(''); }
                }}
                autoFocus
              />
              <div className="add-card-actions">
                <button className="btn-primary btn-sm" onClick={addItem} disabled={!newItemTitle.trim()}>Add</button>
                <button className="btn-ghost btn-sm" onClick={() => { setAddingItem(false); setNewItemTitle(''); }}>✕</button>
              </div>
            </div>
          ) : (
            <button className="checklist-add-btn" onClick={() => setAddingItem(true)}>+ Add an item</button>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-primary" onClick={save} disabled={!title.trim() || saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn-danger" onClick={handleDelete}>Delete</button>
          <button className="btn-secondary" onClick={handleClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
