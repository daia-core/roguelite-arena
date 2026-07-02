# Roguelite Arena

A fast-paced browser roguelite game inspired by Brotato, Balatro, and Binding of Isaac. Built for mobile-first gameplay with tight wave-based combat and deep item synergies.

## Features

- **Wave-based combat** - 20-60 second action loops with shop breaks
- **Juicy feedback** - Screen shake, particles, and sound on every action
- **Item synergies** - Stack modifiers for exponential power growth
- **Touch controls** - Mobile-optimized joystick and ability buttons
- **Auto-save system** - Never lose progress mid-run
- **Meta-progression** - Track stats across runs

## Tech Stack

### Frontend
- TypeScript + Vite
- HTML5 Canvas for rendering
- Touch and keyboard controls
- LocalStorage + API saves

### Backend
- Node.js + Express
- SQLite database
- JWT authentication
- Save state management

## Quick Start

### Local Development

1. **Start the backend:**
   ```bash
   cd backend
   npm install
   node server.js
   ```

2. **Start the frontend** (in another terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Open http://localhost:5173 and start playing!

### Build for Production

```bash
cd frontend
npm run build
```

Output will be in `frontend/dist/` ready for deployment.

## Game Design

Based on proven roguelite patterns (see `research-findings.md`):

1. **Short runs** - Complete in 20-30 minutes
2. **Wave structure** - Fight enemies, upgrade in shop, repeat
3. **Permadeath** - Runs end on death, but meta stats persist
4. **Build variety** - Combine items for unique synergies each run

## Controls

### Desktop
- **WASD** or **Arrow Keys** - Move
- **Auto-aim** - Shoot automatically at nearest enemy
- **Space** - Dash ability
- **E** - Blast ability

### Mobile
- **Touch joystick** - Move (bottom-left of screen)
- **Ability buttons** - Dash and Blast (bottom-right)
- Auto-aim works the same

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick deploy:**

- **Frontend:** Vercel (automatic from Git)
- **Backend:** Forge / Railway / Render (Node.js hosting)

Demo credentials:
- Email: `demo@roguelite.game`
- Password: `demo123`

## Project Structure

```
roguelite-game/
├── frontend/
│   ├── src/
│   │   ├── Game.ts           # Main game loop and state machine
│   │   ├── Player.ts          # Player entity and abilities
│   │   ├── Enemy.ts           # Enemy types and AI
│   │   ├── ItemSystem.ts      # Items and stat modifiers
│   │   ├── WaveManager.ts     # Wave spawning logic
│   │   ├── Particle.ts        # Visual effects
│   │   ├── AudioManager.ts    # Sound system
│   │   ├── SaveManager.ts     # Save/load system
│   │   └── api.ts             # Backend API client
│   ├── index.html
│   └── package.json
├── backend/
│   ├── server.js              # Express API server
│   ├── package.json
│   └── game.db               # SQLite database (auto-created)
├── research-findings.md       # Design research
├── DEPLOYMENT.md              # Deploy guide
└── README.md                  # Original project README
```

## Development

### Adding New Items

Edit `frontend/src/ItemSystem.ts`:

```typescript
{
  id: 'new_item',
  name: 'Item Name',
  description: 'What it does',
  icon: '🎯',
  cost: 50,
  rarity: 'rare',
  damageBonus: 10,
  // ... other stats
}
```

### Adding New Enemy Types

Edit `frontend/src/Enemy.ts` - add to `ENEMY_TYPES` map with stats and behavior.

### Adjusting Balance

Key balance variables in:
- `Player.ts` - Base stats, cooldowns
- `Enemy.ts` - Enemy health, damage, speed
- `WaveManager.ts` - Spawn rates, wave scaling
- `ItemSystem.ts` - Item costs and effects

## API Endpoints

**Auth:**
- `POST /api/register` - Create account
- `POST /api/login` - Login

**Save States:**
- `GET /api/save` - Load game
- `POST /api/save` - Save game
- `DELETE /api/save` - Clear save

**Stats:**
- `GET /api/stats` - Get meta stats
- `POST /api/stats` - Update after run

## License

ISC

## Credits

Inspired by:
- **Brotato** - Wave structure and pacing
- **Balatro** - Juicy feedback and synergies
- **Binding of Isaac** - Roguelite formula and permadeath
