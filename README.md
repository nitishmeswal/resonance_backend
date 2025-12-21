# Resonance Backend

Production-ready backend for **Resonance** - a real-time social music application that connects people through shared listening experiences.

## 🎵 Overview

Resonance enables users to:
- **Go Live** - Share their presence and what they're listening to
- **Discover Nearby** - Find other live listeners in their vicinity
- **Find Listener** - Navigate towards someone playing a specific track
- **Vibe Match** - Connect with people listening to similar music

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React Native)                 │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐    ┌───────────┐    ┌─────────┐
        │  REST   │    │ WebSocket │    │ Spotify │
        │  API    │    │  Gateway  │    │   SDK   │
        └────┬────┘    └─────┬─────┘    └────┬────┘
             │               │               │
┌────────────┴───────────────┴───────────────┴────────────────┐
│                      NestJS Backend                          │
├──────────────────────────────────────────────────────────────┤
│  Auth   │  Users  │  Presence  │  Location  │  Find  │ Spotify│
└────────────────────────────────────────────────────────────┘
              │               │               │
        ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
        │ PostgreSQL│   │   Redis   │   │  Spotify  │
        │ (Supabase)│   │           │   │    API    │
        └───────────┘   └───────────┘   └───────────┘
```

## 🚀 Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS
- **Database**: PostgreSQL (Supabase-compatible)
- **Cache**: Redis
- **Realtime**: WebSockets (Socket.IO)
- **Auth**: Spotify OAuth + JWT

## 📁 Project Structure

```
src/
├── main.ts                    # Application entry point
├── app.module.ts              # Root module
├── database/
│   ├── entities/              # TypeORM entities
│   ├── migrations/            # Database migrations
│   └── data-source.ts         # TypeORM config
└── modules/
    ├── auth/                  # Spotify OAuth & JWT
    ├── users/                 # User management
    ├── spotify/               # Spotify API integration
    ├── presence/              # Live status system
    ├── location/              # Geohash proximity
    ├── find/                  # Find Listener feature
    ├── realtime/              # WebSocket gateway
    ├── redis/                 # Redis service
    └── health/                # Health checks
```

## 🛠️ Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (or Supabase account)
- Redis
- Spotify Developer Account

### Installation

```bash
# Clone the repository
cd resonance-backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your credentials
```

### Environment Variables

```env
# Application
NODE_ENV=development
PORT=3000

# Database (Supabase)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Spotify
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_CALLBACK_URL=http://localhost:3000/api/v1/auth/spotify/callback

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRATION=7d

# Frontend
FRONTEND_URL=http://localhost:3001
```

### Database Setup

Run the migration SQL in your Supabase SQL editor:

```bash
# Located at:
src/database/migrations/001-initial-schema.sql
```

### Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## 📡 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/spotify` | Initiate Spotify OAuth |
| GET | `/auth/spotify/callback` | OAuth callback |
| GET | `/auth/me` | Get current user |

### Presence
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/presence/live` | Go live |
| POST | `/presence/offline` | Go offline |
| PATCH | `/presence/settings` | Update settings |
| POST | `/presence/heartbeat` | Send heartbeat |
| GET | `/presence/live-users` | Get all live users |

### Location
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/location/update` | Update location |
| GET | `/location/nearby` | Get nearby users |
| DELETE | `/location` | Remove location |

### Find
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/find/start` | Start Find session |
| GET | `/find/active` | Get active session |
| POST | `/find/:id/complete` | Complete session |
| DELETE | `/find/:id` | Cancel session |

### Spotify
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/spotify/currently-playing` | Get current track |
| POST | `/spotify/refresh` | Force refresh track |

## 🔌 WebSocket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `user:go_live` | - | Go live |
| `user:go_offline` | - | Go offline |
| `user:update_track` | `{ trackId, trackName, artist }` | Update track |
| `user:update_location` | `{ geohash }` | Update location |
| `user:heartbeat` | - | Heartbeat |
| `find:start` | `{ targetId }` | Start Find |
| `find:update_location` | `{ sessionId, geohash }` | Update Find location |
| `find:end` | `{ sessionId, completed }` | End Find |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ userId }` | Connection confirmed |
| `live:user_joined` | `{ userId }` | User went live nearby |
| `live:user_left` | `{ userId }` | User went offline |
| `live:track_update` | `{ userId, trackId, ... }` | Track updated |
| `live:nearby_users` | `{ users: [...] }` | Nearby users list |
| `find:request_received` | `{ sessionId, seekerId }` | Someone started Find |
| `find:bucket_update` | `{ sessionId, bucket }` | Distance bucket changed |
| `find:session_ended` | `{ sessionId, status }` | Find session ended |

## 🔒 Security

- **Rate Limiting**: Configurable per-endpoint limits
- **JWT Auth**: Secure token-based authentication
- **Geohash Privacy**: No raw GPS coordinates stored
- **Consent-First**: Nothing shared without explicit user action
- **Kill Switch**: Instant visibility toggle

## 🎯 Spotify Compliance

This app follows Spotify Developer Guidelines:
- ✅ User-authenticated access only
- ✅ Explicit opt-in to share
- ✅ No background tracking
- ✅ No permanent history storage
- ✅ User can disable at any time

## 📊 Scaling

For production deployment:

1. **Database**: Use Supabase connection pooling
2. **Redis**: Use Redis Cluster for HA
3. **WebSockets**: Use Redis adapter for multi-instance
4. **Polling**: Implement job queues (Bull)

## 📝 License

MIT

---

Built with ❤️ for music lovers
