# Roguelite Game API

Production-ready Node.js/Express backend API for the roguelite game with user authentication and save state management.

## Features

- User registration and authentication with JWT
- Secure password hashing with bcrypt
- Save state management (create, read, delete)
- SQLite database with better-sqlite3
- CORS enabled for frontend integration
- Input validation and error handling
- Demo user pre-created for testing

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express 5
- **Database**: SQLite with better-sqlite3
- **Authentication**: JWT (jsonwebtoken)
- **Security**: bcrypt password hashing
- **CORS**: Enabled for frontend

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Set environment variables (or create a `.env` file):

```bash
PORT=3000
JWT_SECRET=your-secure-secret-change-in-production
NODE_ENV=production
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start Server

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

Server will run on `http://localhost:3000`

## API Documentation

### Authentication Endpoints

#### POST /api/register

Register a new user account.

**Request Body:**
```json
{
  "username": "player1",
  "password": "securepass123"
}
```

**Validation Rules:**
- Username: 3-30 characters, alphanumeric + underscore/hyphen only
- Password: Minimum 6 characters

**Response (201 Created):**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "player1"
  }
}
```

**Error Responses:**
- `400`: Invalid input (validation failed)
- `409`: Username already taken
- `500`: Internal server error

---

#### POST /api/login

Authenticate and receive a JWT token.

**Request Body:**
```json
{
  "username": "player1",
  "password": "securepass123"
}
```

**Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "player1"
  }
}
```

**Error Responses:**
- `400`: Missing username or password
- `401`: Invalid credentials
- `500`: Internal server error

---

#### GET /api/me

Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "player1",
    "created_at": "2026-07-01 12:00:00"
  }
}
```

**Error Responses:**
- `401`: Missing or invalid token
- `403`: Expired token
- `404`: User not found
- `500`: Internal server error

---

### Save State Endpoints

All save endpoints require authentication via JWT token in the `Authorization` header.

#### GET /api/saves

Retrieve the user's latest save state.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "save": {
    "id": 1,
    "data": {
      "floor": 5,
      "health": 75,
      "inventory": ["sword", "potion"],
      "position": { "x": 10, "y": 20 }
    },
    "updated_at": "2026-07-01 15:30:00"
  }
}
```

**Response (No Save):**
```json
{
  "save": null
}
```

---

#### POST /api/saves

Create or update the user's save state.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "saveData": {
    "floor": 5,
    "health": 75,
    "inventory": ["sword", "potion"],
    "position": { "x": 10, "y": 20 },
    "timestamp": 1719850200000
  }
}
```

**Notes:**
- `saveData` can be any valid JSON object
- Maximum size: 5MB
- Automatically updates `updated_at` timestamp

**Response (200 OK):**
```json
{
  "message": "Save successful",
  "save": {
    "id": 1,
    "updated_at": "2026-07-01T15:30:00.000Z"
  }
}
```

**Error Responses:**
- `400`: Invalid save data format
- `413`: Save data too large (>5MB)
- `401`: Missing or invalid token
- `500`: Internal server error

---

#### DELETE /api/saves

Delete the user's save state.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "message": "Save deleted successfully"
}
```

**Error Responses:**
- `404`: No save found to delete
- `401`: Missing or invalid token
- `500`: Internal server error

---

### Utility Endpoints

#### GET /health

Health check endpoint for monitoring.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-07-01T15:30:00.000Z"
}
```

---

## Demo User

A demo user is automatically created on first run:

- **Username**: `demo`
- **Password**: `demo123`

Use these credentials for testing without registration.

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Saves Table

```sql
CREATE TABLE saves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  save_data TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

## Security Features

1. **Password Hashing**: All passwords hashed with bcrypt (10 rounds)
2. **JWT Authentication**: Tokens expire after 7 days
3. **Input Validation**: Username/password validation on registration
4. **CORS**: Enabled for frontend integration
5. **SQL Injection Prevention**: Prepared statements via better-sqlite3
6. **Rate Limiting**: Add nginx/reverse proxy rate limiting in production

## Deployment

### Prerequisites

- Node.js 18+ installed
- PM2 or similar process manager (recommended)
- Reverse proxy (nginx) for SSL/TLS

### Deploy to Laravel Forge

1. **Create Server**: Set up a new server on Forge

2. **Create Site**: Add a new site for your API

3. **Deploy Script**: Update Forge deploy script:

```bash
cd /home/forge/your-site.com/api
git pull origin main
npm ci --production
npm run build # if needed
echo "Restarting application..."
```

4. **Environment Variables**: Add to Forge environment:

```bash
PORT=3000
JWT_SECRET=your-secure-secret-here
NODE_ENV=production
```

5. **Process Manager**: Create PM2 ecosystem file `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'roguelite-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

Start with: `pm2 start ecosystem.config.js`

6. **Nginx Configuration**: Proxy requests to the API:

```nginx
location /api {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

7. **SSL/TLS**: Enable SSL via Forge (Let's Encrypt)

8. **Database Backup**: Set up automated backups of `game.db`

### Production Checklist

- [ ] Generate and set secure JWT_SECRET
- [ ] Set NODE_ENV=production
- [ ] Configure reverse proxy (nginx)
- [ ] Enable SSL/TLS certificates
- [ ] Set up database backups
- [ ] Configure process manager (PM2)
- [ ] Add monitoring (health checks)
- [ ] Set up logging (winston/pino)
- [ ] Configure firewall rules
- [ ] Add rate limiting (nginx or express-rate-limit)

## File Structure

```
api/
├── server.js          # Main Express application
├── db.js              # Database setup and queries
├── auth.js            # JWT authentication middleware
├── package.json       # Dependencies and scripts
├── .gitignore         # Git ignore rules
├── README.md          # This file
└── game.db            # SQLite database (auto-created)
```

## Development

### Run with Auto-Reload

```bash
npm run dev
```

Uses Node.js `--watch` flag (requires Node 18+).

### Test Endpoints

Using curl:

```bash
# Register
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"test123"}'

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'

# Get profile (replace TOKEN)
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer TOKEN"

# Save state (replace TOKEN)
curl -X POST http://localhost:3000/api/saves \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"saveData":{"floor":5,"health":75}}'

# Get save (replace TOKEN)
curl http://localhost:3000/api/saves \
  -H "Authorization: Bearer TOKEN"

# Delete save (replace TOKEN)
curl -X DELETE http://localhost:3000/api/saves \
  -H "Authorization: Bearer TOKEN"
```

## License

ISC
