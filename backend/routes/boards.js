const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// List yang otomatis dibuat untuk setiap board baru. Warnanya bisa diganti
// lewat menu "···" di tiap list.
const DEFAULT_COLUMNS = [
  { title: 'To Do',       color: '#838c91' }, // abu-abu
  { title: 'On Progress', color: '#f2d600' }, // kuning
  { title: 'Done',        color: '#61bd4f' }, // hijau
];

router.get('/', (req, res) => {
  const db = getDb();
  const boards = db.prepare('SELECT * FROM boards WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  for (const board of boards) {
    const cols = db.prepare('SELECT id, title, color FROM columns WHERE board_id = ? ORDER BY position').all(board.id);
    board.column_counts = cols.map(col => ({
      id: col.id,
      title: col.title,
      color: col.color,
      card_count: db.prepare('SELECT COUNT(*) as n FROM cards WHERE column_id = ?').get(col.id).n,
    }));
  }
  res.json(boards);
});

router.post('/', (req, res) => {
  const { title, description, color, wallpaper_url } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const db = getDb();
  // Board baru langsung punya 3 list default. Dibuat dalam satu transaksi
  // supaya tidak pernah ada board setengah jadi kalau salah satu insert gagal.
  const createBoard = db.transaction(() => {
    const result = db.prepare('INSERT INTO boards (title, description, color, wallpaper_url, user_id) VALUES (?, ?, ?, ?, ?)').run(title, description || null, color || '#0079bf', wallpaper_url || null, req.user.id);
    const boardId = result.lastInsertRowid;
    const insertCol = db.prepare('INSERT INTO columns (title, board_id, position, color) VALUES (?, ?, ?, ?)');
    DEFAULT_COLUMNS.forEach((col, i) => insertCol.run(col.title, boardId, i, col.color));
    return boardId;
  });
  const boardId = createBoard();

  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId);
  // Sertakan column_counts supaya kartu board di My Boards langsung menampilkan list-nya.
  board.column_counts = db.prepare('SELECT id, title, color FROM columns WHERE board_id = ? ORDER BY position')
    .all(boardId)
    .map(col => ({ ...col, card_count: 0 }));
  res.status(201).json(board);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const columns = db.prepare('SELECT * FROM columns WHERE board_id = ? ORDER BY position').all(board.id);
  for (const col of columns) {
    col.cards = db.prepare('SELECT * FROM cards WHERE column_id = ? ORDER BY position').all(col.id);
    for (const card of col.cards) {
      card.checklist_items = db.prepare('SELECT * FROM checklist_items WHERE card_id = ? ORDER BY position').all(card.id);
    }
  }

  res.json({ ...board, columns });
});

router.put('/:id', (req, res) => {
  const { title, description, color, wallpaper_url, archived } = req.body;
  if (archived !== undefined && typeof archived !== 'boolean') {
    return res.status(400).json({ error: 'archived must be true or false' });
  }
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  // archived: true → catat waktunya (kalau sudah terarsip, waktunya tidak diubah); false → aktif lagi.
  let archivedAt = board.archived_at;
  if (archived === true && !board.archived_at) archivedAt = new Date().toISOString();
  if (archived === false) archivedAt = null;

  db.prepare('UPDATE boards SET title = ?, description = ?, color = ?, wallpaper_url = ?, archived_at = ? WHERE id = ?').run(
    title ?? board.title,
    description !== undefined ? description : board.description,
    color ?? board.color,
    wallpaper_url !== undefined ? (wallpaper_url || null) : board.wallpaper_url,
    archivedAt,
    board.id
  );
  res.json(db.prepare('SELECT * FROM boards WHERE id = ?').get(board.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  db.prepare('DELETE FROM boards WHERE id = ?').run(board.id);
  res.json({ message: 'Board deleted' });
});

module.exports = router;
