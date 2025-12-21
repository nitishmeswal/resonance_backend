-- Resonance Initial Schema Migration
-- Run this in your Supabase SQL editor or via migration tool

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spotify_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    email TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Spotify tokens table
CREATE TABLE IF NOT EXISTS spotify_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Live status table
CREATE TABLE IF NOT EXISTS live_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_live BOOLEAN DEFAULT FALSE,
    share_track BOOLEAN DEFAULT FALSE,
    allow_find BOOLEAN DEFAULT FALSE,
    radius_km INTEGER DEFAULT 5,
    last_active TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Current tracks table
CREATE TABLE IF NOT EXISTS current_tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_id TEXT NOT NULL,
    track_name TEXT NOT NULL,
    artist TEXT NOT NULL,
    album_art TEXT,
    energy FLOAT,
    tempo FLOAT,
    valence FLOAT,
    is_playing BOOLEAN DEFAULT FALSE,
    progress_ms INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Location snapshots table
CREATE TABLE IF NOT EXISTS location_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    geohash TEXT NOT NULL,
    precision_level INTEGER DEFAULT 5,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Find sessions table
CREATE TABLE IF NOT EXISTS find_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seeker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
    current_bucket TEXT DEFAULT 'far' CHECK (current_bucket IN ('far', 'warm', 'close', 'found')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_spotify_id ON users(spotify_id);
CREATE INDEX IF NOT EXISTS idx_live_status_is_live ON live_status(is_live);
CREATE INDEX IF NOT EXISTS idx_live_status_user_id ON live_status(user_id);
CREATE INDEX IF NOT EXISTS idx_current_tracks_user_id ON current_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_location_snapshots_geohash ON location_snapshots(geohash);
CREATE INDEX IF NOT EXISTS idx_location_snapshots_user_id ON location_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_find_sessions_seeker_id ON find_sessions(seeker_id);
CREATE INDEX IF NOT EXISTS idx_find_sessions_target_id ON find_sessions(target_id);
CREATE INDEX IF NOT EXISTS idx_find_sessions_status ON find_sessions(status);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_spotify_tokens_updated_at BEFORE UPDATE ON spotify_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_status_updated_at BEFORE UPDATE ON live_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_current_tracks_updated_at BEFORE UPDATE ON current_tracks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_location_snapshots_updated_at BEFORE UPDATE ON location_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_find_sessions_updated_at BEFORE UPDATE ON find_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
