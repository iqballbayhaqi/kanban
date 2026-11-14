const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// undefined = field tidak dikirim; null/'' = hapus warna; selain itu harus hex #rrggbb.
// Mengembalikan { value } kalau valid, atau { error } kalau tidak.
function parseColor(color) {
  if (color === undefined) return { value: undefined };
  if (color === null || color === '') return { value: null };
  if (typeof color === 'string' && HEX_COLOR.test(color)) return { value: color.toLowerCase() };
  return { error: 'Color must be a hex value like #61bd4f' };
}

// Semua list milik user lintas board — dipakai halaman Master Kanban untuk
// memindahkan card antar list tanpa harus membuka board-nya dulu.
router.get('/all', (req, res) => {
  const db = getDb();
  const columns = db.prepare(`
    SELECT col.id, col.title, col.position, col.board_id, col.color
    FROM columns col
    JOIN boards b ON col.board_id = b.id
    WHERE b.user_id = ?
    ORDER BY col.board_id, col.position
  `).all(req.user.id);

  res.json(columns);
});

router.post('/', (req, res) => {
  const { title, board_id } = req.body;
  if (!title || !board_id) return res.status(400).json({ error: 'Title and board_id required' });
  const color = parseColor(req.body.color);
  if (color.error) return res.status(400).json({ error: color.error });

  const db = getDb();
  const board = db.prepare('SELECT * FROM boards WHERE id = ? AND user_id = ?').get(board_id, req.user.id);
  if (!board) return res.status(404).json({ error: 'Board not found' });

  const { maxPos } = db.prepare('SELECT MAX(position) as maxPos FROM columns WHERE board_id = ?').get(board_id);
  const position = (maxPos !== null ? maxPos : -1) + 1;

  const result = db.prepare('INSERT INTO columns (title, board_id, position, color) VALUES (?, ?, ?, ?)').run(title, board_id, position, color.value ?? null);
  const column = db.prepare('SELECT * FROM columns WHERE id = ?').get(result.lastInsertRowid);
  column.cards = [];
  res.status(201).json(column);
});

router.put('/:id', (req, res) => {
  const { title } = req.body;
  const color = parseColor(req.body.color);
  if (color.error) return res.status(400).json({ error: color.error });
  const db = getDb();
  const col = db.prepare(`
    SELECT c.* FROM columns c JOIN boards b ON c.board_id = b.id
    WHERE c.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!col) return res.status(404).json({ error: 'Column not found' });

  db.prepare('UPDATE columns SET title = ?, color = ? WHERE id = ?').run(
    title || col.title,
    color.value !== undefined ? color.value : col.color,
    col.id
  );
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
