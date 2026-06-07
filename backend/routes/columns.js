const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

router.post('/', (req, res) => {
  const { title, board_id } = req.body;
  if (!title || !board_id) return res.status(400).json({ error: 'Title and board_id required' });

  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const { maxPos } = db.prepare('SELECT MAX(position) as maxPos FROM columns WHERE board_id = ?').get(board_id);
  const position = (maxPos !== null ? maxPos : -1) + 1;

  const result = db.prepare('INSERT INTO columns (title, board_id, position) VALUES (?, ?, ?)').run(title, board_id, position);
  const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(result.lastInsertRowid);
  column.cards = [];
  res.status(201).json(column);
});

router.put('/:id', (req, res) => {
  const { title } = req.body;
  const db = getDb();
  const col = db.prepare(`
    SELECT c.* FROM columns c JOIN boards b ON c.board_id = b.id
    WHERE c.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!col) return res.status(404).json({ error: 'Column not found' });

  db.prepare('UPDATE columns SET title = ? WHERE id = ?').run(title ?? col.title, col.id);
  res.json(db.prepare('SELECT * FROM columns WHERE id = ?').get(col.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const col = db.prepare(`
    SELECT c.* FROM columns c JOIN boards b ON c.board_id = b.id
    WHERE c.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!col) return res.status(404).json({ error: 'Column not found' });

  db.prepare('DELETE FROM columns WHERE id = ?').run(col.id);
  res.json({ message: 'Column deleted' });
});

router.put('/reorder/:boardId', (req, res) => {
  const { columnIds } = req.body;
  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(req.params.boardId, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const stmt = db.prepare('UPDATE columns SET position = ? WHERE id = ?');
  db.transaction(() => columnIds.forEach((id, i) => stmt.run(i, id)))();
  res.json({ message: 'Reordered' });
});

module.exports = router;
