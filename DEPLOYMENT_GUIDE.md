# 🚀 Resonance Deployment Guide

## Quick Summary

| Component | Deploy To | Cost |
|-----------|-----------|------|
| Backend (NestJS) | Railway | Free tier → $5/mo |
| Frontend (React) | Netlify | Free |
| Database | Supabase | Free (you already have this) |
| Redis | Upstash | Free tier |

---

## Step 1: Get Your Production URLs Ready

Before deploying, you'll need these URLs (you'll get them after deploying):
- Backend URL: `https://resonance-backend-xxx.railway.app`
- Frontend URL: `https://resonance.netlify.app`

---

## Step 2: Setup Upstash Redis (FREE)

1. Go to https://upstash.com
2. Sign up (free)
3. Create a new Redis database
4. Copy the `REDIS_URL` (starts with `rediss://`)

---

## Step 3: Deploy Backend to Railway

### 3.1 Push Code to GitHub
```bash
git add .
git commit -m "Ready for production"
git push origin main
```

### 3.2 Connect Railway
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `resonance-backend` repo

### 3.3 Add Environment Variables in Railway
Go to your project → Variables → Add these:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=https://YOUR-RAILWAY-URL/api/v1/auth/spotify/callback
JWT_SECRET=generate-a-64-char-random-string
FRONTEND_URL=https://YOUR-NETLIFY-URL
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### 3.4 Railway Auto-Deploys
Railway will automatically:
- Detect it's a Node.js project
- Run `npm install`
- Run `npm run build`
- Run `npm run start:prod`

### 3.5 Get Your Backend URL
After deploy, Railway gives you a URL like:
`https://resonance-backend-production.up.railway.app`

---

## Step 4: Update Spotify Dashboard

1. Go to https://developer.spotify.com/dashboard
2. Select your app
3. Go to Settings → Edit Settings
4. Add Redirect URI:
   ```
   https://YOUR-RAILWAY-URL/api/v1/auth/spotify/callback
   ```
5. Save

---

## Step 5: Deploy Frontend to Netlify

### 5.1 Update Frontend .env
In your frontend project, update the API URL:
```
VITE_API_URL=https://YOUR-RAILWAY-URL/api/v1
VITE_WS_URL=wss://YOUR-RAILWAY-URL
```

### 5.2 Deploy to Netlify
1. Go to https://netlify.com
2. Sign up with GitHub
3. Click "Add new site" → "Import an existing project"
4. Select your frontend repo
5. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
6. Add environment variables in Netlify dashboard

---

## Step 6: Update Railway with Frontend URL

Go back to Railway and update:
```
FRONTEND_URL=https://your-app.netlify.app
```

---

## Step 7: Add Users to Spotify Developer Dashboard

⚠️ **IMPORTANT: Dev mode = 25 users max**

1. Go to Spotify Dashboard → Your App → User Management
2. Add email addresses of testers
3. They must accept the invite

---

## Testing Checklist

After deployment, test these:

| Feature | Test |
|---------|------|
| ✅ Health Check | Visit `https://YOUR-RAILWAY-URL/health` |
| ✅ Spotify Login | Click login, complete OAuth |
| ✅ Go Live | Toggle live status |
| ✅ See Nearby | Check if nearby users appear |
| ✅ Send Reaction | Send a 🔥 to someone |
| ✅ Drop Capsule | Drop a time capsule |
| ✅ Discover Capsule | Find someone else's capsule |

---

## Time Capsule Testing (2 People)

### Person 1 (Dropper):
1. Login with Spotify
2. Go Live
3. Play a song on Spotify
4. Go to Capsules page
5. Click "Drop Capsule"
6. Add a message
7. Drop it

### Person 2 (Discoverer):
1. Login with Spotify
2. Go Live
3. Be in same location (or nearby)
4. Go to Capsules page
5. See the capsule in "Nearby" tab
6. Click to discover it
7. Like it

**Note:** Both users must be added to Spotify's User Management!

---

## Troubleshooting

### Backend won't start
- Check Railway logs
- Verify all env variables are set
- Check DATABASE_URL is correct

### Spotify login fails
- Verify SPOTIFY_REDIRECT_URI matches exactly
- Check user is added in Spotify Dashboard

### WebSocket not connecting
- Make sure FRONTEND_URL is set correctly
- Check CORS settings

### Redis errors
- Verify REDIS_URL is correct
- Check Upstash dashboard for connection issues

---

## Cost Breakdown (Monthly)

| Service | Free Tier | If You Scale |
|---------|-----------|--------------|
| Railway | 500 hours/month | $5-20/mo |
| Netlify | Unlimited static | Free |
| Supabase | 500MB, 50K requests | $25/mo |
| Upstash | 10K commands/day | $10/mo |

**Total for MVP: $0/month** ✅

---

## You're Ready! 🎉

1. ✅ Backend deployed to Railway
2. ✅ Frontend deployed to Netlify  
3. ✅ Spotify redirect URI updated
4. ✅ Test users added to Spotify
5. ✅ All features working
