# Deploy in Under 2 Minutes

## Step 1: Push to GitHub (30 seconds)

```bash
cd /workspace/work/roguelite-game
gh repo create roguelite-arena --public --source=. --push
# If gh not installed: create repo on github.com manually and push
```

## Step 2: Deploy Frontend to Vercel (60 seconds)

**Option A: One-Click**
1. Go to https://vercel.com/new
2. Import your `roguelite-arena` repo
3. Framework: Vite
4. Root Directory: `frontend`
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Click Deploy

**Option B: CLI**
```bash
cd frontend
npm i -g vercel
vercel --prod
```

## Step 3: Deploy Backend to Railway (30 seconds)

**Option A: One-Click**
1. Go to https://railway.app/new
2. Deploy from GitHub: select `roguelite-arena`
3. Root: `api`
4. Add variables:
   - `JWT_SECRET`: `your-secret-key-here`
   - `PORT`: `3000`
5. Deploy

**Option B: CLI**
```bash
cd api
npm i -g @railway/cli
railway login
railway init
railway up
```

## Step 4: Connect Frontend to Backend (10 seconds)

1. Get your Railway backend URL (e.g., `https://roguelite-api.railway.app`)
2. In `frontend/src/main.ts`, update line 4:
   ```typescript
   const API_URL = 'https://YOUR-RAILWAY-URL.railway.app'
   ```
3. Redeploy frontend (Vercel auto-deploys on git push)

## Done!

Demo user: `demo` / `demo123`

Your game is live at: `https://your-project.vercel.app`
