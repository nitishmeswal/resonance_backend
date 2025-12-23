# Resonance Production Architecture - Geospatial & Real-time Systems

## 🔴 Current Problems (Why It's Broken)

### Problem 1: Map Direction Glitching
**Symptom:** User appears in random directions (front, back, side) and jumps around
**Root Cause:** Frontend uses `Math.random() * 360` for angle instead of real bearing calculation

```javascript
// CURRENT (BROKEN) - Feed.tsx line 425
angle: Math.random() * 360, // Random angle - THIS IS FAKE!
```

**Fix Required:** Calculate real bearing from GPS coordinates of both users.

### Problem 2: Notifications Not Working
**Symptom:** Sending vibes from Mobile doesn't appear on Desktop
**Root Cause:** WebSocket events aren't being properly broadcast to target user's socket

### Problem 3: O(n) Database Scan - Won't Scale
**Current Implementation:**
```typescript
// Gets ALL live users, then loops through EACH to calculate distance
const liveStatuses = await this.liveStatusRepository.find({ where: { isLive: true } });
for (const status of liveStatuses) { // O(n) loop
  // Calculate distance for EACH user
}
```

**At 10,000 users:** This loops 10,000 times per request = **server dies**

### Problem 4: Mock Data Everywhere
- Stats (Tracks shared, Connections, Match rate) = hardcoded 0
- Match percentage = `Math.random() * 40 + 60`
- Vibe cards data = mock

---

## ✅ Production Solution: Redis GEO + Geohash + WebSocket Pub/Sub

### Industry Standard Approaches

| App | Technology | How It Works |
|-----|------------|--------------|
| **Uber** | Google S2 Geometry | Divides Earth into cells, indexes drivers by cell |
| **Tinder** | Redis GEO | `GEOADD` to store, `GEORADIUS` for nearby lookup |
| **Pokemon GO** | S2 + Quadtree | Hierarchical spatial index |
| **Yelp** | PostGIS | PostgreSQL extension for geospatial queries |

### Our Stack: Redis GEO (Best for Real-time)

**Why Redis GEO?**
- O(log(n) + m) complexity (n = total users, m = results)
- In-memory = microsecond latency
- Built-in `GEORADIUS` command
- Already have Redis in our stack

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Mobile/Web)                       │
├─────────────────────────────────────────────────────────────────┤
│  GPS Location → Geohash → WebSocket → Backend                    │
│  Compass Heading → Real bearing calculation                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (NestJS)                             │
├─────────────────────────────────────────────────────────────────┤
│  1. Receive location update                                      │
│  2. Store in Redis GEO: GEOADD users:live <lng> <lat> <userId>  │
│  3. Query nearby: GEORADIUS users:live <lng> <lat> <radius> km  │
│  4. Broadcast updates via WebSocket pub/sub                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        REDIS                                     │
├─────────────────────────────────────────────────────────────────┤
│  GEO Set: users:live                                            │
│    - GEOADD users:live 77.2090 28.6139 "user123"               │
│    - GEORADIUS users:live 77.2090 28.6139 5 km WITHDIST        │
│                                                                  │
│  Pub/Sub Channels:                                               │
│    - location:updates                                            │
│    - notifications:<userId>                                      │
│    - reactions:<userId>                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Redis GEO for Nearby Users (Backend)

```typescript
// NEW: Redis GEO Service
class RedisGeoService {
  // Store user location in Redis GEO
  async setUserLocation(userId: string, lat: number, lng: number) {
    await this.redis.geoadd('users:live', lng, lat, userId);
    await this.redis.expire('users:live:' + userId, 300); // 5 min TTL
  }

  // Get nearby users in O(log n) time
  async getNearbyUsers(lat: number, lng: number, radiusKm: number) {
    return this.redis.georadius(
      'users:live',
      lng, lat,
      radiusKm, 'km',
      'WITHDIST', 'WITHCOORD', 'ASC', 'COUNT', 50
    );
  }

  // Remove user when they go offline
  async removeUser(userId: string) {
    await this.redis.zrem('users:live', userId);
  }
}
```

### Phase 2: Real Bearing Calculation (Frontend)

```typescript
// Calculate real bearing between two GPS coordinates
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  
  let θ = Math.atan2(y, x);
  θ = θ * 180 / Math.PI; // Convert to degrees
  return (θ + 360) % 360; // Normalize to 0-360
}

// Combine with device compass heading for relative direction
function getRelativeDirection(bearing: number, compassHeading: number): number {
  return (bearing - compassHeading + 360) % 360;
}
```

### Phase 3: WebSocket Pub/Sub for Real-time (Backend)

```typescript
// When user sends a reaction
async sendReaction(senderId: string, receiverId: string, type: string) {
  // Save to database
  await this.reactionRepo.save({ senderId, receiverId, type });
  
  // Publish to Redis channel for target user
  await this.redis.publish(`notifications:${receiverId}`, JSON.stringify({
    type: 'reaction',
    from: senderId,
    reactionType: type,
    timestamp: Date.now()
  }));
}

// WebSocket gateway subscribes to user's channel
async handleConnection(socket: Socket, userId: string) {
  // Subscribe to this user's notification channel
  const subscriber = this.redis.duplicate();
  await subscriber.subscribe(`notifications:${userId}`);
  
  subscriber.on('message', (channel, message) => {
    socket.emit('notification', JSON.parse(message));
  });
}
```

### Phase 4: Real Data Endpoints (Backend)

```typescript
// GET /users/me/stats - Real stats from database
async getUserStats(userId: string) {
  const tracksShared = await this.trackRepo.count({ where: { userId } });
  const connections = await this.connectionRepo.count({ where: { userId } });
  const reactions = await this.reactionRepo.count({ where: { receiverId: userId } });
  const capsules = await this.capsuleRepo.count({ where: { creatorId: userId } });
  
  return { tracksShared, connections, reactions, capsules };
}
```

---

## Database Schema Updates

```sql
-- Add indexes for geospatial queries
CREATE INDEX idx_location_lat_lng ON location_snapshots 
  USING GIST (point(latitude, longitude));

-- Or use PostGIS for advanced geospatial
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER TABLE location_snapshots ADD COLUMN location GEOGRAPHY(POINT);
CREATE INDEX idx_location_geo ON location_snapshots USING GIST(location);
```

---

## Frontend Requirements

### What Frontend Needs to Send:
1. **Precise GPS coordinates** (lat, lng) - not just geohash
2. **Device compass heading** (for relative direction)
3. **User's current timestamp** (for freshness)

### What Backend Will Return:
```typescript
interface NearbyUser {
  userId: string;
  displayName: string;
  avatarUrl: string;
  distanceMeters: number;      // Real distance
  bearing: number;             // Real direction (0-360°)
  currentTrack?: {
    name: string;
    artist: string;
    albumArt: string;
  };
  lastSeen: Date;              // For freshness
}
```

### Frontend Changes Required:
1. Store raw lat/lng, not just geohash
2. Get compass heading from DeviceOrientationEvent
3. Calculate relative angle using bearing + compass
4. Display user in correct direction on radar

---

## Performance Comparison

| Approach | 100 users | 10,000 users | 1M users |
|----------|-----------|--------------|----------|
| **Current (O(n) loop)** | 10ms | 1,000ms | 100,000ms ❌ |
| **Redis GEO** | 1ms | 5ms | 50ms ✅ |
| **PostGIS** | 5ms | 20ms | 200ms ✅ |

---

## Implementation Order

1. **Backend: Redis GEO Service** - Store/query locations efficiently
2. **Backend: Fix WebSocket Notifications** - Pub/sub for reactions
3. **Backend: Real Stats API** - Replace mock data
4. **Frontend: Compass + Bearing** - Real direction calculation
5. **Frontend: Call new APIs** - Use real data

---

## Files to Create/Modify

### Backend:
- `src/modules/geo/geo.service.ts` - NEW: Redis GEO operations
- `src/modules/geo/geo.module.ts` - NEW: Module definition
- `src/modules/presence/presence.service.ts` - Use Redis GEO
- `src/modules/realtime/realtime.gateway.ts` - Fix notification pub/sub
- `src/modules/users/users.service.ts` - Real stats queries

### Frontend (for your frontend dev):
- `src/hooks/useLocation.ts` - Send lat/lng, not just geohash
- `src/hooks/useCompass.ts` - NEW: Get device compass heading
- `src/components/ProximityMap.tsx` - Use real bearing calculation
- `src/lib/api.ts` - Call new endpoints
- `src/contexts/AuthContext.tsx` - Handle real-time notifications
