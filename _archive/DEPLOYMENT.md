# Deployment Guide

## Quick Deploy

### Frontend (Vercel)
1. Push to GitHub:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/roguelite-game.git
   git push -u origin master
   ```

2. Deploy on Vercel:
   - Go to https://vercel.com/new
   - Import the repository
   - Vercel will auto-detect Vite
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Deploy!

### Backend (Forge)
1. Create a new site on Forge
2. SSH into the server
3. Clone the repo and setup:
   ```bash
   cd /home/forge/YOUR_SITE
   git clone https://github.com/YOUR_USERNAME/roguelite-game.git .
   cd api
   npm install --production
   cp .env.example .env
   nano .env  # Set JWT_SECRET to a random string
   ```

4. Configure Nginx (Forge UI):
   - Edit site nginx config
   - Proxy `/api/*` to `http://localhost:3000`

5. Start with PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name roguelite-api
   pm2 save
   pm2 startup
   ```

## Demo User
- Username: `demo`
- Password: `demo123`
