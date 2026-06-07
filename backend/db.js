const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

let db;

function getDb() {
  if (!db) {
    db = new Database(path.join(__dirname, 'kanban.db'));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS boards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#0079bf',
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS columns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      board_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      column_id INTEGER NOT NULL,
      position INTEGER NOT NULL DEFAULT 0,
      label_color TEXT,
      due_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      is_checked INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#0079bf',
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      habit_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
      UNIQUE(habit_id, date)
    );
  `);

  // Migrations for older DBs
  try { db.exec('ALTER TABLE cards ADD COLUMN due_date TEXT'); } catch { }
  try { db.exec('ALTER TABLE boards ADD COLUMN wallpaper_url TEXT'); } catch { }
  try { db.exec('ALTER TABLE cards ADD COLUMN priority TEXT'); } catch { }

  const seedEmail = process.env.SEED_EMAIL || 'baihaqiiqbal323@gmail.com';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(seedEmail);
  if (!existing) {
    const hashed = bcrypt.hashSync(process.env.SEED_PASSWORD || 'changeme123', 10);
    const userId = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(seedEmail, hashed, process.env.SEED_NAME || 'Admin').lastInsertRowid;

    const b1 = db.prepare('INSERT INTO boards (title, description, color, user_id) VALUES (?, ?, ?, ?)').run('Project Alpha', 'Main development board', '#0079bf', userId).lastInsertRowid;
    const b2 = db.prepare('INSERT INTO boards (title, description, color, user_id) VALUES (?, ?, ?, ?)').run('Personal Tasks', 'Personal to-do list', '#d29034', userId).lastInsertRowid;

    const c1 = db.prepare('INSERT INTO columns (title, board_id, position) VALUES (?, ?, ?)').run('To Do', b1, 0).lastInsertRowid;
    const c2 = db.prepare('INSERT INTO columns (title, board_id, position) VALUES (?, ?, ?)').run('In Progress', b1, 1).lastInsertRowid;
    const c3 = db.prepare('INSERT INTO columns (title, board_id, position) VALUES (?, ?, ?)').run('Done', b1, 2).lastInsertRowid;

    db.prepare('INSERT INTO cards (title, description, column_id, position, label_color) VALUES (?, ?, ?, ?, ?)').run('Setup project structure', 'Initialize repo and dependencies', c1, 0, '#61bd4f');
    db.prepare('INSERT INTO cards (title, description, column_id, position, label_color) VALUES (?, ?, ?, ?, ?)').run('Design database schema', 'Create all tables and relationships', c1, 1, '#f2d600');
    db.prepare('INSERT INTO cards (title, description, column_id, position, label_color) VALUES (?, ?, ?, ?, ?)').run('Build REST API', 'Implement all CRUD endpoints', c2, 0, '#ff9f1a');
    db.prepare('INSERT INTO cards (title, description, column_id, position, label_color) VALUES (?, ?, ?, ?, ?)').run('Implement authentication', 'JWT login & register flow', c2, 1, '#c377e0');
    db.prepare('INSERT INTO cards (title, description, column_id, position, label_color) VALUES (?, ?, ?, ?, ?)').run('Project kickoff meeting', 'Initial planning session completed', c3, 0, '#0079bf');

    const d1 = db.prepare('INSERT INTO columns (title, board_id, position) VALUES (?, ?, ?)').run('Backlog', b2, 0).lastInsertRowid;
    const d2 = db.prepare('INSERT INTO columns (title, board_id, position) VALUES (?, ?, ?)').run('Today', b2, 1).lastInsertRowid;
    db.prepare('INSERT INTO cards (title, description, column_id, position, label_color) VALUES (?, ?, ?, ?, ?)').run('Read documentation', null, d1, 0, '#61bd4f');
    db.prepare('INSERT INTO cards (title, description, column_id, position, label_color) VALUES (?, ?, ?, ?, ?)').run('Morning workout', null, d2, 0, '#ff9f1a');

    console.log('Default user and sample data created');
  }
}

module.exports = { getDb, initDb };
