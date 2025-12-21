# 🗄️ Resonance Database Schema

## Complete Database Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RESONANCE DATABASE                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│      users       │       │   spotify_tokens │       │   live_status    │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │◄──────│ user_id (FK)     │       │ id (PK)          │
│ spotify_id       │       │ access_token     │       │ user_id (FK)─────┼──►users.id
│ display_name     │       │ refresh_token    │       │ is_live          │
│ avatar_url       │       │ expires_at       │       │ share_track      │
│ email            │       └──────────────────┘       │ allow_find       │
│ is_anonymous     │                                  │ radius_km ✨NEW  │
│ instagram_handle │ ✨NEW                            │ last_active      │
│ discord_handle   │ ✨NEW                            └──────────────────┘
│ radius_km        │ ✨NEW                                    
│ created_at       │                                  
│ updated_at       │                                  
└──────────────────┘                                  
        │
        │ 1:1
        ▼
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  current_tracks  │       │location_snapshots│       │  find_sessions   │
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ user_id (FK)─────┼──►    │ user_id (FK)─────┼──►    │ seeker_id (FK)───┼──►users.id
│ track_id         │       │ geohash          │       │ target_id (FK)───┼──►users.id
│ track_name       │       │ accuracy         │       │ status           │
│ artist           │       │ updated_at       │       │ started_at       │
│ album_art        │       └──────────────────┘       │ completed_at     │
│ is_playing       │                                  └──────────────────┘
│ energy           │                                  
│ valence          │                                  
└──────────────────┘                                  

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  notifications   │       │   time_capsules  │       │capsule_discoveries│
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ user_id (FK)─────┼──►    │ creator_id (FK)──┼──►    │ capsule_id (FK)──┼──►time_capsules.id
│ type             │       │ geohash          │       │ user_id (FK)─────┼──►users.id
│ title            │       │ location_name    │       │ liked            │
│ message          │       │ track_id         │       │ discovered_at    │
│ from_user_id     │       │ track_name       │       └──────────────────┘
│ is_read          │       │ artist           │
│ metadata (JSON)  │       │ album_art        │
│ created_at       │       │ message          │
└──────────────────┘       │ mood             │
                           │ visibility       │
                           │ unlock_at        │
                           │ expires_at       │
                           │ discovery_count  │
                           │ like_count       │
                           │ is_active        │
                           └──────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           ✨ NEW TABLES (Just Added)                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    reactions     │       │ listening_history│       │push_subscriptions│
├──────────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)          │       │ id (PK)          │       │ id (PK)          │
│ sender_id (FK)───┼──►    │ user_id (FK)─────┼──►    │ user_id (FK)─────┼──►users.id
│ receiver_id (FK)─┼──►    │ track_id         │       │ endpoint         │
│ type             │       │ track_name       │       │ p256dh           │
│ created_at       │       │ artist           │       │ auth             │
└──────────────────┘       │ album_art        │       │ user_agent       │
   │                       │ played_at        │       │ created_at       │
   │ UNIQUE(sender,        │ created_at       │       └──────────────────┘
   │   receiver, type)     └──────────────────┘              (OPTIONAL)
   │
   │ Reaction types:
   │ 'fire' 🔥
   │ 'heart' ❤️
   │ 'music' 🎵
   │ 'wave' 👋
   │ 'sparkle' ✨
```

---

## Table Relationships

| Parent Table | Child Table | Relationship | Description |
|--------------|-------------|--------------|-------------|
| users | spotify_tokens | 1:1 | Each user has one token |
| users | live_status | 1:1 | Each user has one status |
| users | current_tracks | 1:1 | Each user has one current track |
| users | location_snapshots | 1:1 | Each user has one location |
| users | notifications | 1:N | User receives many notifications |
| users | time_capsules | 1:N | User creates many capsules |
| users | reactions (sender) | 1:N | User sends many reactions |
| users | reactions (receiver) | 1:N | User receives many reactions |
| users | listening_history | 1:N | User has many history entries |
| users | push_subscriptions | 1:N | User has many push subscriptions |
| time_capsules | capsule_discoveries | 1:N | Capsule has many discoveries |

---

## New Columns Added

### users table
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| instagram_handle | VARCHAR(100) | NULL | User's Instagram handle |
| discord_handle | VARCHAR(100) | NULL | User's Discord handle |
| radius_km | FLOAT | 5 | Discovery radius preference |

### live_status table
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| radius_km | FLOAT | 5 | Discovery radius setting |

---

## New Tables Added

### reactions
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| sender_id | UUID | FK → users.id | Who sent the reaction |
| receiver_id | UUID | FK → users.id | Who received it |
| type | VARCHAR(20) | NOT NULL | fire/heart/music/wave/sparkle |
| created_at | TIMESTAMP | NOW() | When sent |

**Unique Constraint:** (sender_id, receiver_id, type) - One reaction type per pair

### listening_history
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK → users.id | Who listened |
| track_id | VARCHAR(255) | NOT NULL | Spotify track ID |
| track_name | VARCHAR(500) | NOT NULL | Track name |
| artist | VARCHAR(500) | NOT NULL | Artist name |
| album_art | TEXT | NULL | Album art URL |
| played_at | TIMESTAMP | NOT NULL | When played |
| created_at | TIMESTAMP | NOW() | When recorded |

### push_subscriptions (Optional)
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Unique identifier |
| user_id | UUID | FK → users.id | Subscriber |
| endpoint | TEXT | NOT NULL | Push endpoint URL |
| p256dh | TEXT | NOT NULL | Public key |
| auth | TEXT | NOT NULL | Auth secret |
| user_agent | TEXT | NULL | Browser info |
| created_at | TIMESTAMP | NOW() | When subscribed |

---

## Data Flow

```
User Opens App
      │
      ▼
┌─────────────────┐
│ Spotify OAuth   │──────► spotify_tokens (stores access/refresh)
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Go Live         │──────► live_status (is_live = true)
└─────────────────┘──────► location_snapshots (geohash updated)
      │
      ▼
┌─────────────────┐
│ Poll Spotify    │──────► current_tracks (what's playing)
└─────────────────┘──────► listening_history (track history)
      │
      ▼
┌─────────────────┐
│ See Nearby      │◄────── live_status + current_tracks + location
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Send Reaction   │──────► reactions (fire/heart/music)
└─────────────────┘──────► notifications (to receiver)
      │
      ▼
┌─────────────────┐
│ Drop Capsule    │──────► time_capsules (song + location)
└─────────────────┘
      │
      ▼
┌─────────────────┐
│ Discover Capsule│──────► capsule_discoveries (who found it)
└─────────────────┘
```

---

## Quick Reference: All Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| users | User accounts | spotify_id, display_name, socials |
| spotify_tokens | Auth tokens | access_token, refresh_token |
| live_status | Online status | is_live, share_track, radius_km |
| current_tracks | Now playing | track_name, artist, energy |
| location_snapshots | User location | geohash |
| find_sessions | Hot/cold game | seeker_id, target_id |
| notifications | User alerts | type, title, from_user_id |
| time_capsules | Song drops | geohash, track, message |
| capsule_discoveries | Who found capsules | user_id, liked |
| **reactions** ✨ | Vibe reactions | sender, receiver, type |
| **listening_history** ✨ | Recent tracks | track_id, played_at |
| **push_subscriptions** ✨ | Push notifs | endpoint, keys |
