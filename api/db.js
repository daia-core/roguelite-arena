const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

// Initialize database
const db = new Database(path.join(__dirname, 'game.db'));

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
const initDB = () => {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Saves table
  db.exec(`
    CREATE TABLE IF NOT EXISTS saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      save_data TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index for faster lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_saves_user_id ON saves(user_id)
  `);

  // Create demo user if it doesn't exist
  createDemoUser();
};

// Create demo user
const createDemoUser = () => {
  const checkUser = db.prepare('SELECT id FROM users WHERE username = ?');
  const existing = checkUser.get('demo');

  if (!existing) {
    const passwordHash = bcrypt.hashSync('demo123', 10);
    const insertUser = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    insertUser.run('demo', passwordHash);
    console.log('Demo user created (username: demo, password: demo123)');
  }
};

// User queries
const createUser = (username, password) => {
  const passwordHash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  const result = stmt.run(username, passwordHash);
  return result.lastInsertRowid;
};

const getUserByUsername = (username) => {
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  return stmt.get(username);
};

const getUserById = (id) => {
  const stmt = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?');
  return stmt.get(id);
};

// Save queries
const getSaveByUserId = (userId) => {
  const stmt = db.prepare('SELECT * FROM saves WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
  return stmt.get(userId);
};

const createOrUpdateSave = (userId, saveData) => {
  const existing = getSaveByUserId(userId);

  if (existing) {
    const stmt = db.prepare('UPDATE saves SET save_data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?');
    stmt.run(JSON.stringify(saveData), userId);
    return existing.id;
  } else {
    const stmt = db.prepare('INSERT INTO saves (user_id, save_data) VALUES (?, ?)');
    const result = stmt.run(userId, JSON.stringify(saveData));
    return result.lastInsertRowid;
  }
};

const deleteSaveByUserId = (userId) => {
  const stmt = db.prepare('DELETE FROM saves WHERE user_id = ?');
  const result = stmt.run(userId);
  return result.changes > 0;
};

// Initialize database on module load
initDB();

module.exports = {
  db,
  createUser,
  getUserByUsername,
  getUserById,
  getSaveByUserId,
  createOrUpdateSave,
  deleteSaveByUserId
};
