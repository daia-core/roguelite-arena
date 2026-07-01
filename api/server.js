require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const {
  createUser,
  getUserByUsername,
  getUserById,
  getSaveByUserId,
  createOrUpdateSave,
  deleteSaveByUserId
} = require('./db');
const { generateToken, authenticateToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger save files

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Validation helpers
const validateUsername = (username) => {
  if (!username || typeof username !== 'string') {
    return 'Username is required';
  }
  if (username.length < 3 || username.length > 30) {
    return 'Username must be between 3 and 30 characters';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Username can only contain letters, numbers, underscores, and hyphens';
  }
  return null;
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return 'Password is required';
  }
  if (password.length < 6) {
    return 'Password must be at least 6 characters';
  }
  return null;
};

// AUTH ENDPOINTS

// POST /api/register
app.post('/api/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    const usernameError = validateUsername(username);
    if (usernameError) {
      return res.status(400).json({ error: usernameError });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    // Check if user already exists
    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Create user
    const userId = createUser(username, password);

    // Generate token
    const token = generateToken(userId);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        username
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Get user
    const user = getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate token
    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/me
app.get('/api/me', authenticateToken, (req, res) => {
  try {
    const user = getUserById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// SAVE STATE ENDPOINTS

// GET /api/saves
app.get('/api/saves', authenticateToken, (req, res) => {
  try {
    const save = getSaveByUserId(req.userId);

    if (!save) {
      return res.json({ save: null });
    }

    res.json({
      save: {
        id: save.id,
        data: JSON.parse(save.save_data),
        updated_at: save.updated_at
      }
    });
  } catch (error) {
    console.error('Get save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/saves
app.post('/api/saves', authenticateToken, (req, res) => {
  try {
    const { saveData } = req.body;

    // Validate save data
    if (!saveData || typeof saveData !== 'object') {
      return res.status(400).json({ error: 'Invalid save data format' });
    }

    // Validate save data size (prevent abuse)
    const saveDataString = JSON.stringify(saveData);
    if (saveDataString.length > 5 * 1024 * 1024) { // 5MB limit
      return res.status(413).json({ error: 'Save data too large (max 5MB)' });
    }

    // Create or update save
    const saveId = createOrUpdateSave(req.userId, saveData);

    res.json({
      message: 'Save successful',
      save: {
        id: saveId,
        updated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/saves
app.delete('/api/saves', authenticateToken, (req, res) => {
  try {
    const deleted = deleteSaveByUserId(req.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'No save found to delete' });
    }

    res.json({ message: 'Save deleted successfully' });
  } catch (error) {
    console.error('Delete save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
