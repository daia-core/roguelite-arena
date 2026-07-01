# Roguelite Arena

A complete mobile-friendly browser roguelite built with TypeScript + Canvas, featuring full game loop, wave-based survivor gameplay, item synergies, and save system.

## Features

### Game
- 20-wave roguelite runs (~15-20 minutes)
- Auto-attacking combat with 2 active abilities
- 15 items with multiplicative stat stacking
- 4 enemy types with unique behaviors
- XP leveling and gold economy
- Shop between waves
- Save/load system

### Tech
- **Frontend**: TypeScript + Canvas, Vite build
- **Backend**: Node.js/Express + SQLite
- **Deploy**: Vercel (game) + Forge (API)
- **Mobile**: Touch controls (virtual joystick + ability buttons)

## Quick Start

### Play Locally

**Frontend:**
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

**Backend:**
```bash
cd api
npm install
npm start
# API runs on http://localhost:3000
```

### Demo User
- Username: `demo`
- Password: `demo123`

## Controls

### Keyboard
- WASD / Arrow Keys: Move
- Space / Shift: Dash
- E / Q: Blast

### Mobile
- Touch left side: Virtual joystick
- DASH/BLAST buttons: Abilities

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Vercel + Forge deployment instructions.

## Architecture

- `frontend/` - Canvas game (TypeScript/Vite)
- `api/` - Auth + save states (Express/SQLite)
- Full docs in `frontend/ARCHITECTURE.md` and `api/README.md`

## License

MIT
