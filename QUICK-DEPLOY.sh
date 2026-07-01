#!/bin/bash
# Quick deploy script for Roguelite Arena
# Run this from the Mac Mini where the code lives

set -e

echo "🎮 Roguelite Arena - Quick Deploy"
echo "=================================="
echo ""

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "frontend" ] || [ ! -d "api" ]; then
  echo "❌ Error: Please run this script from /workspace/work/roguelite-game/"
  exit 1
fi

echo "📦 Step 1: Push to GitHub"
echo ""

# Check if git remote exists
if ! git remote | grep -q origin; then
  echo "Adding GitHub remote..."
  git remote add origin https://github.com/daia-core/roguelite-arena.git
fi

# Push to GitHub
echo "Pushing to GitHub..."
git branch -M main
git push -u origin main || {
  echo ""
  echo "⚠️  Git push failed. You may need to authenticate."
  echo "   Run: gh auth login"
  echo "   Then try again."
  exit 1
}

echo "✅ Code pushed to GitHub"
echo ""

echo "🚀 Step 2: Deploy Frontend to Vercel"
echo ""

cd frontend

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo "Installing Vercel CLI..."
  npm install -g vercel
fi

# Deploy to Vercel
echo "Deploying to Vercel..."
vercel --prod --yes

cd ..

echo ""
echo "✅ Frontend deployed!"
echo ""

echo "🔧 Step 3: Deploy Backend"
echo ""
echo "Choose your backend deployment method:"
echo "  1) Railway (recommended)"
echo "  2) Render"
echo "  3) Manual (run locally)"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
  1)
    echo "Deploying to Railway..."
    cd api
    if ! command -v railway &> /dev/null; then
      echo "Installing Railway CLI..."
      npm install -g @railway/cli
    fi
    railway login
    railway init
    railway up
    cd ..
    echo "✅ Backend deployed to Railway!"
    echo "   Get your Railway URL and update frontend/src/main.ts API_URL"
    ;;
  2)
    echo "📝 To deploy to Render:"
    echo "   1. Go to https://render.com/new"
    echo "   2. Connect your GitHub repo"
    echo "   3. Select 'api' directory"
    echo "   4. Set environment variables:"
    echo "      - JWT_SECRET=your-secret-key"
    echo "      - PORT=3000"
    echo "   5. Deploy!"
    ;;
  3)
    echo "Running backend locally..."
    cd api
    JWT_SECRET="dev-secret-$(date +%s)" node server.js &
    cd ..
    echo "✅ Backend running on localhost:3000"
    echo "   Note: This won't be accessible from Vercel deployment"
    ;;
esac

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Get your Vercel URL from the deployment output"
echo "   2. Get your backend URL (Railway/Render)"
echo "   3. Update frontend/src/main.ts with backend URL"
echo "   4. Redeploy frontend: cd frontend && vercel --prod"
echo ""
echo "🎮 Demo Login:"
echo "   Username: demo"
echo "   Password: demo123"
echo ""
