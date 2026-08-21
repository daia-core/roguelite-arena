#!/bin/bash
# Roguelite Arena — quick deploy to both Vercel projects
# Run from the repo root: /workspace/work/roguelite-game/
#
# Deploys the same Vite bundle to two projects:
#   roguelite-game  → roguelite-game-blush.vercel.app
#   roguelite-arena → frontend-daiacore.vercel.app
#
# See DEPLOY.md for the full explanation of why this approach is needed
# (root vercel.json "services" layout breaks the normal vercel CLI flow).

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Project IDs (both in the daiacore team)
ROGUELITE_GAME_PROJECT="prj_aZFbLQqU1lYrNu9tsTupMSza9ELx"
ROGUELITE_ARENA_PROJECT="prj_Bk6tRzPhLaNGtw2tlIwnUmouKTX0"
ORG_ID="team_h89iwY4NEasSnctSAppewGet"

echo "=== Roguelite Arena — quick deploy ==="
echo ""

# ── 1. Build ──────────────────────────────────────────────────────────────────
echo "Step 1/4: Vite build (frontend/)"
cd frontend
npm run build
cd "$SCRIPT_DIR"
echo "  ✓ Build complete → frontend/dist/"
echo ""

# ── 2. Construct Vercel prebuilt output ──────────────────────────────────────
echo "Step 2/4: Packaging Vercel output"
rm -rf .vercel/output
mkdir -p .vercel/output/static
cp -r frontend/dist/. .vercel/output/static/
printf '{"version":3}' > .vercel/output/config.json
echo "  ✓ .vercel/output/ ready"
echo ""

# ── 3. Deploy helper (swaps project.json, deploys, returns deployment URL) ───
deploy_project() {
  local name="$1"
  local project_id="$2"

  # Write the project config that tells vercel CLI which project to target
  cat > .vercel/project.json << EOF
{"projectId":"${project_id}","orgId":"${ORG_ID}","projectName":"${name}"}
EOF

  echo "  Deploying to ${name}…"
  # VERCEL_TOKEN must be in the environment (not argv) — host redacts argv secrets
  VERCEL_TOKEN="$VERCEL_API_TOKEN" \
    npx vercel deploy --prebuilt --prod --yes --scope daiacore 2>&1 | tail -5
}

# ── 4. Deploy both projects ───────────────────────────────────────────────────
echo "Step 3/4: Deploy to roguelite-game"
deploy_project "roguelite-game" "$ROGUELITE_GAME_PROJECT"
echo "  ✓ roguelite-game deployed"
echo ""

echo "Step 4/4: Deploy to roguelite-arena"
deploy_project "roguelite-arena" "$ROGUELITE_ARENA_PROJECT"
echo "  ✓ roguelite-arena deployed"
echo ""

# ── 5. Verify both point to the same bundle ──────────────────────────────────
echo "Verifying bundle hash parity…"
HASH_GAME=$(curl -s https://roguelite-game-blush.vercel.app | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1)
HASH_ARENA=$(curl -s https://frontend-daiacore.vercel.app   | grep -o 'index-[A-Za-z0-9_-]*\.js' | head -1)

echo "  roguelite-game  → $HASH_GAME"
echo "  roguelite-arena → $HASH_ARENA"

if [ "$HASH_GAME" = "$HASH_ARENA" ] && [ -n "$HASH_GAME" ]; then
  echo "  ✓ Both projects live at $HASH_GAME"
else
  echo "  ⚠ Hash mismatch — one project may not have updated yet"
  echo "    Check: https://vercel.com/daiacore"
fi

# ── 6. Cleanup ───────────────────────────────────────────────────────────────
rm -rf .vercel/
echo ""
echo "Done. Live URLs:"
echo "  https://roguelite-game-blush.vercel.app"
echo "  https://frontend-daiacore.vercel.app"
