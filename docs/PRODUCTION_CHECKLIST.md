# 🚀 Resonance Production Checklist

## ✅ Time Capsule Feature - DONE
Run this SQL in Supabase: `sql/add_time_capsules.sql`

---

## 1. HTTPS Setup (Required for Location)

### Option A: Vercel/Netlify (Frontend) - FREE
Both auto-provision HTTPS certificates.

### Option B: Railway/Render (Backend) - FREE
Both provide HTTPS by default on their domains.

### Option C: Custom Domain
```bash
# Use Cloudflare (free) for SSL
# 1. Add domain to Cloudflare
# 2. Set SSL mode to "Full"
# 3. Enable "Always Use HTTPS"
```

---

## 2. Environment Variables for Production

### Backend (.env.production)
```env
# Server
NODE_ENV=production
PORT=3000

# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# JWT
JWT_SECRET=<generate-64-char-random-string>
JWT_EXPIRES_IN=7d

# Spotify (same as dev, but update redirect URI)
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=https://your-backend.com/api/v1/auth/spotify/callback

# Frontend URL
FRONTEND_URL=https://your-frontend.com

# Redis (Upstash or Redis Cloud)
REDIS_URL=redis://default:password@your-redis-url:6379

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=100
```

### Frontend (.env.production)
```env
VITE_API_URL=https://your-backend.com/api/v1
VITE_SOCKET_URL=https://your-backend.com
```

---

## 3. Error Monitoring (Sentry)

### Backend Setup
```bash
npm install @sentry/node
```

```typescript
// main.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Frontend Setup
```bash
npm install @sentry/react
```

```typescript
// main.tsx
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
});
```

**Cost**: FREE for 5K errors/month

---

## 4. Redis Cloud Setup

### Option A: Upstash (Recommended)
- **Free tier**: 10K commands/day
- **URL format**: `rediss://default:password@endpoint.upstash.io:6379`

### Option B: Redis Cloud
- **Free tier**: 30MB
- **URL format**: `redis://default:password@redis-xxxxx.c1.us-east-1-2.ec2.cloud.redislabs.com:xxxxx`

### Update .env
```env
REDIS_URL=rediss://default:your_password@your-endpoint.upstash.io:6379
```

---

## 5. Rate Limiting Fine-Tuning

### Current Settings (Good for MVP)
```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60,      // 60 seconds window
  limit: 100,   // 100 requests per window
}])
```

### Production Recommendations
```typescript
// Per-endpoint limits
@Throttle({ default: { limit: 10, ttl: 60 } })  // 10/min for sensitive
@Throttle({ default: { limit: 50, ttl: 60 } })  // 50/min for normal
```

| Endpoint | Recommended Limit |
|----------|------------------|
| `/auth/*` | 10/min |
| `/presence/*` | 30/min |
| `/location/*` | 60/min |
| `/capsules/*` | 20/min |
| `/notifications/*` | 30/min |

---

## 📊 Hosting Costs Analysis

### Minimum Viable (FREE - $0/month)

| Service | Provider | Cost |
|---------|----------|------|
| Frontend | Vercel | FREE |
| Backend | Railway | FREE (500 hours) |
| Database | Supabase | FREE (500MB) |
| Redis | Upstash | FREE (10K/day) |
| **TOTAL** | | **$0/month** |

### Growth Stage (~$50/month)

| Service | Provider | Cost |
|---------|----------|------|
| Frontend | Vercel Pro | $20/mo |
| Backend | Railway Pro | $5-20/mo |
| Database | Supabase Pro | $25/mo |
| Redis | Upstash Pro | $10/mo |
| **TOTAL** | | **~$55/month** |

### Scale Stage (~$200/month)

| Service | Provider | Cost |
|---------|----------|------|
| Frontend | Vercel Pro | $20/mo |
| Backend | Railway (2 instances) | $40/mo |
| Database | Supabase Pro | $25/mo |
| Redis | Upstash Pro | $20/mo |
| CDN | Cloudflare Pro | $20/mo |
| Monitoring | Sentry Team | $26/mo |
| **TOTAL** | | **~$150/month** |

---

## ⚡ Will 10K Users Crash Your Server?

### Current Capacity (Single Instance)

| Metric | Limit | Notes |
|--------|-------|-------|
| Concurrent WebSockets | ~500-1000 | NestJS + Socket.IO |
| REST requests/sec | ~200-500 | With caching |
| Database connections | 20 (Supabase free) | Pooled |

### For 10K Users

| Scenario | Will Crash? | Fix |
|----------|-------------|-----|
| 10K registered, 100 live | ✅ OK | No changes needed |
| 10K registered, 500 live | ⚠️ Maybe | Add Redis caching |
| 10K registered, 1000 live | ❌ Yes | Need horizontal scaling |

### Scaling Solutions

1. **Add Redis caching** (presence, live users)
2. **Horizontal scaling** (2-3 backend instances)
3. **Database read replicas** (Supabase Pro)
4. **WebSocket load balancing** (sticky sessions)

### Recommended for 10K Users
```
- 2x Backend instances ($20/mo each)
- Supabase Pro ($25/mo)
- Redis with 1GB ($20/mo)
- Total: ~$85/month
```

---

## 🚧 Current App Restrictions & Barriers

### Technical Limitations

| Limitation | Impact | Future Fix |
|------------|--------|------------|
| **Spotify only** | Limits to 574M users | Add Apple Music |
| **Web only** | No push notifications | Mobile apps |
| **Browser location** | Less accurate than GPS | Mobile native |
| **30s polling** | Track updates delayed | Webhook (if Spotify adds) |
| **Single region** | Latency for far users | Multi-region deploy |

### Spotify API Limits

| Limit | Value | Impact |
|-------|-------|--------|
| Rate limit | 180 req/min | Limits concurrent users |
| Token refresh | Every hour | Background job handles |
| Audio features | Limited calls | Batch requests |
| No webhooks | Must poll | 30s delay on tracks |

### Privacy Constraints

| Constraint | Why | Mitigation |
|------------|-----|------------|
| Location permission | Users may deny | Show value proposition |
| ~150m precision | Privacy trade-off | Good enough for discovery |
| No exact addresses | By design | Geohash only |

### Business Constraints

| Constraint | Impact | Solution |
|------------|--------|----------|
| Spotify TOS | Can't monetize API data | Premium features only |
| GDPR compliance | EU user data handling | Add data export/delete |
| Age verification | Needed for some regions | Add birthdate check |

---

## 🎯 Areas to Improve

### High Priority
1. **Mobile apps** - iOS/Android for better UX
2. **Apple Music** - Double potential users
3. **Push notifications** - Re-engagement
4. **Offline mode** - Service workers

### Medium Priority
1. **AI matching** - Better taste similarity
2. **Chat/messaging** - Direct communication
3. **Group features** - Jam sessions with 3+ people
4. **Event integration** - Concert discovery

### Low Priority
1. **Playlist export** - Save blends to Spotify
2. **Listening stats** - Wrapped-style reports
3. **Achievement badges** - Gamification
4. **Dark/light themes** - Already dark
