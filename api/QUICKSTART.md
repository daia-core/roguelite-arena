# Quick Start Guide

Get the API running in 60 seconds.

## 1. Start the Server

```bash
cd /workspace/work/roguelite-game/api
npm start
```

Server runs on `http://localhost:3000`

## 2. Test It Works

```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

## 3. Login with Demo User

```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo123"}'
```

Returns a JWT token you can use for authenticated requests.

## 4. Make an Authenticated Request

Replace `YOUR_TOKEN` with the token from step 3:

```bash
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## API Endpoints

**Auth:**
- `POST /api/register` - Create account
- `POST /api/login` - Get token
- `GET /api/me` - Get profile (auth required)

**Saves:**
- `GET /api/saves` - Load save (auth required)
- `POST /api/saves` - Save game (auth required)
- `DELETE /api/saves` - Delete save (auth required)

## Next Steps

1. Read `README.md` for complete API documentation
2. Read `FRONTEND_INTEGRATION.md` for frontend examples
3. Read `DEPLOYMENT.md` for production deployment

## Demo User

- Username: `demo`
- Password: `demo123`

Auto-created on first run.
