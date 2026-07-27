import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import api from '../api';
import { MasterCard, MasterColumn } from '../types';
import { LayoutContext } from '../components/AppLayout';
import SelectMenu, { SelectOption } from '../components/SelectMenu';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type DueStatus = 'overdue' | 'today' | 'upcoming' | 'none';

function dueInfo(dateStr?: string | null): { label: string; status: DueStatus; days: number } {
  if (!dateStr) return { label: '—', status: 'none', days: Infinity };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);

  if (days === 0) return { label: 'Hari ini', status: 'today', days };
  if (days === 1) return { label: 'Besok', status: 'upcoming', days };
  if (days === -1) return { label: 'Kemarin', status: 'overdue', days };

  const label = due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  return { label, status: days < 0 ? 'overdue' : 'upcoming', days };
}

const PRIORITY_LABEL: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// ─── Sorting ──────────────────────────────────────────────────────────────────

type SortKey = 'title' | 'board' | 'list' | 'priority' | 'due' | 'checklist';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'title',     label: 'Item', className: 'master-th-task' },
  { key: 'board',     label: 'Board' },
  { key: 'list',      label: 'List' },
  { key: 'priority',  label: 'Prioritas' },
  { key: 'due',       label: 'Deadline' },
  { key: 'checklist', label: 'Checklist' },
];

// Keterangan arah urut per kolom, dipakai sebagai tooltip header.
const DIR_HINT: Record<SortKey, [asc: string, desc: string]> = {
  title:     ['A → Z', 'Z → A'],
  board:     ['A → Z', 'Z → A'],
  list:      ['A → Z', 'Z → A'],
  priority:  ['Urgent lebih dulu', 'Low lebih dulu'],
  due:       ['Paling dekat lebih dulu', 'Paling jauh lebih dulu'],
  checklist: ['Progres terkecil lebih dulu', 'Progres terbesar lebih dulu'],
};

/**
 * Nilai urut per kolom. `empty` menandai card tanpa nilai (tidak ada prioritas /
 * deadline / checklist) — selalu ditaruh paling bawah baik saat urutan naik
 * maupun turun, supaya baris kosong tidak menutupi data yang terisi.
 */
function sortValue(card: MasterCard, key: SortKey): { empty: boolean; v: number | string } {
  switch (key) {
    case 'title':
      return { empty: false, v: card.title.toLowerCase() };
    case 'board':
      return { empty: false, v: card.board_title.toLowerCase() };
    case 'list':
      return { empty: false, v: card.column_title.toLowerCase() };
    case 'priority':
      return { empty: !card.priority, v: PRIORITY_RANK[card.priority || ''] ?? 99 };
    case 'due':
      return { empty: !card.due_date, v: dueInfo(card.due_date).days };
    case 'checklist':
      return {
        empty: card.checklist_total === 0,
        v: card.checklist_total === 0 ? 0 : card.checklist_checked / card.checklist_total,
      };
  }
}

// Urutan asli board → list → posisi card, dipakai sebagai pemecah nilai seri.
function naturalOrder(a: MasterCard, b: MasterCard): number {
  return (
    a.board_title.localeCompare(b.board_title) ||
    a.column_position - b.column_position ||
    a.position - b.position
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MasterPage() {
  const [cards, setCards] = useState<MasterCard[]>([]);
  const [columns, setColumns] = useState<MasterColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [boardFilter, setBoardFilter] = useState('all');
  const [listFilter, setListFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [dueFilter, setDueFilter] = useState<'all' | DueStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('board');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const { onMenuClick } = useOutletContext<LayoutContext>();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/cards/all'), api.get('/columns/all')])
      .then(([cardsRes, colsRes]) => { setCards(cardsRes.data); setColumns(colsRes.data); })
      .catch(err => { console.error(err); setError('Gagal memuat data kanban.'); })
      .finally(() => setLoading(false));
  }, []);

  // List tujuan yang boleh dipilih per card — hanya list dari board card itu.
  // Backend sudah mengurutkan per board_id lalu position.
  const columnsByBoard = useMemo(() => {
    const map = new Map<number, MasterColumn[]>();
    columns.forEach(col => {
      const list = map.get(col.board_id);
      if (list) list.push(col);
      else map.set(col.board_id, [col]);
    });
    return map;
  }, [columns]);

  // Opsi filter diturunkan dari data yang ada, bukan hardcode.
  const boardOptions = useMemo<SelectOption[]>(() => {
    const map = new Map<number, { title: string; color: string }>();
    cards.forEach(c => map.set(c.board_id, { title: c.board_title, color: c.board_color }));
    return [
      { value: 'all', label: 'Semua board', swatch: '' },
      ...[...map.entries()].map(([id, b]) => ({ value: String(id), label: b.title, swatch: b.color })),
    ];
  }, [cards]);

  const listOptions = useMemo<SelectOption[]>(() => {
    const scoped = boardFilter === 'all' ? cards : cards.filter(c => String(c.board_id) === boardFilter);
    const titles = [...new Set(scoped.map(c => c.column_title))].sort();
    return [
      { value: 'all', label: 'Semua list' },
      ...titles.map(t => ({ value: t, label: t })),
    ];
  }, [cards, boardFilter]);

  const priorityOptions: SelectOption[] = [
    { value: 'all', label: 'Semua prioritas' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: '', label: 'Tanpa prioritas' },
  ];

  const dueOptions: SelectOption[] = [
    { value: 'all', label: 'Semua deadline' },
    { value: 'overdue', label: 'Lewat deadline' },
    { value: 'today', label: 'Hari ini' },
    { value: 'upcoming', label: 'Akan datang' },
    { value: 'none', label: 'Tanpa deadline' },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = cards.filter(c => {
      if (boardFilter !== 'all' && String(c.board_id) !== boardFilter) return false;
      if (listFilter !== 'all' && c.column_title !== listFilter) return false;
      if (priorityFilter !== 'all' && (c.priority || '') !== priorityFilter) return false;
      if (dueFilter !== 'all' && dueInfo(c.due_date).status !== dueFilter) return false;
      if (q) {
        const haystack = `${c.title} ${c.description || ''} ${c.board_title} ${c.column_title}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const factor = sortDir === 'asc' ? 1 : -1;

    return [...result].sort((a, b) => {
      const va = sortValue(a, sortBy);
      const vb = sortValue(b, sortBy);

      // Baris tanpa nilai selalu di bawah, tidak ikut dibalik arahnya.
      if (va.empty !== vb.empty) return va.empty ? 1 : -1;

      const diff = typeof va.v === 'string'
        ? va.v.localeCompare(vb.v as string)
        : (va.v as number) - (vb.v as number);

      return diff !== 0 ? diff * factor : naturalOrder(a, b);
    });
  }, [cards, search, boardFilter, listFilter, priorityFilter, dueFilter, sortBy, sortDir]);

  const stats = useMemo(() => {
    let overdue = 0, today = 0, noDue = 0;
    cards.forEach(c => {
      const s = dueInfo(c.due_date).status;
      if (s === 'overdue') overdue++;
      else if (s === 'today') today++;
      else if (s === 'none') noDue++;
    });
    // -1 karena boardOptions memuat entri "Semua board".
    return { total: cards.length, boards: boardOptions.length - 1, overdue, today, noDue };
  }, [cards, boardOptions]);

  const filtersActive =
    search !== '' || boardFilter !== 'all' || listFilter !== 'all' ||
    priorityFilter !== 'all' || dueFilter !== 'all';

  const resetFilters = () => {
    setSearch(''); setBoardFilter('all'); setListFilter('all');
    setPriorityFilter('all'); setDueFilter('all');
  };

  // Ganti board → reset filter list, karena daftar list-nya ikut berubah.
  const changeBoard = (value: string) => { setBoardFilter(value); setListFilter('all'); };

  /**
   * Pindahkan card ke list lain langsung dari tabel (mis. On Progress → Done).
   * Card ditaruh di urutan paling bawah list tujuan; tabel ini tidak punya
   * konsep drag antar posisi, jadi "append" adalah satu-satunya arti yang jelas.
   * State diperbarui duluan supaya baris langsung berubah, lalu dikembalikan
   * kalau request-nya gagal.
   */
  const moveCard = async (card: MasterCard, targetId: number) => {
    if (targetId === card.column_id) return;
    const target = columns.find(c => c.id === targetId);
    if (!target) return;

    const position = cards.filter(c => c.column_id === targetId).length;

    setMoveError(null);
    setMovingId(card.id);
    setCards(prev => prev.map(c =>
      c.id === card.id
        ? { ...c, column_id: target.id, column_title: target.title, column_position: target.position, position }
        : c
    ));

    try {
      await api.put(`/cards/${card.id}/move`, { column_id: target.id, position });
    } catch (err) {
      console.error(err);
      setCards(prev => prev.map(c =>
        c.id === card.id
          ? { ...c, column_id: card.column_id, column_title: card.column_title, column_position: card.column_position, position: card.position }
          : c
      ));
      setMoveError(`Gagal memindahkan "${card.title}" ke ${target.title}.`);
    } finally {
      setMovingId(null);
    }
  };

  // Klik header: kolom sama → balik arah, kolom lain → pindah kolom, mulai naik.
  const toggleSort = (key: SortKey) => {
    if (key === sortBy) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

  return (
    <div className="master">
      <header className="page-header">
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <h1 className="page-header-title">Master Kanban</h1>
        <span className="master-count">
          {filtered.length === cards.length
            ? `${cards.length} item`
            : `${filtered.length} dari ${cards.length} item`}
        </span>
      </header>

      <main className="master-main">
        <div className="master-stats">
          <div className="master-stat">
            <span className="master-stat-value">{stats.total}</span>
            <span className="master-stat-label">Total item</span>
          </div>
          <div className="master-stat">
            <span className="master-stat-value">{stats.boards}</span>
            <span className="master-stat-label">Board</span>
          </div>
          <div className={`master-stat${stats.overdue > 0 ? ' master-stat-danger' : ''}`}>
            <span className="master-stat-value">{stats.overdue}</span>
            <span className="master-stat-label">Lewat deadline</span>
          </div>
          <div className={`master-stat${stats.today > 0 ? ' master-stat-warn' : ''}`}>
            <span className="master-stat-value">{stats.today}</span>
            <span className="master-stat-label">Jatuh tempo hari ini</span>
          </div>
          <div className="master-stat">
            <span className="master-stat-value">{stats.noDue}</span>
            <span className="master-stat-label">Tanpa deadline</span>
          </div>
        </div>

        <div className="master-toolbar">
          <div className="master-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7"/>
              <line x1="21" y1="21" x2="16.5" y2="16.5"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari judul, deskripsi, board, atau list…"
            />
            {search && <button className="master-search-clear" onClick={() => setSearch('')}>✕</button>}
          </div>

          <SelectMenu
            ariaLabel="Filter board"
            value={boardFilter}
            options={boardOptions}
            onChange={changeBoard}
          />
          <SelectMenu
            ariaLabel="Filter list"
            value={listFilter}
            options={listOptions}
            onChange={setListFilter}
          />
          <SelectMenu
            ariaLabel="Filter prioritas"
            value={priorityFilter}
            options={priorityOptions}
            onChange={setPriorityFilter}
          />
          <SelectMenu
            ariaLabel="Filter deadline"
            value={dueFilter}
            options={dueOptions}
            onChange={v => setDueFilter(v as 'all' | DueStatus)}
          />

          {filtersActive && (
            <button className="master-reset" onClick={resetFilters}>Reset filter</button>
          )}
        </div>

        {moveError && (
          <div className="master-alert" role="alert">
            {moveError}
            <button className="master-alert-close" onClick={() => setMoveError(null)} aria-label="Tutup">✕</button>
          </div>
        )}

        {loading ? (
          <div className="master-empty">Memuat…</div>
        ) : error ? (
          <div className="master-empty">{error}</div>
        ) : cards.length === 0 ? (
          <div className="master-empty">
            Belum ada item kanban. Buat card dulu di salah satu board.
          </div>
        ) : filtered.length === 0 ? (
          <div className="master-empty">
            Tidak ada item yang cocok dengan filter.
            <button className="master-reset" onClick={resetFilters}>Reset filter</button>
          </div>
        ) : (
          <div className="master-table-wrap">
            <table className="master-table">
              <thead>
                <tr>
                  {COLUMNS.map(col => {
                    const active = sortBy === col.key;
                    // Tooltip menjelaskan hasil klik berikutnya, bukan keadaan sekarang.
                    const nextDir: SortDir = active && sortDir === 'asc' ? 'desc' : 'asc';
                    const hint = DIR_HINT[col.key][nextDir === 'asc' ? 0 : 1];
                    return (
                      <th
                        key={col.key}
                        className={`master-th-sort${col.className ? ` ${col.className}` : ''}${active ? ' is-active' : ''}`}
                        onClick={() => toggleSort(col.key)}
                        title={`Urutkan: ${hint}`}
                        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                      >
                        {col.label}
                        <span className="master-sort-arrow">
                          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.map(card => {
                  const due = dueInfo(card.due_date);
                  const done = card.checklist_total > 0 && card.checklist_checked === card.checklist_total;
                  const boardColumns = columnsByBoard.get(card.board_id) ?? [];
                  return (
                    <tr
                      key={card.id}
                      className={movingId === card.id ? 'is-moving' : undefined}
                      onClick={() => navigate(`/board/${card.board_id}`)}
                      title={`Buka board ${card.board_title}`}
                    >
                      <td className="master-td-task">
                        <span
                          className="master-label-dot"
                          style={{ background: card.label_color || 'transparent' }}
                        />
                        <div className="master-task-text">
                          <span className="master-task-title">{card.title}</span>
                          {card.description && (
                            <span className="master-task-desc">{card.description}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="master-board-pill">
                          <span className="master-board-swatch" style={{ background: card.board_color }} />
                          {card.board_title}
                        </span>
                      </td>
                      {/* stopPropagation: klik dropdown tidak boleh ikut membuka board. */}
                      <td onClick={e => e.stopPropagation()}>
                        {boardColumns.length > 0 ? (
                          <SelectMenu
                            variant="inline"
                            ariaLabel={`Pindahkan "${card.title}" ke list lain`}
                            value={String(card.column_id)}
                            options={boardColumns.map(c => ({ value: String(c.id), label: c.title }))}
                            onChange={v => moveCard(card, Number(v))}
                            disabled={movingId === card.id}
                          />
                        ) : (
                          <span className="master-list-pill">{card.column_title}</span>
                        )}
                      </td>
                      <td>
                        {card.priority
                          ? <span className={`badge badge-priority-${card.priority}`}>● {PRIORITY_LABEL[card.priority]}</span>
                          : <span className="master-muted">—</span>}
                      </td>
                      <td>
                        {card.due_date
                          ? <span className={`badge badge-due badge-due-${due.status}`}>{due.label}</span>
                          : <span className="master-muted">—</span>}
                      </td>
                      <td>
                        {card.checklist_total > 0
                          ? <span className={`badge badge-checklist${done ? ' badge-done' : ''}`}>
                              {card.checklist_checked}/{card.checklist_total}
                            </span>
                          : <span className="master-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
