# ViceRide - Railway.app Deployment Guide

## 📱 Quick Start to Deploy on Railway

### Step 1: Create a GitHub Repository
1. Go to [github.com](https://github.com) and sign up (if needed)
2. Click **New Repository**
3. Name it `viceride` (or any name)
4. Click **Create repository**
5. Follow the local commands shown:
```bash
cd "D:\1\web D"
git remote add origin https://github.com/your-username/viceride.git
git branch -M main
git push -u origin main
```

---

### Step 2: Sign Up for Railway.app
1. Go to [railway.app](https://railway.app)
2. Click **Start Project** or **Sign Up**
3. Sign in with GitHub (recommended)
4. Authorize Railway to access your GitHub

---

### Step 3: Create a New Project on Railway
1. Click **+ New Project** → **Deploy from GitHub repo**
2. Select your `viceride` repository
3. Click **Deploy**
4. Wait for build to complete (2-3 minutes)

---

### Step 4: Add Environment Variables
1. Go to your Railway project
2. Click **Variables** tab
3. Add these variables (copy from `.env`):
   ```
   PORT=3000
   MONGO_URI=mongodb+srv://UDAIY:qpUN121MXu8V8Pte@cluster0.qvvumgh.mongodb.net/auth_db?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_jwt_key
   EMAIL_SERVICE=Gmail
   EMAIL_USER=udaiyxyz@gmail.com
   EMAIL_PASS=jnifdbwtxtsmrqxe
   EMAIL_FROM=ViceRide <noreply@viceride.com>
   ```
4. Click **Deploy** to redeploy with new variables

---

### Step 5: Get Your Live URL
1. On Railway dashboard, click **Deployments**
2. Your app URL will be shown (something like: `viceride-production.up.railway.app`)
3. Click the domain link to open your app!

---

## 🔧 What's Included

✅ **Node.js Backend** - Automatically detected and deployed
✅ **Express API** - All routes working
✅ **MongoDB Atlas** - Already configured (free tier)
✅ **Socket.io** - Real-time features enabled
✅ **Frontend** - Served from backend (static files)

---

## 📊 Free Tier Limits (Railway)

- **Compute**: $5/month included (plenty for small apps)
- **Storage**: 100GB bandwidth/month
- **Duration**: Unlimited uptime
- **Databases**: Use MongoDB Atlas free tier alongside

---

## 🚀 After Deployment

1. **Update Frontend URLs** (if using API calls)
   - Replace `localhost:3000` with your Railway URL
   - Check these files:
     - `frontend/main.js`
     - `frontend/ride-track.js`
     - `frontend/driver-dashboard.js`
     - `frontend/book.js`
     - etc.

2. **Test Your App**
   - Visit: `https://your-railway-url.up.railway.app`
   - Test login, ride booking, driver features

3. **Monitor Logs**
   - In Railway dashboard → **Logs** tab
   - Check for any errors

---

## 🔒 Security Notes

⚠️ **IMPORTANT**: Never commit `.env` to GitHub!
✅ Your `.env` is already in `.gitignore` (safe)

---

## 💡 Troubleshooting

### App not starting?
- Check **Logs** in Railway dashboard
- Ensure all environment variables are set
- Verify MongoDB URI is correct and accessible

### CORS errors?
- Check `server.js` line 27: `cors: { origin: '*' }` allows all origins
- Update if needed for production

### Socket.io issues?
- Railway handles WebSockets automatically
- Make sure `socket.io` config uses relative paths

---

## 📞 Support

- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas

---

**Your app is now live! 🎉**

Share your URL: `https://your-railway-url.up.railway.app`
