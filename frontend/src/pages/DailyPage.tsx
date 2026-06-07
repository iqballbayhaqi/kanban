import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import api from '../api';
import { Habit } from '../types';
import { LayoutContext } from '../components/AppLayout';
import { useDialog } from '../contexts/DialogContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DayData { date: string; done: boolean; created: boolean; }
interface HabitStats {
  current_streak: number; best_streak: number; total_done: number;
  completion_rate: number; done_in_period: number; period_days: number;
}
interface HabitHistory extends Habit { days: DayData[]; stats: HabitStats; }

// ─── Constants ────────────────────────────────────────────────────────────────

const HABIT_COLORS = [
  '#0079bf','#4bbf6b','#ff9f1a','#eb5a46',
  '#c377e0','#00c2e0','#f2d600','#ff78cb','#51e898','#838c91',
];
const DOW_LABELS = ['Sn','Sl','Rb','Km','Jm','Sb','Mg'];

// ─── Habit Card ───────────────────────────────────────────────────────────────

function missLabel(n: number) {
  return n === 1 ? 'kemarin terlewat' : `${n} hari terlewat`;
}

function HabitCard({ habit, onToggle, onEdit, onDelete }: {
  habit: Habit; onToggle: (h: Habit) => void;
  onEdit: (h: Habit) => void; onDelete: (h: Habit) => void;
}) {
  const showMiss = !habit.done && habit.miss_streak > 0;
  const missHigh = habit.miss_streak >= 3;
  return (
    <div
      className={`habit-card${habit.done ? ' habit-done' : ''}${showMiss && missHigh ? ' habit-at-risk' : ''}`}
      style={{ borderLeftColor: habit.color }}
      onClick={() => onToggle(habit)}
    >
      <div className="habit-check-circle">
        {habit.done && (
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
          </svg>
        )}
      </div>
      <div className="habit-card-body">
        <span className="habit-card-title">{habit.title}</span>
        <div className="habit-card-badges">
          {habit.streak > 0 && (
            <span className={`habit-streak${habit.streak >= 7 ? ' habit-streak-hot' : ''}`}>
              🔥 {habit.streak}
            </span>
          )}
          {showMiss && (
            <span className={`habit-miss${missHigh ? ' habit-miss-high' : ''}`} title={missLabel(habit.miss_streak)}>
              ⚠ {habit.miss_streak}
            </span>
          )}
        </div>
      </div>
      <div className="habit-card-actions" onClick={e => e.stopPropagation()}>
        <button className="habit-action-btn" title="Edit" onClick={() => onEdit(habit)}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.25.25 0 00.108-.064L11.189 6.25z"/>
          </svg>
        </button>
        <button className="habit-action-btn habit-action-delete" title="Delete" onClick={() => onDelete(habit)}>✕</button>
      </div>
    </div>
  );
}

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="habit-color-row">
      {HABIT_COLORS.map(c => (
        <button key={c} type="button"
          className={`habit-color-dot${value === c ? ' active' : ''}`}
          style={{ background: c }} onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}

// ─── History Card (heatmap + stats) ───────────────────────────────────────────

function HistoryCard({ habit }: { habit: HabitHistory }) {
  const { stats, days } = habit;
  const firstDow = days.length > 0 ? (new Date(days[0].date + 'T12:00:00').getDay() + 6) % 7 : 0;

  const cellTitle = (d: DayData) => {
    const date = new Date(d.date + 'T12:00:00');
    const label = date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!d.created) return `${label}: —`;
    return `${label}: ${d.done ? '✓ Selesai' : '✗ Terlewat'}`;
  };

  return (
    <div className="history-card">
      <div className="history-card-header">
        <span className="history-habit-dot" style={{ background: habit.color }} />
        <span className="history-habit-name">{habit.title}</span>
        {habit.done && <span className="history-done-today">✓ Hari ini</span>}
      </div>

      <div className="history-stats-row">
        <div className="hstat">
          <span className="hstat-val">🔥 {stats.current_streak}</span>
          <span className="hstat-lbl">Streak</span>
        </div>
        <div className="hstat">
          <span className="hstat-val">🏆 {stats.best_streak}</span>
          <span className="hstat-lbl">Terbaik</span>
        </div>
        <div className="hstat">
          <span className="hstat-val">{stats.total_done}</span>
          <span className="hstat-lbl">Total ✓</span>
        </div>
        <div className="hstat">
          <span className="hstat-val">{stats.done_in_period}/{stats.period_days}</span>
          <span className="hstat-lbl">Periode ini</span>
        </div>
        <div className="hstat hstat-highlight">
          <span className="hstat-val">{stats.completion_rate}%</span>
          <span className="hstat-lbl">Konsistensi</span>
        </div>
      </div>

      <div className="heatmap-wrap">
        <div className="heatmap-dows">
          {DOW_LABELS.map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="heatmap-grid">
          {Array(firstDow).fill(null).map((_, i) => (
            <div key={`e${i}`} className="hcell hcell-empty" />
          ))}
          {days.map((day, i) => (
            <div
              key={i}
              className={`hcell ${!day.created ? 'hcell-na' : day.done ? 'hcell-done' : 'hcell-miss'}`}
              style={day.done ? { background: habit.color } : {}}
              title={cellTitle(day)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DailyPage() {
  const [habits, setHabits]                 = useState<Habit[]>([]);
  const [loading, setLoading]               = useState(true);
  const [addingHabit, setAddingHabit]       = useState(false);
  const [newTitle, setNewTitle]             = useState('');
  const [newColor, setNewColor]             = useState('#0079bf');
  const [editTarget, setEditTarget]         = useState<Habit | null>(null);
  const [editTitle, setEditTitle]           = useState('');
  const [editColor, setEditColor]           = useState('');
  const [editClosing, setEditClosing]       = useState(false);
  const [view, setView]                     = useState<'today' | 'history'>('today');
  const [historyDays, setHistoryDays]       = useState<30 | 90>(30);
  const [historyData, setHistoryData]       = useState<HabitHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { onMenuClick } = useOutletContext<LayoutContext>();
  const { confirm } = useDialog();

  const dateLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  useEffect(() => {
    api.get('/habits')
      .then(r => setHabits(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadHistory = async (days: 30 | 90) => {
    setHistoryDays(days);
    setHistoryLoading(true);
    try {
      const { data } = await api.get(`/habits/history?days=${days}`);
      setHistoryData(data);
    } catch (err) { console.error(err); }
    finally { setHistoryLoading(false); }
  };

  const switchToHistory = (days: 30 | 90 = historyDays) => {
    setView('history');
    loadHistory(days);
  };

  const toggleHabit = async (habit: Habit) => {
    setHabits(prev => prev.map(h =>
      h.id === habit.id
        ? { ...h, done: !h.done, streak: !h.done ? h.streak + 1 : Math.max(0, h.streak - 1), miss_streak: !h.done ? 0 : h.miss_streak }
        : h
    ));
    try {
      const { data } = await api.post(`/habits/${habit.id}/toggle`);
      setHabits(prev => prev.map(h => h.id === data.id ? data : h));
    } catch {
      setHabits(prev => prev.map(h => h.id === habit.id ? habit : h));
    }
  };

  const addHabit = async () => {
    if (!newTitle.trim()) return;
    try {
      const { data } = await api.post('/habits', { title: newTitle.trim(), color: newColor });
      setHabits(prev => [...prev, data]);
      setNewTitle(''); setNewColor('#0079bf'); setAddingHabit(false);
    } catch (err) { console.error(err); }
  };

  const openEdit = (h: Habit) => {
    setEditTarget(h); setEditTitle(h.title); setEditColor(h.color); setEditClosing(false);
  };
  const closeEdit = () => {
    setEditClosing(true);
    setTimeout(() => { setEditTarget(null); setEditClosing(false); }, 180);
  };
  const saveEdit = async () => {
    if (!editTarget || !editTitle.trim()) return;
    try {
      const { data } = await api.put(`/habits/${editTarget.id}`, { title: editTitle.trim(), color: editColor });
      setHabits(prev => prev.map(h => h.id === data.id ? data : h));
      closeEdit();
    } catch (err) { console.error(err); }
  };

  const deleteHabit = async (habit: Habit) => {
    const ok = await confirm(`"${habit.title}" akan dihapus dari daftar habit kamu.`, {
      title: 'Hapus Habit?', confirmLabel: 'Hapus', variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/habits/${habit.id}`);
    setHabits(prev => prev.filter(h => h.id !== habit.id));
  };

  const todo      = habits.filter(h => !h.done);
  const done      = habits.filter(h =>  h.done);
  const total     = habits.length;
  const doneCount = done.length;
  const progress  = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allDone   = total > 0 && doneCount === total;

  if (loading) return <div className="page-loading">Loading habits...</div>;

  return (
    <div className="daily-page">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="daily-topbar">
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div className="daily-topbar-center">
          <span className="daily-topbar-title">Daily Habits</span>
          {view === 'today' && <span className="daily-topbar-date">{dateLabel}</span>}
        </div>

        <div className="daily-view-tabs">
          <button
            className={`daily-view-tab${view === 'today' ? ' active' : ''}`}
            onClick={() => setView('today')}
          >Hari Ini</button>
          <button
            className={`daily-view-tab${view === 'history' ? ' active' : ''}`}
            onClick={() => switchToHistory()}
          >Riwayat</button>
        </div>

        {view === 'today' && (
          <div className="daily-prog">
            <span className="daily-prog-label">{doneCount}/{total}</span>
            <div className="daily-prog-bar">
              <div
                className={`daily-prog-fill${allDone ? ' daily-prog-complete' : ''}`}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="daily-prog-pct">{progress}%</span>
          </div>
        )}
      </header>

      {view === 'today' && allDone && total > 0 && (
        <div className="daily-congrats">🎉 Semua habit selesai hari ini! Kerja bagus!</div>
      )}

      <main className="daily-main">
        {/* ── Today view ──────────────────────────────────────────────────── */}
        {view === 'today' && (
          total === 0 && !addingHabit ? (
            <div className="daily-empty">
              <div className="daily-empty-icon">🌱</div>
              <h2>Mulai perjalanan habit kamu</h2>
              <p>Tambahkan habit pertama yang ingin kamu lakukan setiap hari</p>
              <button className="btn-primary" onClick={() => setAddingHabit(true)}>+ Tambah Habit</button>
            </div>
          ) : (
            <div className="daily-columns">
              <div className="daily-col">
                <div className="daily-col-header">
                  <span className="daily-col-icon">📋</span>
                  <h2 className="daily-col-title">Belum Selesai</h2>
                  <span className="daily-col-count">{todo.length}</span>
                </div>
                <div className="daily-cards">
                  {todo.map(h => (
                    <HabitCard key={h.id} habit={h} onToggle={toggleHabit} onEdit={openEdit} onDelete={deleteHabit} />
                  ))}
                  {todo.length === 0 && <div className="daily-col-empty">Semua selesai! 🎉</div>}
                </div>
                {addingHabit ? (
                  <div className="habit-add-form">
                    <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                      placeholder="Nama habit..." autoFocus
                      onKeyDown={e => {
                        if (e.key === 'Enter') addHabit();
                        if (e.key === 'Escape') { setAddingHabit(false); setNewTitle(''); }
                      }}
                    />
                    <ColorPicker value={newColor} onChange={setNewColor} />
                    <div className="add-card-actions">
                      <button className="btn-primary btn-sm" onClick={addHabit} disabled={!newTitle.trim()}>Tambah</button>
                      <button className="btn-ghost btn-sm" onClick={() => { setAddingHabit(false); setNewTitle(''); }}>✕</button>
                    </div>
                  </div>
                ) : (
                  <button className="habit-add-btn" onClick={() => setAddingHabit(true)}>+ Tambah Habit</button>
                )}
              </div>

              <div className="daily-col daily-col-done-bg">
                <div className="daily-col-header">
                  <span className="daily-col-icon">✅</span>
                  <h2 className="daily-col-title">Selesai Hari Ini</h2>
                  <span className="daily-col-count daily-col-count-done">{done.length}</span>
                </div>
                <div className="daily-cards">
                  {done.map(h => (
                    <HabitCard key={h.id} habit={h} onToggle={toggleHabit} onEdit={openEdit} onDelete={deleteHabit} />
                  ))}
                  {done.length === 0 && <div className="daily-col-empty">Klik habit untuk menyelesaikan</div>}
                </div>
              </div>
            </div>
          )
        )}

        {/* ── History view ─────────────────────────────────────────────────── */}
        {view === 'history' && (
          <div className="history-view">
            <div className="history-period-bar">
              <span className="history-period-label">Tampilkan:</span>
              <button className={`period-btn${historyDays === 30 ? ' active' : ''}`} onClick={() => switchToHistory(30)}>30 Hari</button>
              <button className={`period-btn${historyDays === 90 ? ' active' : ''}`} onClick={() => switchToHistory(90)}>90 Hari</button>
            </div>

            {historyLoading ? (
              <div className="history-loading">
                <div className="history-loading-spinner" />
                Memuat riwayat...
              </div>
            ) : historyData.length === 0 ? (
              <div className="daily-empty">
                <div className="daily-empty-icon">📊</div>
                <h2>Belum ada riwayat</h2>
                <p>Tambahkan habit dan mulai track hari ini</p>
                <button className="btn-primary" onClick={() => setView('today')}>Hari Ini →</button>
              </div>
            ) : (
              <>
                <div className="history-summary">
                  <div className="history-summary-item">
                    <span className="history-summary-val">{historyData.length}</span>
                    <span className="history-summary-lbl">Habit aktif</span>
                  </div>
                  <div className="history-summary-item">
                    <span className="history-summary-val">
                      {Math.round(historyData.reduce((s, h) => s + h.stats.completion_rate, 0) / historyData.length)}%
                    </span>
                    <span className="history-summary-lbl">Rata-rata konsistensi</span>
                  </div>
                  <div className="history-summary-item">
                    <span className="history-summary-val">
                      {Math.max(...historyData.map(h => h.stats.best_streak))}
                    </span>
                    <span className="history-summary-lbl">Streak terpanjang</span>
                  </div>
                  <div className="history-summary-item">
                    <span className="history-summary-val">
                      {historyData.reduce((s, h) => s + h.stats.total_done, 0)}
                    </span>
                    <span className="history-summary-lbl">Total selesai</span>
                  </div>
                </div>

                <div className="history-cards">
                  {historyData.map(h => <HistoryCard key={h.id} habit={h} />)}
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {editTarget && (
        <div className={`modal-overlay${editClosing ? ' is-closing' : ''}`} onClick={closeEdit}>
          <div className={`modal${editClosing ? ' is-closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Habit</h3>
              <button className="modal-close" onClick={closeEdit}>✕</button>
            </div>
            <div className="form-group">
              <label>Nama</label>
              <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') closeEdit(); }}
              />
            </div>
            <div className="form-group">
              <label>Warna</label>
              <ColorPicker value={editColor} onChange={setEditColor} />
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={saveEdit} disabled={!editTitle.trim()}>Simpan</button>
              <button className="btn-secondary" onClick={closeEdit}>Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
