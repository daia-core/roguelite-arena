# Frontend Integration Guide

Quick reference for integrating the Roguelite Game API with your frontend.

## API Base URL

```javascript
// Development
const API_URL = 'http://localhost:3000';

// Production
const API_URL = 'https://api.yourgame.com';
```

## Authentication Flow

### 1. Register New User

```javascript
async function register(username, password) {
  const response = await fetch(`${API_URL}/api/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Registration failed');
  }

  // Store token in localStorage or sessionStorage
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}
```

### 2. Login Existing User

```javascript
async function login(username, password) {
  const response = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Login failed');
  }

  // Store token
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));

  return data;
}
```

### 3. Get Current User Profile

```javascript
async function getCurrentUser() {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/api/me`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    // Token might be expired
    if (response.status === 401 || response.status === 403) {
      logout();
    }
    throw new Error(data.error || 'Failed to get user');
  }

  return data.user;
}
```

### 4. Logout

```javascript
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  // Redirect to login page or home
  window.location.href = '/login';
}
```

## Save State Management

### 1. Load Save State

```javascript
async function loadSave() {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/api/saves`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load save');
  }

  return data.save; // null if no save exists
}
```

### 2. Save Game State

```javascript
async function saveGame(gameState) {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/api/saves`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      saveData: {
        floor: gameState.floor,
        health: gameState.health,
        maxHealth: gameState.maxHealth,
        inventory: gameState.inventory,
        position: gameState.position,
        timestamp: Date.now(),
        // Add any other game state you need to save
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to save game');
  }

  return data;
}
```

### 3. Delete Save (Start New Game)

```javascript
async function deleteSave() {
  const token = localStorage.getItem('token');

  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_URL}/api/saves`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok && response.status !== 404) {
    throw new Error(data.error || 'Failed to delete save');
  }

  return data;
}
```

## Complete Example: Auth Service

```javascript
// authService.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class AuthService {
  constructor() {
    this.token = localStorage.getItem('token');
    this.user = JSON.parse(localStorage.getItem('user') || 'null');
  }

  async register(username, password) {
    const response = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    this.setAuth(data.token, data.user);
    return data;
  }

  async login(username, password) {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    this.setAuth(data.token, data.user);
    return data;
  }

  async getCurrentUser() {
    if (!this.token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/me`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });

    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.logout();
      }
      throw new Error(data.error);
    }

    this.user = data.user;
    return data.user;
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  setAuth(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }

  isAuthenticated() {
    return !!this.token;
  }

  getUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }
}

export default new AuthService();
```

## Complete Example: Game Service

```javascript
// gameService.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class GameService {
  constructor(authService) {
    this.authService = authService;
  }

  async loadSave() {
    const token = this.authService.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/saves`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    return data.save;
  }

  async saveGame(gameState) {
    const token = this.authService.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/saves`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ saveData: gameState }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    return data;
  }

  async deleteSave() {
    const token = this.authService.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/api/saves`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await response.json();
    if (!response.ok && response.status !== 404) {
      throw new Error(data.error);
    }

    return data;
  }
}

export default GameService;
```

## Usage in Components

### React Example

```jsx
import { useState, useEffect } from 'react';
import authService from './services/authService';
import GameService from './services/gameService';

const gameService = new GameService(authService);

function GameComponent() {
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGame();
  }, []);

  async function loadGame() {
    try {
      const save = await gameService.loadSave();

      if (save) {
        // Load existing save
        setGameState(save.data);
      } else {
        // Start new game
        setGameState(createNewGameState());
      }
    } catch (error) {
      console.error('Failed to load game:', error);
      setGameState(createNewGameState());
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveGame() {
    try {
      await gameService.saveGame(gameState);
      console.log('Game saved successfully');
    } catch (error) {
      console.error('Failed to save game:', error);
      alert('Failed to save game');
    }
  }

  async function handleNewGame() {
    if (!confirm('Delete current save and start new game?')) return;

    try {
      await gameService.deleteSave();
      setGameState(createNewGameState());
    } catch (error) {
      console.error('Failed to start new game:', error);
    }
  }

  function createNewGameState() {
    return {
      floor: 1,
      health: 100,
      maxHealth: 100,
      inventory: [],
      position: { x: 0, y: 0 },
    };
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={handleSaveGame}>Save Game</button>
      <button onClick={handleNewGame}>New Game</button>
      {/* Your game UI */}
    </div>
  );
}
```

### Vue Example

```vue
<template>
  <div v-if="!loading">
    <button @click="saveGame">Save Game</button>
    <button @click="newGame">New Game</button>
    <!-- Your game UI -->
  </div>
  <div v-else>Loading...</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import authService from './services/authService';
import GameService from './services/gameService';

const gameService = new GameService(authService);
const gameState = ref(null);
const loading = ref(true);

onMounted(async () => {
  await loadGame();
});

async function loadGame() {
  try {
    const save = await gameService.loadSave();
    gameState.value = save ? save.data : createNewGameState();
  } catch (error) {
    console.error('Failed to load game:', error);
    gameState.value = createNewGameState();
  } finally {
    loading.value = false;
  }
}

async function saveGame() {
  try {
    await gameService.saveGame(gameState.value);
    console.log('Game saved successfully');
  } catch (error) {
    console.error('Failed to save game:', error);
    alert('Failed to save game');
  }
}

async function newGame() {
  if (!confirm('Delete current save and start new game?')) return;

  try {
    await gameService.deleteSave();
    gameState.value = createNewGameState();
  } catch (error) {
    console.error('Failed to start new game:', error);
  }
}

function createNewGameState() {
  return {
    floor: 1,
    health: 100,
    maxHealth: 100,
    inventory: [],
    position: { x: 0, y: 0 },
  };
}
</script>
```

## Auto-Save Feature

```javascript
class AutoSaveManager {
  constructor(gameService, interval = 30000) {
    this.gameService = gameService;
    this.interval = interval; // 30 seconds default
    this.timerId = null;
    this.lastSave = null;
  }

  start(getGameState) {
    this.stop(); // Clear any existing timer

    this.timerId = setInterval(async () => {
      try {
        const gameState = getGameState();

        // Only save if state changed
        if (JSON.stringify(gameState) !== this.lastSave) {
          await this.gameService.saveGame(gameState);
          this.lastSave = JSON.stringify(gameState);
          console.log('Auto-saved at', new Date().toLocaleTimeString());
        }
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }, this.interval);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  async saveNow(gameState) {
    try {
      await this.gameService.saveGame(gameState);
      this.lastSave = JSON.stringify(gameState);
      return true;
    } catch (error) {
      console.error('Manual save failed:', error);
      return false;
    }
  }
}

// Usage
const autoSave = new AutoSaveManager(gameService, 30000);
autoSave.start(() => gameState);

// Remember to stop when component unmounts
// autoSave.stop();
```

## Error Handling

```javascript
async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      // Handle specific error codes
      switch (response.status) {
        case 401:
          // Unauthorized - token missing or invalid
          authService.logout();
          window.location.href = '/login';
          throw new Error('Session expired. Please login again.');

        case 403:
          // Forbidden - token expired
          authService.logout();
          window.location.href = '/login';
          throw new Error('Session expired. Please login again.');

        case 404:
          throw new Error('Resource not found');

        case 409:
          // Conflict (e.g., username taken)
          throw new Error(data.error || 'Conflict');

        case 413:
          throw new Error('Data too large');

        case 500:
          throw new Error('Server error. Please try again later.');

        default:
          throw new Error(data.error || 'Request failed');
      }
    }

    return data;
  } catch (error) {
    if (error.message) {
      throw error;
    }
    // Network error
    throw new Error('Network error. Please check your connection.');
  }
}
```

## Environment Variables

### Vite (.env)

```bash
VITE_API_URL=http://localhost:3000
```

### Create React App (.env)

```bash
REACT_APP_API_URL=http://localhost:3000
```

### Next.js (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## CORS Notes

The API has CORS enabled by default for all origins. In production, you may want to restrict this to your frontend domain only.

## Demo Credentials

For testing without registration:
- **Username**: demo
- **Password**: demo123
