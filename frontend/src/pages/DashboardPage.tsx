import { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import api from '../api';
import { Board } from '../types';
import WallpaperPicker from '../components/WallpaperPicker';
import { LayoutContext } from '../components/AppLayout';
import { useDialog } from '../contexts/DialogContext';

type ModalState = { mode: 'create' } | { mode: 'edit'; board: Board };

function boardBgStyle(board: Board): React.CSSProperties {
  if (board.wallpaper_url) {
    if (board.wallpaper_url.includes('gradient')) return { background: board.wallpaper_url };
    return { backgroundImage: `url(${board.wallpaper_url})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background: board.color };
}

type Tab = 'active' | 'archived';

export default function DashboardPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [tab, setTab] = useState<Tab>('active');
  const [modal, setModal] = useState<ModalState | null>(null);
  const [modalClosing, setModalClosing] = useState(false);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formColor, setFormColor] = useState('#0079bf');
  const [formWallpaper, setFormWallpaper] = useState('');
  const [loading, setLoading] = useState(false);

  const { onMenuClick } = useOutletContext<LayoutContext>();
  const { confirm } = useDialog();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/boards').then((r) => setBoards(r.data)).catch(console.error);
  }, []);

  const openCreate = () => {
    setFormTitle(''); setFormDesc(''); setFormColor('#0079bf'); setFormWallpaper('');
    setModal({ mode: 'create' });
  };

  const openEdit = (board: Board, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormTitle(board.title);
    setFormDesc(board.description || '');
    setFormColor(board.color);
    setFormWallpaper(board.wallpaper_url || '');
    setModal({ mode: 'edit', board });
  };

  const closeModal = () => {
    setModalClosing(true);
    setTimeout(() => { setModal(null); setModalClosing(false); }, 180);
  };

  const submitModal = async () => {
    if (!formTitle.trim()) return;
    setLoading(true);
    try {
      const payload = { title: formTitle, description: formDesc, color: formColor, wallpaper_url: formWallpaper || null };
      if (modal?.mode === 'create') {
        const { data } = await api.post('/boards', payload);
        setBoards(prev => [data, ...prev]);
      } else if (modal?.mode === 'edit') {
        const { data } = await api.put(`/boards/${modal.board.id}`, payload);
        // PUT tidak mengembalikan column_counts, jadi gabungkan dengan data lama.
        setBoards(prev => prev.map(b => b.id === data.id ? { ...b, ...data } : b));
      }
      closeModal();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const deleteBoard = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await confirm('Board ini akan dihapus beserta semua list dan card-nya.', {
      title: 'Hapus Board?', confirmLabel: 'Hapus', variant: 'danger',
    });
    if (!ok) return;
    await api.delete(`/boards/${id}`);
    setBoards(prev => prev.filter(b => b.id !== id));
  };

  const setArchived = async (board: Board, archived: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { data } = await api.put(`/boards/${board.id}`, { archived });
      setBoards(prev => prev.map(b => b.id === data.id ? { ...b, ...data } : b));
    } catch (err) { console.error(err); }
  };

  const activeBoards = boards.filter(b => !b.archived_at);
  // Arsip: yang terakhir diarsipkan tampil paling atas.
  const archivedBoards = boards
    .filter(b => b.archived_at)
    .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''));
  const shownBoards = tab === 'active' ? activeBoards : archivedBoards;

  return (
    <div className="dashboard">
      <header className="page-header">
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <h1 className="page-header-title">My Boards</h1>
        <button className="btn-primary btn-sm" onClick={openCreate}>+ New Board</button>
      </header>

      <main className="dashboard-main">
        <div className="board-tabs" role="tablist" aria-label="Filter board">
          <button
            role="tab"
            aria-selected={tab === 'active'}
            className={`board-tab${tab === 'active' ? ' active' : ''}`}
            onClick={() => setTab('active')}
          >
            Aktif <span className="board-tab-n">{activeBoards.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'archived'}
            className={`board-tab${tab === 'archived' ? ' active' : ''}`}
            onClick={() => setTab('archived')}
          >
            Archive <span className="board-tab-n">{archivedBoards.length}</span>
          </button>
        </div>

        {tab === 'archived' && archivedBoards.length === 0 && (
          <p className="boards-empty">
            Belum ada board yang diarsipkan. Arahkan kursor ke board lalu klik ikon arsip untuk memindahkannya ke sini.
          </p>
        )}

        <div className="boards-grid">
          {shownBoards.map((board) => (
            <div
              key={board.id}
              className={`board-card${board.archived_at ? ' is-archived' : ''}`}
              style={boardBgStyle(board)}
              onClick={() => navigate(`/board/${board.id}`)}
            >
              {/* dark scrim for photos */}
              {board.wallpaper_url && !board.wallpaper_url.includes('gradient') && (
                <div className="board-card-scrim" />
              )}
              <div className="board-card-actions">
                <button className="board-action-btn" title="Edit" onClick={(e) => openEdit(board, e)}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.25.25 0 00.108-.064L11.189 6.25z"/>
                  </svg>
                </button>
                {board.archived_at ? (
                  <button className="board-action-btn" title="Pulihkan ke Aktif" aria-label="Pulihkan ke Aktif" onClick={(e) => setArchived(board, false, e)}>
                    {/* panah keluar dari kotak arsip */}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="5" rx="1"/>
                      <path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9"/>
                      <path d="M12 17v-6M9 14l3-3 3 3"/>
                    </svg>
                  </button>
                ) : (
                  <button className="board-action-btn" title="Arsipkan" aria-label="Arsipkan" onClick={(e) => setArchived(board, true, e)}>
                    {/* kotak arsip */}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="5" rx="1"/>
                      <path d="M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9"/>
                      <path d="M10 13h4"/>
                    </svg>
                  </button>
                )}
                <button className="board-action-btn board-action-delete" title="Delete" onClick={(e) => deleteBoard(board.id, e)}>✕</button>
              </div>
              <div className="board-card-title">{board.title}</div>
              {board.description && <div className="board-card-desc">{board.description}</div>}
              {board.column_counts && board.column_counts.length > 0 && (() => {
                const total = board.column_counts.reduce((s, c) => s + c.card_count, 0);
                return (
                  <>
                    <div className="board-card-total">
                      {total} card{total !== 1 ? 's' : ''} · {board.column_counts.length} list
                    </div>
                    <div className="board-card-counts">
                      {board.column_counts.slice(0, 4).map(col => (
                        <span key={col.id} className="board-col-pill">
                          {col.color && <span className="board-col-pill-dot" style={{ background: col.color }} />}
                          {col.title} <span className="board-col-pill-n">{col.card_count}</span>
                        </span>
                      ))}
                      {board.column_counts.length > 4 && (
                        <span className="board-col-pill board-col-pill-more">
                          +{board.column_counts.length - 4} list
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          ))}

          {tab === 'active' && (
            <div className="board-card board-card-new" onClick={openCreate}>
              <span>+ Create new board</span>
            </div>
          )}
        </div>
      </main>

      {modal && (
        <div className={`modal-overlay${modalClosing ? ' is-closing' : ''}`} onClick={closeModal}>
          <div className={`modal modal-board${modalClosing ? ' is-closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'create' ? 'Create Board' : 'Edit Board'}</h3>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="form-group">
              <label>Board Title *</label>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Enter board title"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && submitModal()}
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="form-group">
              <label>Background</label>
              <WallpaperPicker
                color={formColor}
                wallpaperUrl={formWallpaper}
                onColorChange={setFormColor}
                onWallpaperChange={setFormWallpaper}
                boardTitle={formTitle || 'My Board'}
              />
            </div>

            <div className="modal-footer">
              <button className="btn-primary" onClick={submitModal} disabled={!formTitle.trim() || loading}>
                {loading ? 'Saving…' : modal.mode === 'create' ? 'Create Board' : 'Save Changes'}
              </button>
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
