const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

const getUserCard = (db, cardId, userId) =>
  db.prepare(`
    SELECT ca.* FROM cards ca
    JOIN columns col ON ca.column_id = col.id
    JOIN boards b ON col.board_id = b.id
    WHERE ca.id = ? AND b.user_id = ?
  `).get(cardId, userId);

// Semua card milik user lintas board — dipakai halaman Master Kanban.
router.get('/all', (req, res) => {
  const db = getDb();

  const cards = db.prepare(`
    SELECT
      ca.id, ca.title, ca.description, ca.column_id, ca.position,
      ca.label_color, ca.due_date, ca.priority, ca.created_at,
      col.title AS column_title, col.position AS column_position,
      b.id AS board_id, b.title AS board_title, b.color AS board_color
    FROM cards ca
    JOIN columns col ON ca.column_id = col.id
    JOIN boards b ON col.board_id = b.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC, col.position, ca.position
  `).all(req.user.id);

  // Hitung checklist sekali jalan supaya tidak query per card.
  const counts = db.prepare(`
    SELECT ci.card_id, COUNT(*) AS total, SUM(ci.is_checked) AS checked
    FROM checklist_items ci
    JOIN cards ca ON ci.card_id = ca.id
    JOIN columns col ON ca.column_id = col.id
    JOIN boards b ON col.board_id = b.id
    WHERE b.user_id = ?
    GROUP BY ci.card_id
  `).all(req.user.id);

  const byCard = new Map(counts.map(c => [c.card_id, c]));
  for (const card of cards) {
    const c = byCard.get(card.id);
    card.checklist_total = c ? c.total : 0;
    card.checklist_checked = c ? Number(c.checked) : 0;
  }

  res.json(cards);
});

router.post('/', (req, res) => {
  const { title, description, column_id, label_color, due_date, priority } = req.body;
  if (!title || !column_id) return res.status(400).json({ error: 'Title and column_id required' });

  const db = getDb();
  const col = db.prepare(`
    SELECT col.* FROM columns col JOIN boards b ON col.board_id = b.id
    WHERE col.id = ? AND b.user_id = ?
  `).get(column_id, req.user.id);
  if (!col) return res.status(404).json({ error: 'Column not found' });

  const { maxPos } = db.prepare('SELECT MAX(position) as maxPos FROM cards WHERE column_id = ?').get(column_id);
  const position = (maxPos !== null ? maxPos : -1) + 1;

  const result = db.prepare('INSERT INTO cards (title, description, column_id, position, label_color, due_date, priority) VALUES (?, ?, ?, ?, ?, ?, ?)').run(title, description || null, column_id, position, label_color || null, due_date || null, priority || null);
  const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(result.lastInsertRowid);
  card.checklist_items = [];
  res.status(201).json(card);
});

router.put('/:id', (req, res) => {
  const { title, description, label_color, due_date, priority } = req.body;
  const db = getDb();
  const card = getUserCard(db, req.params.id, req.user.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  db.prepare('UPDATE cards SET title = ?, description = ?, label_color = ?, due_date = ?, priority = ? WHERE id = ?').run(
    title !== undefined ? title : card.title,
    description !== undefined ? description : card.description,
    label_color !== undefined ? label_color : card.label_color,
    due_date !== undefined ? due_date : card.due_date,
    priority !== undefined ? priority : card.priority,
    card.id
  );
  const updated = db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id);
  updated.checklist_items = db.prepare('SELECT * FROM checklist_items WHERE card_id = ? ORDER BY position').all(card.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const card = getUserCard(db, req.params.id, req.user.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });
  db.prepare('DELETE FROM cards WHERE id = ?').run(card.id);
  res.json({ message: 'Card deleted' });
});

router.put('/:id/move', (req, res) => {
  const { column_id, position } = req.body;
  const db = getDb();
  const card = getUserCard(db, req.params.id, req.user.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const targetColId = column_id !== undefined ? column_id : card.column_id;

  // Column tujuan wajib milik user yang sama — tanpa cek ini card bisa
  // dilempar ke board orang lain hanya dengan menebak column_id.
  if (targetColId !== card.column_id) {
    const target = db.prepare(`
      SELECT col.id FROM columns col
      JOIN boards b ON col.board_id = b.id
      WHERE col.id = ? AND b.user_id = ?
    `).get(targetColId, req.user.id);
    if (!target) return res.status(404).json({ error: 'Target column not found' });
  }

  db.transaction(() => {
    db.prepare('UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?').run(card.column_id, card.position);
    db.prepare('UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?').run(targetColId, position);
    db.prepare('UPDATE cards SET column_id = ?, position = ? WHERE id = ?').run(targetColId, position, card.id);
  })();

  res.json(db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id));
});

module.exports = router;
