# Deploy in 60 Seconds

The game is **100% self-contained** - no backend needed! It uses LocalStorage for saves.

## One-Command Deploy

```bash
cd /workspace/work/roguelite-game/frontend && npx vercel --prod
```

That's it! Vercel will:
1. Detect it's a Vite app
2. Build it automatically
3. Deploy it
4. Give you a live URL

## What You Get

- Live game at `https://your-project.vercel.app`
- Works on mobile (touch controls)
- Saves progress in browser
- No backend/database needed

## Demo "Login"

There's no actual login - the game is single-player and saves to your browser. Just click "New Game" to play!

## Alternative: Test Locally First

```bash
cd /workspace/work/roguelite-game/frontend
npm run dev
# Open http://localhost:5173
```

## The Backend?

The `api/` folder has a fully-built auth + cloud-saves backend, but it's **optional**. The game works perfectly without it. If you want cloud saves later:

1. Deploy API to Railway/Render
2. Integrate it into the frontend
3. Redeploy

For now, the game is ready to play as-is!
