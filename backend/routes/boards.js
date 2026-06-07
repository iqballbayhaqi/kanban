const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.get('/', (req, res) => {
  const db = getDb();
  const boards = db.prepare('SELECT * FROM boards WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  for (const board of boards) {
    const cols = db.prepare('SELECT id, title FROM columns WHERE board_id = ? ORDER BY position').all(board.id);
    board.column_counts = cols.map(col => ({
      id: col.id,
      title: col.title,
      card_count: db.prepare('SELECT COUNT(*) as n FROM cards WHERE column_id = ?').get(col.id).n,
    }));
  }
  res.json(boards);
});

router.post('/', (req, res) => {
  const { title, description, color, wallpaper_url } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const db = getDb();
  const result = db.prepare('INSERT INTO boards (title, description, color, wallpaper_url, user_id) VALUES (?, ?, ?, ?, ?)').run(title, description || null, color || '#0079bf', wallpaper_url || null, req.user.id);
  const board = db.prepare('SELECT * FROM boards WHERE id = ?').get(result.lastInsertRowid);
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
  const { title, description, color, wallpaper_url } = req.body;
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  db.prepare('UPDATE boards SET title = ?, description = ?, color = ?, wallpaper_url = ? WHERE id = ?').run(
    title ?? board.title,
    description !== undefined ? description : board.description,
    color ?? board.color,
    wallpaper_url !== undefined ? (wallpaper_url || null) : board.wallpaper_url,
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
