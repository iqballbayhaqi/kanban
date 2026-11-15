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

const PRIORITY_LABEL: Record<string, string> = Object.fromEntries(PRIORITIES.map((p) => [p.value, p.label]));

function formatFullDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function dueStatus(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / 86400000);
  return diff < 0 ? 'overdue' : diff === 0 ? 'today' : 'upcoming';
}

export default function CardModal({ card: initialCard, onClose, onUpdate, onDelete }: Props) {
  const { confirm } = useDialog();
  // Klik card membuka mode lihat; tombol Edit baru menampilkan form.
  const [card, setCard] = useState(initialCard);
  const [editing, setEditing] = useState(false);
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
    // Checklist bisa dicentang di mode lihat, jadi kirim item terbaru ke board saat ditutup.
    onUpdate({ ...card, checklist_items: items });
    setClosing(true);
    setTimeout(onClose, 180);
  };

  const resetForm = (c: Card) => {
    setTitle(c.title);
    setDesc(c.description || '');
    setLabel(c.label_color || '');
    setDueDate(c.due_date || '');
    setPriority(c.priority || '');
    setAddingItem(false);
    setNewItemTitle('');
    setEditingItemId(null);
  };

  const cancelEdit = () => {
    resetForm(card);
    setEditing(false);
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
      const updated = { ...data, checklist_items: items };
      setCard(updated);
      onUpdate(updated);
      resetForm(updated);
      setEditing(false);
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

  const progressBar = total > 0 && (
    <div className="checklist-progress">
      <span className="checklist-pct">{progress}%</span>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%`, background: progress === 100 ? '#61bd4f' : '#15803d' }}
        />
      </div>
    </div>
  );

  if (!editing) {
    const labelName = LABELS.find((l) => l.color === card.label_color)?.name;
    return (
      <div className={`modal-overlay${closing ? ' is-closing' : ''}`} onClick={handleClose}>
        <div className={`modal modal-card card-view${closing ? ' is-closing' : ''}`} onClick={(e) => e.stopPropagation()}>
          {card.label_color && <div className="card-label-bar" style={{ background: card.label_color }} />}

          <div className="modal-header">
            <h3 className="card-view-title">{card.title}</h3>
            <button className="modal-close" onClick={handleClose}>✕</button>
          </div>

          {(card.priority || card.due_date || card.label_color) && (
            <div className="card-view-meta">
              {card.priority && (
                <div className="card-view-meta-item">
                  <span className="card-view-meta-label">Priority</span>
                  <span className={`badge badge-priority-${card.priority}`}>● {PRIORITY_LABEL[card.priority]}</span>
                </div>
              )}
              {card.due_date && (
                <div className="card-view-meta-item">
                  <span className="card-view-meta-label">Due Date</span>
                  <span className={`badge badge-due badge-due-${dueStatus(card.due_date)}`}>{formatFullDate(card.due_date)}</span>
                </div>
              )}
              {card.label_color && (
                <div className="card-view-meta-item">
                  <span className="card-view-meta-label">Label</span>
                  <span className="card-view-label">
                    <span className="card-view-label-dot" style={{ background: card.label_color }} />
                    {labelName ?? card.label_color}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="card-view-section">
            <div className="card-view-meta-label">Description</div>
            {card.description
              ? <p className="card-view-desc">{card.description}</p>
              : <p className="card-view-empty">Belum ada deskripsi.</p>}
          </div>

          {total > 0 && (
            <div className="card-view-section">
              <div className="checklist-header">
                <span className="card-view-meta-label">Checklist</span>
                <span className="checklist-count">{checked}/{total}</span>
              </div>
              {progressBar}
              <div className="checklist-items">
                {items.map((item) => (
                  <label key={item.id} className="checklist-item card-view-check">
                    <input
                      type="checkbox"
                      checked={item.is_checked === 1}
                      onChange={() => toggleItem(item)}
                      className="checklist-checkbox"
                    />
                    <span className={`checklist-item-title ${item.is_checked ? 'checked' : ''}`}>{item.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button className="btn-primary" onClick={() => setEditing(true)} autoFocus>Edit</button>
            <button className="btn-secondary" onClick={handleClose}>Tutup</button>
          </div>
        </div>
      </div>
    );
  }

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

          {progressBar}

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
          <button className="btn-secondary" onClick={cancelEdit}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
