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

// Add item
router.post('/cards/:cardId/checklist', (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' });

  const db = getDb();
  const card = getUserCard(db, req.params.cardId, req.user.id);
  if (!card) return res.status(404).json({ error: 'Card not found' });

  const { maxPos } = db.prepare('SELECT MAX(position) as maxPos FROM checklist_items WHERE card_id = ?').get(card.id);
  const position = (maxPos !== null ? maxPos : -1) + 1;

  const result = db.prepare('INSERT INTO checklist_items (card_id, title, position) VALUES (?, ?, ?)').run(card.id, title.trim(), position);
  res.status(201).json(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(result.lastInsertRowid));
});

// Update item (toggle or rename)
router.put('/checklist/:id', (req, res) => {
  const { title, is_checked } = req.body;
  const db = getDb();

  const item = db.prepare(`
    SELECT ci.* FROM checklist_items ci
    JOIN cards ca ON ci.card_id = ca.id
    JOIN columns col ON ca.column_id = col.id
    JOIN boards b ON col.board_id = b.id
    WHERE ci.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!item) return res.status(404).json({ error: 'Item not found' });

  db.prepare('UPDATE checklist_items SET title = ?, is_checked = ? WHERE id = ?').run(
    title !== undefined ? title : item.title,
    is_checked !== undefined ? (is_checked ? 1 : 0) : item.is_checked,
    item.id
  );
  res.json(db.prepare('SELECT * FROM checklist_items WHERE id = ?').get(item.id));
});

// Delete item
router.delete('/checklist/:id', (req, res) => {
  const db = getDb();

  const item = db.prepare(`
    SELECT ci.* FROM checklist_items ci
    JOIN cards ca ON ci.card_id = ca.id
    JOIN columns col ON ca.column_id = col.id
    JOIN boards b ON col.board_id = b.id
    WHERE ci.id = ? AND b.user_id = ?
  `).get(req.params.id, req.user.id);

  if (!item) return res.status(404).json({ error: 'Item not found' });
  db.prepare('DELETE FROM checklist_items WHERE id = ?').run(item.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
