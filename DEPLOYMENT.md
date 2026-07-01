# Roguelite Arena - Deployment Guide

## Project Structure

```
roguelite-game/
├── frontend/          # Vite + TypeScript game client
├── backend/           # Node.js + Express API server
├── research-findings.md
└── DEPLOYMENT.md      # This file
```

## Quick Deploy

### Frontend (Vercel)

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Deploy from the frontend directory:
   ```bash
   cd frontend
   vercel --prod
   ```

   Or connect via Vercel dashboard:
   - Go to [vercel.com](https://vercel.com)
   - Import Git repository
   - Framework: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

### Backend (Forge / Any Node.js Host)

The backend is a simple Node.js Express server with SQLite database.

**Deploy to Forge:**

1. Create a new server on Forge
2. Create a new site (Node.js application)
3. Set deployment script:
   ```bash
   cd /home/forge/roguelite-backend
   git pull origin main
   npm install --production
   pm2 restart roguelite-backend
   ```

4. Set environment variables in Forge:
   ```
   PORT=3000
   JWT_SECRET=<generate-a-secure-random-string>
   NODE_ENV=production
   ```

5. Start the application:
   ```bash
   pm2 start server.js --name roguelite-backend
   pm2 save
   ```

**Alternative: Deploy to Railway / Render / Fly.io:**

All these platforms support Node.js apps. Just:
1. Connect your Git repository
2. Set root directory to `backend`
3. Start command: `node server.js`
4. Set environment variables (JWT_SECRET)

## Environment Variables

### Frontend

Create `/frontend/.env.production`:
```
VITE_API_URL=https://your-backend-url.com/api
```

### Backend

Required environment variables:
- `PORT` (default: 3000)
- `JWT_SECRET` (required for production - generate a long random string)
- `NODE_ENV` (production/development)

## Testing the Deployment

### Local Testing

1. Start backend:
   ```bash
   cd backend
   node server.js
   ```

2. Start frontend (in another terminal):
   ```bash
   cd frontend
   npm run dev
   ```

3. Open http://localhost:5173

### Production Testing

After deployment:

1. Test backend health:
   ```bash
   curl https://your-backend-url.com/api/health
   ```

2. Test user registration:
   ```bash
   curl -X POST https://your-backend-url.com/api/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@test.com","password":"test123","username":"TestPlayer"}'
   ```

3. Open frontend URL and play the game!

## Demo Credentials

After deployment, create a demo user:

```bash
curl -X POST https://your-backend-url.com/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@roguelite.game","password":"demo123","username":"DemoPlayer"}'
```

Login with:
- Email: `demo@roguelite.game`
- Password: `demo123`

## Database

The backend uses SQLite (file-based database). The `game.db` file is created automatically on first run. For production:

1. Ensure the backend directory is writable
2. Regular backups: `cp game.db game.db.backup`
3. For high traffic, consider migrating to PostgreSQL

## Troubleshooting

### Frontend not connecting to backend

1. Check CORS is enabled on backend
2. Verify `VITE_API_URL` environment variable
3. Check browser console for errors

### Backend database errors

1. Ensure directory is writable: `chmod 755 backend/`
2. Check SQLite is installed: `node -e "require('better-sqlite3')"`
3. Delete and recreate database: `rm game.db && node server.js`

### Game not loading

1. Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
2. Clear browser cache
3. Check browser console for errors
4. Verify build completed successfully: check `frontend/dist/` directory

## Performance

### Frontend

- Vite automatically handles code splitting
- Assets are minified and optimized
- Consider CDN for static assets (Vercel handles this)

### Backend

- SQLite is sufficient for ~1000 concurrent users
- For scaling, use pm2 cluster mode or multiple instances
- Consider Redis for session caching if needed

## Security Notes

1. **Change JWT_SECRET** in production - use a long random string
2. Enable HTTPS (Vercel/Forge handle this automatically)
3. Rate limiting: Add express-rate-limit for production
4. Input validation: Already handled in API endpoints
5. SQL injection: Using prepared statements (safe)

## Support

For issues or questions:
- Check browser console for frontend errors
- Check server logs: `pm2 logs roguelite-backend`
- Database location: `backend/game.db`
