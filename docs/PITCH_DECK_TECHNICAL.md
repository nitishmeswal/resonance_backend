# 🛠️ RESONANCE - Technical Architecture Deck

## Overview
Resonance is a real-time, location-based music social discovery platform that connects people through their live listening activity.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI Framework |
| **TypeScript** | Type Safety |
| **Vite** | Build Tool (fast HMR) |
| **TailwindCSS** | Styling |
| **Framer Motion** | Animations |
| **Socket.IO Client** | Real-time Updates |
| **TanStack Query** | Data Fetching |
| **Shadcn/ui** | Component Library |

### Backend
| Technology | Purpose |
|------------|---------|
| **NestJS** | API Framework |
| **TypeScript** | Type Safety |
| **PostgreSQL** | Primary Database |
| **Supabase** | Managed Postgres + Auth |
| **Redis** | Caching & Presence |
| **Socket.IO** | WebSocket Server |
| **JWT** | Authentication |

### External APIs
| Service | Purpose |
|---------|---------|
| **Spotify Web API** | OAuth, Current Track, Audio Features |
| **Geohash** | Privacy-preserving location encoding |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT (React + Vite)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  REST API   │  │  WebSocket  │  │  Geolocation API        │ │
│  │  (Axios)    │  │  (Socket.IO)│  │  (Browser)              │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (NestJS)                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   API Gateway (:3000)                      │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐  │ │
│  │  │  Auth   │ │Presence │ │Location │ │    Realtime     │  │ │
│  │  │ Module  │ │ Module  │ │ Module  │ │    Gateway      │  │ │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────────┬────────┘  │ │
│  └───────┼───────────┼───────────┼───────────────┼───────────┘ │
│          ▼           ▼           ▼               ▼             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Service Layer                           │ │
│  │  • SpotifyService    • PresenceService   • LocationService │ │
│  │  • AuthService       • FindService       • NotifyService   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌─────────────────────┐              ┌─────────────────────┐
│   PostgreSQL        │              │      Redis          │
│   (Supabase)        │              │   (In-Memory)       │
│                     │              │                     │
│ • users             │              │ • presence:user:*   │
│ • spotify_tokens    │              │ • geohash:*         │
│ • live_status       │              │ • socket:user:*     │
│ • current_tracks    │              │ • find:session:*    │
│ • notifications     │              │ • rate_limit:*      │
│ • user_stats        │              │                     │
└─────────────────────┘              └─────────────────────┘
          │
          ▼
┌─────────────────────┐
│   Spotify Web API   │
│ • /me/player        │
│ • /audio-features   │
│ • OAuth 2.0         │
└─────────────────────┘
```

---

## Database Schema

### Core Tables
```sql
users                 -- User profiles from Spotify
spotify_tokens        -- OAuth tokens (encrypted)
live_status          -- Live/offline status, settings
current_tracks       -- What users are playing NOW
location_snapshots   -- Geohash locations (privacy-first)
find_sessions        -- "Find Listener" game sessions
notifications        -- Real-time notifications
user_stats           -- Activity tracking
connections          -- User matches
reactions            -- Vibe reactions between users
```

### Key Relationships
- `users` 1:1 `spotify_tokens`
- `users` 1:1 `live_status`
- `users` 1:1 `current_tracks`
- `users` 1:N `notifications`
- `users` 1:1 `user_stats`

---

## Real-Time Architecture

### WebSocket Events
```typescript
// Client → Server
'user:go_live'           // Start broadcasting presence
'user:go_offline'        // Stop broadcasting
'user:update_track'      // Track changed
'user:update_location'   // Location updated
'user:heartbeat'         // Keep-alive (every 15s)
'find:start'             // Start find session
'find:update_location'   // Update find proximity
'find:end'               // End find session

// Server → Client
'connected'              // Connection established
'live:user_joined'       // New user nearby
'live:user_left'         // User went offline
'live:track_update'      // Someone's track changed
'live:nearby_users'      // List of nearby users
'find:bucket_update'     // Proximity: far/warm/close/found
'notification:new'       // New notification
```

---

## Security Measures

| Layer | Implementation |
|-------|----------------|
| **Authentication** | JWT with Spotify OAuth 2.0 |
| **Token Storage** | HttpOnly cookies (production) |
| **API Rate Limiting** | NestJS Throttler (100 req/min) |
| **Location Privacy** | Geohash truncation (~150m precision) |
| **CORS** | Strict origin validation |
| **Input Validation** | class-validator DTOs |
| **SQL Injection** | TypeORM parameterized queries |

---

## Scalability Considerations

### Current (MVP)
- Single NestJS instance
- Supabase managed Postgres
- In-memory Redis fallback
- ~100 concurrent users

### Production Scale
- Horizontal scaling with PM2/Kubernetes
- Redis Cluster for presence
- PostgreSQL read replicas
- CDN for static assets
- WebSocket sticky sessions

---

## Performance Optimizations

| Feature | Optimization |
|---------|--------------|
| **Presence** | Redis TTL-based expiry |
| **Location** | Geohash spatial indexing |
| **Polling** | 30s Spotify API interval |
| **Caching** | Query result caching |
| **WebSocket** | Room-based broadcasting |

---

## Deployment Options

### Development
```bash
# Backend
npm run start:dev  # Hot reload on :3000

# Frontend
npm run dev        # Vite on :8080
```

### Production
- **Backend**: Railway, Render, or AWS ECS
- **Frontend**: Vercel, Netlify, or Cloudflare Pages
- **Database**: Supabase (managed)
- **Redis**: Upstash or Redis Cloud

---

## API Endpoints Summary

| Module | Endpoints | Auth |
|--------|-----------|------|
| `/auth` | OAuth, profile, refresh | Mixed |
| `/presence` | Live/offline, settings | JWT |
| `/location` | Update, nearby users | JWT |
| `/find` | Start/end sessions | JWT |
| `/notifications` | CRUD, mark read | JWT |
| `/users` | Profile, stats | JWT |
| `/spotify` | Current track | JWT |
| `/health` | Status check | Public |

---

## Monitoring & Observability

- **Logging**: NestJS Logger (structured)
- **Health Checks**: `/api/v1/health`
- **Error Tracking**: Ready for Sentry integration
- **Metrics**: Ready for Prometheus/Grafana

---

## Future Technical Roadmap

1. **Mobile Apps** - React Native
2. **AI Matching** - ML-based taste similarity
3. **Audio Analysis** - Real-time BPM/mood detection
4. **Push Notifications** - FCM/APNs
5. **Offline Mode** - Service workers
