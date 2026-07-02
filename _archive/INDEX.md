# Roguelite Arena - Project Index

## Quick Navigation

### 🚀 Get Started (Pick One)

1. **Just want to play?**
   → Read: [`QUICK-START.md`](./QUICK-START.md)
   → Time: 30 seconds to local test

2. **Want to deploy?**
   → Read: [`DEPLOYMENT.md`](./DEPLOYMENT.md)
   → Time: 2-5 minutes to production

3. **Want full details?**
   → Read: [`COMPLETION-SUMMARY.md`](./COMPLETION-SUMMARY.md)
   → Everything that was built

4. **Want to understand the code?**
   → Read: [`ARCHITECTURE.md`](./ARCHITECTURE.md)
   → System design and data flow

5. **Want the complete documentation?**
   → Read: [`README-COMPLETE.md`](./README-COMPLETE.md)
   → Full project documentation

## Project Structure

```
roguelite-game/
│
├── 📄 Documentation (Start Here)
│   ├── INDEX.md                  ← You are here
│   ├── QUICK-START.md            ← 30-second local test
│   ├── DEPLOYMENT.md             ← Deploy instructions
│   ├── COMPLETION-SUMMARY.md     ← What was built
│   ├── PROJECT-STATUS.md         ← Detailed status
│   ├── ARCHITECTURE.md           ← System design
│   ├── README-COMPLETE.md        ← Full docs
│   ├── README.md                 ← Original project brief
│   └── research-findings.md      ← Design research
│
├── 🎮 Frontend (The Game)
│   ├── src/
│   │   ├── Game.ts               ← Main game loop
│   │   ├── Player.ts             ← Player character
│   │   ├── Enemy.ts              ← Enemy types
│   │   ├── ItemSystem.ts         ← Items & stats
│   │   ├── WaveManager.ts        ← Wave spawning
│   │   ├── Particle.ts           ← Visual effects
│   │   ├── SaveManager.ts        ← Persistence
│   │   ├── Input.ts              ← Controls
│   │   ├── Renderer.ts           ← Drawing
│   │   ├── AudioManager.ts       ← Sound
│   │   ├── Projectile.ts         ← Bullets
│   │   ├── api.ts                ← Backend client
│   │   ├── utils.ts              ← Helpers
│   │   └── main.ts               ← Entry point
│   ├── index.html                ← HTML shell
│   ├── package.json              ← Dependencies
│   ├── vercel.json               ← Deploy config
│   └── dist/                     ← Built game
│
└── 🔧 Backend (API Server)
    ├── server.js                 ← Express API
    ├── package.json              ← Dependencies
    └── game.db                   ← SQLite database
```

## What's Inside

### Game Features
- ✅ Wave-based combat (Brotato-style)
- ✅ 4 enemy types with unique behaviors
- ✅ 2 player abilities (Dash, Blast)
- ✅ 15+ items with synergies
- ✅ Shop system between waves
- ✅ Touch controls for mobile
- ✅ Particle effects & screen shake
- ✅ Save/load system
- ✅ Meta-progression tracking

### Technical Stack
- **Frontend:** TypeScript + Vite + Canvas
- **Backend:** Node.js + Express + SQLite
- **Auth:** JWT tokens + bcrypt
- **Storage:** LocalStorage + Database
- **Deploy:** Vercel (frontend) + Forge (backend)

### Bundle Sizes
- Frontend: 12 KB gzipped (40 KB raw)
- Backend: ~120 npm packages
- Database: Starts at ~20 KB

## Common Tasks

### Local Development
```bash
# Backend (Terminal 1)
cd backend && node server.js

# Frontend (Terminal 2)
cd frontend && npm run dev

# Open: http://localhost:5173
```

### Build for Production
```bash
cd frontend
npm run build
# Output: frontend/dist/
```

### Deploy to Vercel
```bash
cd frontend
npx vercel --prod
```

### Test Backend
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok",...}
```

## Key Stats

- **Lines of Code:** ~2,500
- **Files Created:** 21
- **TypeScript Files:** 14
- **Build Time:** < 1 second
- **Load Time:** < 2 seconds
- **Target FPS:** 60
- **Development Time:** Single session

## Status

**Frontend:** ✅ Complete, tested, ready to deploy
**Backend:** ✅ Complete, tested, running
**Documentation:** ✅ Comprehensive
**Deployment:** ⏳ Configs ready, needs manual deploy

## Demo Credentials

**Backend API:**
- Email: `demo@roguelite.game`
- Password: `demo123`
- Username: `DemoPlayer`

## Next Steps

1. **Test locally** (30 seconds)
   ```bash
   cd backend && node server.js &
   cd frontend && npm run dev
   ```

2. **Deploy frontend** (2 minutes)
   ```bash
   cd frontend && npx vercel --prod
   ```

3. **Test on mobile** (open deployed URL on phone)

4. **Deploy backend** (if you want cloud saves)
   - See DEPLOYMENT.md for Forge instructions

## Getting Help

**For gameplay questions:**
- See README-COMPLETE.md (controls, how to play)

**For deployment issues:**
- See DEPLOYMENT.md (troubleshooting section)

**For code questions:**
- See ARCHITECTURE.md (system design)
- See source files (well-commented)

**For technical status:**
- See PROJECT-STATUS.md (detailed report)

## Credits

**Inspired by:**
- Brotato (wave structure)
- Balatro (juicy feedback)
- Binding of Isaac (roguelite formula)

**Built with:**
- TypeScript
- Vite
- Node.js
- Express
- SQLite
- HTML5 Canvas

## License

ISC

---

**Current Status:** Ready to deploy and play!

**Last Updated:** 2026-07-01

**Project Location:** `/workspace/work/roguelite-game/`
