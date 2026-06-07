const express = require('express');
const { getDb } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcStreak(db, habitId) {
  const logs = db.prepare('SELECT date FROM habit_logs WHERE habit_id = ? ORDER BY date DESC').all(habitId);
  if (!logs.length) return 0;
  const logSet = new Set(logs.map(l => l.date));
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (true) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (logSet.has(iso)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function calcBestStreak(db, habitId) {
  const logs = db.prepare('SELECT date FROM habit_logs WHERE habit_id = ? ORDER BY date ASC').all(habitId);
  if (!logs.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < logs.length; i++) {
    const diff = (new Date(logs[i].date) - new Date(logs[i - 1].date)) / 86400000;
    if (diff === 1) { cur++; if (cur > best) best = cur; }
    else cur = 1;
  }
  return best;
}

function calcMissStreak(db, habitId, createdAt) {
  // Count consecutive days (ending yesterday) where habit was NOT done
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 1); // start from yesterday

  const created = new Date(createdAt);
  created.setHours(0, 0, 0, 0);

  let miss = 0;
  while (d >= created) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (db.prepare('SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ?').get(habitId, iso)) break;
    miss++;
    d.setDate(d.getDate() - 1);
  }
  return miss;
}

function withMeta(db, habit) {
  const today = todayISO();
  return {
    ...habit,
    done: !!db.prepare('SELECT 1 FROM habit_logs WHERE habit_id = ? AND date = ?').get(habit.id, today),
    streak: calcStreak(db, habit.id),
    miss_streak: calcMissStreak(db, habit.id, habit.created_at),
  };
}

// GET /habits
router.get('/', (req, res) => {
  const db = getDb();
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? ORDER BY position').all(req.user.id);
  res.json(habits.map(h => withMeta(db, h)));
});

// POST /habits
router.post('/', (req, res) => {
  const { title, color } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const db = getDb();
  const { maxPos } = db.prepare('SELECT MAX(position) as maxPos FROM habits WHERE user_id = ?').get(req.user.id);
  const position = (maxPos !== null ? maxPos : -1) + 1;
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO habits (user_id, title, color, position) VALUES (?, ?, ?, ?)'
  ).run(req.user.id, title, color || '#0079bf', position);
  const habit = db.prepare('SELECT * FROM habits WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ ...habit, done: false, streak: 0 });
});

// PUT /habits/:id
router.put('/:id', (req, res) => {
  const { title, color } = req.body;
  const db = getDb();
  const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!habit) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE habits SET title = ?, color = ? WHERE id = ?').run(
    title ?? habit.title, color ?? habit.color, habit.id
  );
  res.json(withMeta(db, db.prepare('SELECT * FROM habits WHERE id = ?').get(habit.id)));
});

// DELETE /habits/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!habit) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM habits WHERE id = ?').run(habit.id);
  res.json({ ok: true });
});

// GET /habits/history?days=30
router.get('/history', (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 30, 7), 365);
  const db = getDb();
  const habits = db.prepare('SELECT * FROM habits WHERE user_id = ? ORDER BY position').all(req.user.id);

  const result = habits.map(habit => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const created = new Date(habit.created_at); created.setHours(0, 0, 0, 0);

    const daysArr = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      daysArr.push({ date: iso, created: d >= created, done: false });
    }

    const oldest = daysArr[0].date;
    const logs = db.prepare('SELECT date FROM habit_logs WHERE habit_id = ? AND date >= ?').all(habit.id, oldest);
    const logSet = new Set(logs.map(l => l.date));
    daysArr.forEach(d => { d.done = logSet.has(d.date); });

    const totalDone = db.prepare('SELECT COUNT(*) as n FROM habit_logs WHERE habit_id = ?').get(habit.id).n;
    const bestStreak = calcBestStreak(db, habit.id);
    const currentStreak = calcStreak(db, habit.id);
    const relevant = daysArr.filter(d => d.created);
    const donePeriod = relevant.filter(d => d.done).length;
    const completionRate = relevant.length > 0 ? Math.round((donePeriod / relevant.length) * 100) : 0;

    return {
      ...withMeta(db, habit),
      days: daysArr,
      stats: {
        current_streak: currentStreak,
        best_streak: bestStreak,
        total_done: totalDone,
        completion_rate: completionRate,
        done_in_period: donePeriod,
        period_days: relevant.length,
      },
    };
  });

  res.json(result);
});

// POST /habits/:id/toggle — mark/unmark today as done
router.post('/:id/toggle', (req, res) => {
  const db = getDb();
  const habit = db.prepare('SELECT * FROM habits WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!habit) return res.status(404).json({ error: 'Not found' });
  const today = todayISO();
  const existing = db.prepare('SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?').get(habit.id, today);
  if (existing) {
    db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?').run(habit.id, today);
  } else {
    db.prepare('INSERT OR IGNORE INTO habit_logs (habit_id, date) VALUES (?, ?)').run(habit.id, today);
  }
  res.json(withMeta(db, habit));
});

module.exports = router;
