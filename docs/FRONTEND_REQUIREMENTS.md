# Frontend Requirements for Resonance v1

## 🔴 Critical Changes Required

### 1. Map Direction Fix (User Jumping Around)

**Current Problem:** You use `Math.random() * 360` for angle - that's why users jump around randomly.

**Solution:** Use the `bearing` field from backend response:

```typescript
// OLD (BROKEN) - Feed.tsx line 425
angle: Math.random() * 360, // ❌ FAKE!

// NEW (FIXED) - Use bearing from backend
angle: user.bearing, // ✅ Real direction (0-360°, 0 = North)
```

**Backend now returns:**
```typescript
interface NearbyUser {
  userId: string;
  displayName: string;
  distanceMeters: number;
  bearing: number;        // ← NEW: Real direction from you to this user (0-360°)
  latitude: number;       // ← NEW: For additional calculations
  longitude: number;      // ← NEW: For additional calculations
  currentTrack?: {...};
}
```

---

### 2. Use New Geo API Endpoint

**Old endpoint:** `GET /api/v1/presence/live-users` (returns ALL users globally)

**New endpoint:** `GET /api/v1/geo/nearby?latitude=X&longitude=Y&radiusKm=5`

**Update `src/lib/api.ts`:**
```typescript
export const geoApi = {
  updateLocation: (latitude: number, longitude: number) =>
    apiRequest<{ success: boolean }>('/geo/location', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude }),
    }),
  
  getNearbyUsers: (latitude: number, longitude: number, radiusKm?: number) =>
    apiRequest<NearbyUsersResponse>(`/geo/nearby?latitude=${latitude}&longitude=${longitude}&radiusKm=${radiusKm || 5}`),
};

interface NearbyUsersResponse {
  count: number;
  radiusKm: number;
  users: NearbyUserWithDetails[];
}

interface NearbyUserWithDetails {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
  distanceMeters: number;
  bearing: number;           // Direction from you to them (0-360°)
  latitude: number;
  longitude: number;
  currentTrack?: {
    trackName: string;
    artist: string;
    albumArt: string | null;
  } | null;
  lastActive: Date | null;
}
```

---

### 3. Use New WebSocket Events

**Update `src/lib/socket.ts`:**

```typescript
// Send location with lat/lng (not just geohash)
updateLocationGeo(latitude: number, longitude: number, radiusKm?: number) {
  this.socket?.emit('user:update_location_geo', { latitude, longitude, radiusKm });
}

// Listen for nearby users with bearing data
onNearbyUsersGeo(callback: (data: { users: NearbyUserWithDetails[], timestamp: number }) => void) {
  this.socket?.on('live:nearby_users_geo', callback);
}

// Send reaction via WebSocket (faster than HTTP)
sendReaction(targetUserId: string, reactionType: string) {
  this.socket?.emit('reaction:send', { targetUserId, reactionType });
}

// Listen for incoming reactions
onReactionReceived(callback: (data: { senderId: string, type: string, timestamp: number }) => void) {
  this.socket?.on('reaction:received', callback);
}
```

---

### 4. Send Raw Lat/Lng (Not Just Geohash)

**Update `src/hooks/useLocation.ts`:**

```typescript
// Store raw coordinates
const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

const handlePosition = useCallback((position: GeolocationPosition) => {
  const { latitude, longitude } = position.coords;
  
  // Store raw coords for bearing calculation
  setCoords({ lat: latitude, lng: longitude });
  
  // Send to backend with lat/lng
  geoApi.updateLocation(latitude, longitude);
  
  // Also update via WebSocket for real-time
  socketClient.updateLocationGeo(latitude, longitude);
}, []);

// Export coords for use in map
return { ...state, coords };
```

---

### 5. Compass Integration for Relative Direction

**Create `src/hooks/useCompass.ts`:**

```typescript
import { useState, useEffect } from 'react';

export function useCompass() {
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!window.DeviceOrientationEvent) {
      setError('Compass not supported');
      return;
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      // alpha = compass heading (0-360, 0 = North)
      if (event.alpha !== null) {
        setHeading(event.alpha);
      }
    };

    // Request permission on iOS 13+
    if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
      (DeviceOrientationEvent as any).requestPermission()
        .then((permission: string) => {
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        });
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, []);

  // Calculate relative direction: where user appears on YOUR screen
  const getRelativeDirection = (bearing: number): number => {
    if (heading === null) return bearing;
    return (bearing - heading + 360) % 360;
  };

  return { heading, error, getRelativeDirection };
}
```

---

### 6. Fix ProximityMap to Use Real Bearing

**Update `src/components/ProximityMap.tsx`:**

```typescript
import { useCompass } from '@/hooks/useCompass';

const ProximityMap = ({ users, radiusKm, onSelectUser }) => {
  const { getRelativeDirection } = useCompass();
  
  return (
    <div className="relative">
      {users.map(user => {
        // Use real bearing from backend, adjusted for device orientation
        const relativeAngle = getRelativeDirection(user.bearing);
        
        // Convert distance to pixel position
        const maxRadius = 150; // pixels
        const distanceRatio = Math.min(user.distanceMeters / (radiusKm * 1000), 1);
        const pixelDistance = distanceRatio * maxRadius;
        
        // Convert angle to x,y position
        const angleRad = (relativeAngle - 90) * Math.PI / 180; // -90 because CSS 0° is right, not up
        const x = Math.cos(angleRad) * pixelDistance;
        const y = Math.sin(angleRad) * pixelDistance;
        
        return (
          <div
            key={user.userId}
            className="absolute user-dot"
            style={{
              transform: `translate(${x}px, ${y}px)`,
              // Position from center of map
            }}
          />
        );
      })}
    </div>
  );
};
```

---

### 7. Listen for Real-time Notifications

**Update `src/contexts/AuthContext.tsx` or create notification handler:**

```typescript
useEffect(() => {
  if (!isAuthenticated) return;

  // Listen for reactions
  socketClient.on('reaction:received', (data) => {
    toast.success(`${data.type} from someone nearby!`);
    // Optionally fetch updated notifications
    loadNotifications();
  });

  // Listen for nearby user updates
  socketClient.on('live:nearby_users_geo', (data) => {
    setNearbyUsers(data.users);
  });

  return () => {
    socketClient.off('reaction:received');
    socketClient.off('live:nearby_users_geo');
  };
}, [isAuthenticated]);
```

---

### 8. Replace Mock Stats with Real API

**Update `src/pages/Profile.tsx`:**

```typescript
// Fetch real stats from backend
const [stats, setStats] = useState<UserStats | null>(null);

useEffect(() => {
  const loadStats = async () => {
    const data = await statsApi.getMyStats();
    setStats(data);
  };
  loadStats();
}, []);

// Use real data, not hardcoded
<div>{stats?.tracksShared || 0} Tracks shared</div>
<div>{stats?.connections || 0} Connections</div>
```

---

## Summary of API Changes

| Old | New | Purpose |
|-----|-----|---------|
| `GET /presence/live-users` | `GET /geo/nearby?lat=X&lng=Y` | Get nearby users with bearing |
| `POST /location/update` (geohash) | `POST /geo/location` (lat/lng) | Update location in Redis GEO |
| WebSocket `user:update_location` | WebSocket `user:update_location_geo` | Real-time location with lat/lng |
| — | WebSocket `reaction:send` | Send reaction via WebSocket |
| — | WebSocket `reaction:received` | Receive reactions in real-time |
| — | WebSocket `live:nearby_users_geo` | Get nearby users with bearing |

---

## Files to Modify

1. **`src/lib/api.ts`** - Add `geoApi` with new endpoints
2. **`src/lib/socket.ts`** - Add new WebSocket events
3. **`src/hooks/useLocation.ts`** - Send lat/lng, expose coords
4. **`src/hooks/useCompass.ts`** - NEW: Get device compass heading
5. **`src/pages/Feed.tsx`** - Use new geo API, real bearing
6. **`src/components/ProximityMap.tsx`** - Use real bearing + compass
7. **`src/contexts/AuthContext.tsx`** - Listen for real-time events
8. **`src/pages/Profile.tsx`** - Use real stats API
