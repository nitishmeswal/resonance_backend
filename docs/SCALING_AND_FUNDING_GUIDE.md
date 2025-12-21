# 📈 Resonance: Scaling, Funding & Technical Deep Dive

---

## 🔧 FIX APPLIED: TypeORM Error

The `TimeCapsule.locationName` error is now fixed. Restart your backend:
```bash
npm run start:dev
```

---

## 🤔 Understanding "Live Users" - Your Questions Answered

### Q: If 1000 people come in my 500m-10km area, will my app crash?

**Answer: NO, not because of them being nearby.**

Here's why:

| What Happens | Server Load |
|--------------|-------------|
| User opens app | 1 REST request |
| User goes live | 1 WebSocket connection |
| User in your area | Just a database query filter |

**The "nearby" check is just a WHERE clause on geohash.** Whether 10 or 1000 people are near you, it's the same query cost.

### Q: Does a user in another state count as "live"?

**YES!** "Live users" means **globally connected users**, not just near you.

```
Total Live Users = All users with active WebSocket connections worldwide

Your Nearby Users = Live users filtered by geohash proximity
```

### Q: So what actually causes load?

| Action | Load Type | Limit |
|--------|-----------|-------|
| WebSocket connections | Memory/CPU | ~500-1000 per instance |
| Database queries | I/O | ~200/sec with pooling |
| Spotify API calls | External rate limit | 180/min for YOUR app |
| Location calculations | CPU | Negligible |

### Real Scenario Example:

```
You're in Mumbai. Your app has:
- 10,000 registered users (India)
- 500 are "live" right now (globally)
- 50 are live in Mumbai
- 10 are within 1km of you

Server load = 500 WebSocket connections
Your screen shows = 10 nearby users
Query cost = Same whether 10 or 100 nearby
```

---

## ⚡ Redis Caching Setup

### Why Redis?

Currently, every time someone requests "live users", we query:
1. Database for live_status
2. Database for current_tracks
3. Database for location_snapshots

**With Redis**: Cache these in memory → 10x faster responses

### Step 1: Get Redis (Upstash - FREE)

1. Go to [upstash.com](https://upstash.com)
2. Create account → Create Database
3. Choose "Global" region
4. Copy the Redis URL (looks like: `rediss://default:xxx@xxx.upstash.io:6379`)

### Step 2: Update .env

```env
# Add this line
REDIS_URL=rediss://default:your_password@your-endpoint.upstash.io:6379
```

### Step 3: Verify Connection

Restart backend - you should see:
```
[RedisService] Connected to Redis
```

Instead of:
```
[RedisService] Using in-memory fallback
```

### What Gets Cached:

| Data | TTL | Purpose |
|------|-----|---------|
| `presence:user:{id}` | 60s | Live status |
| `geohash:{hash}` | 30s | Users in area |
| `track:{userId}` | 30s | Current track |
| `socket:{userId}` | Session | Socket mapping |

---

## 🔄 Horizontal Scaling Explained

### What is it?

**Vertical Scaling** = Bigger server (more RAM, CPU)
**Horizontal Scaling** = More servers (multiple instances)

```
BEFORE (1 instance):
┌─────────────────┐
│   Backend x1    │ ← All 500 users connect here
│   (1GB RAM)     │
└─────────────────┘

AFTER (2 instances):
┌─────────────────┐  ┌─────────────────┐
│   Backend x1    │  │   Backend x2    │
│   (1GB RAM)     │  │   (1GB RAM)     │
└────────┬────────┘  └────────┬────────┘
         │                    │
         └────────┬───────────┘
                  │
         ┌────────▼────────┐
         │  Load Balancer  │ ← Distributes users
         └─────────────────┘
```

### Does it break anything?

| Concern | Answer |
|---------|--------|
| **User flow** | No change - users don't notice |
| **Latency** | Actually FASTER (load distributed) |
| **WebSockets** | Need "sticky sessions" (auto-handled by Railway/Render) |
| **Sessions** | Stored in Redis (shared) |
| **Database** | Already shared (Supabase) |

### How to enable on Railway:

```yaml
# railway.json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "numReplicas": 2,  # ← This gives you 2 instances
    "restartPolicyType": "ON_FAILURE"
  }
}
```

**Cost**: ~$10/month per additional instance

---

## 💰 Funding Explained (YC, Product Hunt, etc.)

### Product Hunt - NOT for Funding

Product Hunt is for **visibility**, not money:
- Launch your product
- Get upvotes
- Attract users/investors
- No money given

### Y Combinator (YC) - Real Funding

**What they give**:
- $500,000 investment
- 3-month program (remote or SF)
- Network, mentors, demo day

**What's the catch?**:
- They take **7% equity** in your company
- You must incorporate (form a company)
- Intensive 3-month commitment
- Highly competitive (1-3% acceptance)

### How Funding Works:

```
1. You apply with your app + pitch
2. If accepted, you get $500K
3. You give them 7% of your company
4. They help you grow for 3 months
5. You pitch to investors at Demo Day
6. You raise more money (Series A) or bootstrap

The $500K is NOT free money:
- If your company is worth $10M later, their 7% = $700K
- If you sell for $100M, their 7% = $7M
- They're betting on your success
```

### Other Funding Options:

| Source | Amount | Equity | Effort |
|--------|--------|--------|--------|
| **YC** | $500K | 7% | Very high |
| **Angel investors** | $25-100K | 5-15% | Medium |
| **Indie hackers** | Bootstrap | 0% | High |
| **Grants** | $10-50K | 0% | Medium |
| **Crowdfunding** | Varies | 0% | High |

### My Recommendation for You:

1. **Launch on Product Hunt first** (free visibility)
2. **Get 1,000+ users** (traction = leverage)
3. **Apply to YC** with real numbers
4. **Meanwhile**: Revenue from Premium subscriptions

---

## 📱 Push Notifications Explained

### What are they?

Push notifications = Messages that pop up on phone even when app is closed.

**Web-only limitation**:
- Web apps CAN do push notifications (via Service Workers)
- BUT user must keep browser open or install as PWA
- Native apps (iOS/Android) do it better

### Current workaround:

```
Web: User must have tab open for real-time updates
     OR install as PWA (Progressive Web App)

Future: React Native app → Real push via FCM/APNs
```

### Adding PWA Support (Quick Win):

Already partially implemented! Users can "Add to Home Screen" and get:
- App icon on phone
- Offline access
- Better notifications

---

## 🎵 Spotify Rate Limits Explained

### Per App, Not Per User!

```
Your Spotify App (Resonance) gets:
- 180 requests per minute TOTAL
- Shared across ALL your users

NOT per user!
```

### The Math:

| Users Live | Polling (30s) | Requests/min | Status |
|------------|---------------|--------------|--------|
| 10 | 2 per user | 20/min | ✅ Fine |
| 50 | 2 per user | 100/min | ✅ Fine |
| 90 | 2 per user | 180/min | ⚠️ At limit |
| 100+ | 2 per user | 200+/min | ❌ Rate limited |

### How to Handle:

1. **Request Extended Quota** (FREE)
   - Go to: Spotify Developer Dashboard
   - Your app → Request Extension
   - Explain your use case
   - They approve for production apps

2. **Optimize Polling**
   - Current: Poll every 30s
   - Smarter: Poll active users more, idle less
   
3. **Batch Requests**
   - Get multiple users' data in fewer calls

### Requesting Higher Limits:

1. Go to [developer.spotify.com](https://developer.spotify.com)
2. Dashboard → Your App → "Request Extension"
3. Fill form explaining:
   - "Social music discovery app"
   - "Need higher limits for X users"
4. Usually approved in 1-2 weeks

---

## 📊 Capacity Planning Summary

| Live Users | Can Handle? | Requirements |
|------------|-------------|--------------|
| 0-100 | ✅ Yes | Free tier everything |
| 100-500 | ✅ Yes | Add Redis ($0-10/mo) |
| 500-1000 | ⚠️ Maybe | Redis + optimize queries |
| 1000-5000 | ❌ Scale needed | 2 instances + Spotify quota |
| 5000+ | ❌ Scale needed | 3+ instances + DB upgrade |

### Your Next Steps:

1. ✅ Fix TimeCapsule (done)
2. ✅ Run SQL script (done)
3. 🔄 Add Upstash Redis (5 min)
4. 🔄 Request Spotify quota extension
5. 🔄 Launch and monitor

---

## 🚀 TL;DR Answers

| Question | Answer |
|----------|--------|
| Will 1000 people nearby crash app? | No, nearby is just a filter |
| What's a "live user"? | Anyone connected globally |
| When do I need scaling? | 500+ concurrent WebSocket connections |
| Does scaling break UX? | No, users don't notice |
| Is YC money free? | No, they take 7% equity |
| Product Hunt gives money? | No, just visibility |
| Spotify limit per user? | No, per YOUR APP total |
| How to increase Spotify limit? | Request extension (free) |
