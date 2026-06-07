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

  db.transaction(() => {
    db.prepare('UPDATE cards SET position = position - 1 WHERE column_id = ? AND position > ?').run(card.column_id, card.position);
    db.prepare('UPDATE cards SET position = position + 1 WHERE column_id = ? AND position >= ?').run(targetColId, position);
    db.prepare('UPDATE cards SET column_id = ?, position = ? WHERE id = ?').run(targetColId, position, card.id);
  })();

  res.json(db.prepare('SELECT * FROM cards WHERE id = ?').get(card.id));
});

module.exports = router;
