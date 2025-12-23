-- SQL Script to ensure all tables exist for Resonance Backend
-- Run this in your Supabase SQL Editor if tables are missing

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spotify_id VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    avatar_url TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    instagram_handle VARCHAR(255),
    discord_handle VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spotify tokens
CREATE TABLE IF NOT EXISTS spotify_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Live status (presence)
CREATE TABLE IF NOT EXISTS live_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_live BOOLEAN DEFAULT false,
    share_track BOOLEAN DEFAULT true,
    allow_find BOOLEAN DEFAULT true,
    radius_km FLOAT DEFAULT 5,
    last_active TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Current track
CREATE TABLE IF NOT EXISTS current_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    track_id VARCHAR(255) NOT NULL,
    track_name VARCHAR(500) NOT NULL,
    artist VARCHAR(500) NOT NULL,
    album_art TEXT,
    energy FLOAT,
    tempo FLOAT,
    valence FLOAT,
    is_playing BOOLEAN DEFAULT false,
    progress_ms INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Location snapshots (CRITICAL for proximity feature)
CREATE TABLE IF NOT EXISTS location_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    geohash VARCHAR(12) NOT NULL,
    precision_level INTEGER DEFAULT 7,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for geohash lookups (IMPORTANT for nearby queries)
CREATE INDEX IF NOT EXISTS idx_location_geohash ON location_snapshots(geohash);
CREATE INDEX IF NOT EXISTS idx_location_geohash_prefix ON location_snapshots(substring(geohash, 1, 5));

-- Time capsules
CREATE TABLE IF NOT EXISTS time_capsules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    geohash VARCHAR(12) NOT NULL,
    location_name VARCHAR(255),
    track_id VARCHAR(255) NOT NULL,
    track_name VARCHAR(500) NOT NULL,
    artist VARCHAR(500) NOT NULL,
    album_art TEXT,
    preview_url TEXT,
    message TEXT,
    mood VARCHAR(50),
    visibility VARCHAR(20) DEFAULT 'public',
    unlock_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    discovery_radius_meters INTEGER DEFAULT 100,
    max_discoveries INTEGER,
    discovery_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_anonymous BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for capsule geohash lookups
CREATE INDEX IF NOT EXISTS idx_capsule_geohash ON time_capsules(geohash);
CREATE INDEX IF NOT EXISTS idx_capsule_active ON time_capsules(is_active) WHERE is_active = true;

-- Capsule discoveries
CREATE TABLE IF NOT EXISTS capsule_discoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    capsule_id UUID REFERENCES time_capsules(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    discovered_at_geohash VARCHAR(12),
    has_liked BOOLEAN DEFAULT false,
    discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(capsule_id, user_id)
);

-- Find sessions
CREATE TABLE IF NOT EXISTS find_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seeker_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'active',
    current_bucket VARCHAR(20) DEFAULT 'far',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reactions
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User stats
CREATE TABLE IF NOT EXISTS user_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tracks_shared INTEGER DEFAULT 0,
    connections INTEGER DEFAULT 0,
    match_rate FLOAT DEFAULT 0,
    reactions_received INTEGER DEFAULT 0,
    capsules_dropped INTEGER DEFAULT 0,
    capsules_discovered INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Listening history
CREATE TABLE IF NOT EXISTS listening_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    track_id VARCHAR(255) NOT NULL,
    track_name VARCHAR(500) NOT NULL,
    artist VARCHAR(500) NOT NULL,
    album_art TEXT,
    played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Grant permissions (if using Supabase)
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
