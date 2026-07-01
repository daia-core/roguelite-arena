const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'roguelite-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const db = new Database('./game.db');
console.log('Connected to SQLite database');

function initDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      username TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Save states table
  db.exec(`
    CREATE TABLE IF NOT EXISTS save_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      wave INTEGER NOT NULL,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      gold INTEGER DEFAULT 0,
      health REAL DEFAULT 100,
      items TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Meta stats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      highest_wave INTEGER DEFAULT 0,
      total_runs INTEGER DEFAULT 0,
      total_kills INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  console.log('Database tables initialized');
}

initDatabase();

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Roguelite API is running' });
});

// Register
app.post('/api/register', async (req, res) => {
  const { email, password, username } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Email, password, and username are required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const stmt = db.prepare('INSERT INTO users (email, password, username) VALUES (?, ?, ?)');
    const result = stmt.run(email, hashedPassword, username);
    const userId = result.lastInsertRowid;

    // Create initial meta stats
    const metaStmt = db.prepare('INSERT INTO meta_stats (user_id) VALUES (?)');
    metaStmt.run(userId);

    const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: userId, email, username }
    });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user = stmt.get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, username: user.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
app.get('/api/user', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, email, username, created_at FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Save game state
app.post('/api/save', authenticateToken, (req, res) => {
  const { wave, xp, level, gold, health, items } = req.body;
  const userId = req.user.id;

  try {
    const itemsJson = JSON.stringify(items || []);

    // Delete existing save for this user
    const deleteStmt = db.prepare('DELETE FROM save_states WHERE user_id = ?');
    deleteStmt.run(userId);

    // Insert new save
    const insertStmt = db.prepare(
      `INSERT INTO save_states (user_id, wave, xp, level, gold, health, items, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    );
    const result = insertStmt.run(userId, wave, xp || 0, level || 1, gold || 0, health || 100, itemsJson);

    res.json({ message: 'Game saved successfully', saveId: result.lastInsertRowid });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Failed to save game state' });
  }
});

// Load game state
app.get('/api/save', authenticateToken, (req, res) => {
  const userId = req.user.id;

  try {
    const stmt = db.prepare('SELECT * FROM save_states WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1');
    const save = stmt.get(userId);

    if (!save) {
      return res.json({ save: null });
    }

    res.json({
      save: {
        wave: save.wave,
        xp: save.xp,
        level: save.level,
        gold: save.gold,
        health: save.health,
        items: JSON.parse(save.items || '[]'),
        updated_at: save.updated_at
      }
    });
  } catch (error) {
    console.error('Load save error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Delete save
app.delete('/api/save', authenticateToken, (req, res) => {
  const userId = req.user.id;

  try {
    const stmt = db.prepare('DELETE FROM save_states WHERE user_id = ?');
    stmt.run(userId);

    res.json({ message: 'Save deleted successfully' });
  } catch (error) {
    console.error('Delete save error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get meta stats
app.get('/api/stats', authenticateToken, (req, res) => {
  const userId = req.user.id;

  try {
    const stmt = db.prepare('SELECT * FROM meta_stats WHERE user_id = ?');
    let stats = stmt.get(userId);

    if (!stats) {
      // Create if doesn't exist
      const insertStmt = db.prepare('INSERT INTO meta_stats (user_id) VALUES (?)');
      insertStmt.run(userId);

      stats = {
        highest_wave: 0,
        total_runs: 0,
        total_kills: 0
      };
    }

    res.json({
      stats: {
        highest_wave: stats.highest_wave,
        total_runs: stats.total_runs,
        total_kills: stats.total_kills
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update meta stats
app.post('/api/stats', authenticateToken, (req, res) => {
  const { wave, kills } = req.body;
  const userId = req.user.id;

  try {
    const getStmt = db.prepare('SELECT * FROM meta_stats WHERE user_id = ?');
    const stats = getStmt.get(userId);

    const newHighestWave = Math.max(stats?.highest_wave || 0, wave || 0);
    const newTotalRuns = (stats?.total_runs || 0) + 1;
    const newTotalKills = (stats?.total_kills || 0) + (kills || 0);

    // Delete existing
    const deleteStmt = db.prepare('DELETE FROM meta_stats WHERE user_id = ?');
    deleteStmt.run(userId);

    // Insert updated
    const insertStmt = db.prepare(
      `INSERT INTO meta_stats (user_id, highest_wave, total_runs, total_kills, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`
    );
    insertStmt.run(userId, newHighestWave, newTotalRuns, newTotalKills);

    res.json({
      message: 'Stats updated successfully',
      stats: {
        highest_wave: newHighestWave,
        total_runs: newTotalRuns,
        total_kills: newTotalKills
      }
    });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  console.log('Database connection closed');
  process.exit(0);
});
