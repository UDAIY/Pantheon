#!/bin/bash
# ViceRide - Quick Deployment Steps

echo "🚀 ViceRide Deployment to Railway.app"
echo "======================================"
echo ""

# Step 1: Ensure git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - ViceRide app"
else
    echo "✅ Git repository already initialized"
fi

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1️⃣  Create a GitHub account at https://github.com"
echo ""
echo "2️⃣  Push your code to GitHub:"
echo "    git remote add origin https://github.com/your-username/viceride.git"
echo "    git branch -M main"
echo "    git push -u origin main"
echo ""
echo "3️⃣  Go to https://railway.app and sign up with GitHub"
echo ""
echo "4️⃣  Click '+ New Project' → 'Deploy from GitHub repo'"
echo "    Select your viceride repository"
echo ""
echo "5️⃣  Add these environment variables in Railway:"
echo "    - PORT (set to 3000)"
echo "    - MONGO_URI (from .env)"
echo "    - JWT_SECRET (from .env)"
echo "    - EMAIL_SERVICE (from .env)"
echo "    - EMAIL_USER (from .env)"
echo "    - EMAIL_PASS (from .env)"
echo "    - EMAIL_FROM (from .env)"
echo ""
echo "6️⃣  Railway will automatically deploy your app!"
echo ""
echo "7️⃣  Your live URL will be shown in the Railway dashboard"
echo ""
echo "✨ Your app is now online!"
