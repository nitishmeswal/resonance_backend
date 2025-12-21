import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { CurrentTrack, LiveStatus } from '../../database/entities';
import { AuthService } from '../auth/auth.service';

export interface SpotifyCurrentlyPlaying {
  is_playing: boolean;
  progress_ms: number;
  item: {
    id: string;
    name: string;
    duration_ms: number;
    artists: Array<{ name: string }>;
    album: {
      name: string;
      images: Array<{ url: string }>;
    };
  } | null;
}

export interface TrackAudioFeatures {
  energy: number;
  tempo: number;
  valence: number;
  danceability: number;
}

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);

  constructor(
    @InjectRepository(CurrentTrack)
    private currentTrackRepository: Repository<CurrentTrack>,
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
    private authService: AuthService,
  ) {}

  async getCurrentlyPlaying(userId: string): Promise<SpotifyCurrentlyPlaying | null> {
    try {
      const accessToken = await this.authService.getValidSpotifyToken(userId);
      
      const response = await axios.get(
        'https://api.spotify.com/v1/me/player/currently-playing',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (response.status === 204 || !response.data) {
        return null;
      }

      return response.data;
    } catch (error: any) {
      this.logger.error(`Failed to get currently playing for user ${userId}:`, error.message);
      return null;
    }
  }

  async getTrackAudioFeatures(trackId: string, userId: string): Promise<TrackAudioFeatures | null> {
    try {
      const accessToken = await this.authService.getValidSpotifyToken(userId);
      
      const response = await axios.get(
        `https://api.spotify.com/v1/audio-features/${trackId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      return {
        energy: response.data.energy,
        tempo: response.data.tempo,
        valence: response.data.valence,
        danceability: response.data.danceability,
      };
    } catch (error: any) {
      this.logger.error(`Failed to get audio features for track ${trackId}:`, error.message);
      return null;
    }
  }

  async updateUserCurrentTrack(userId: string): Promise<CurrentTrack | null> {
    const playing = await this.getCurrentlyPlaying(userId);
    
    if (!playing || !playing.item) {
      // User not playing anything - clear or mark as not playing
      let track = await this.currentTrackRepository.findOne({ where: { userId } });
      if (track) {
        track.isPlaying = false;
        return this.currentTrackRepository.save(track);
      }
      return null;
    }

    // Get audio features for vibe matching
    const audioFeatures = await this.getTrackAudioFeatures(playing.item.id, userId);

    let track = await this.currentTrackRepository.findOne({ where: { userId } });
    
    if (!track) {
      track = this.currentTrackRepository.create({ userId });
    }

    track.trackId = playing.item.id;
    track.trackName = playing.item.name;
    track.artist = playing.item.artists.map((a) => a.name).join(', ');
    track.albumArt = playing.item.album.images[0]?.url || null;
    track.isPlaying = playing.is_playing;
    track.progressMs = playing.progress_ms;
    track.durationMs = playing.item.duration_ms;

    if (audioFeatures) {
      track.energy = audioFeatures.energy;
      track.tempo = audioFeatures.tempo;
      track.valence = audioFeatures.valence;
    }

    return this.currentTrackRepository.save(track);
  }

  async getUserCurrentTrack(userId: string): Promise<CurrentTrack | null> {
    return this.currentTrackRepository.findOne({ where: { userId } });
  }

  async shouldPollUser(userId: string): Promise<boolean> {
    const liveStatus = await this.liveStatusRepository.findOne({
      where: { userId },
    });

    if (!liveStatus || !liveStatus.isLive) {
      return false;
    }

    // Check if user has been active recently (within 30 seconds)
    if (liveStatus.lastActive) {
      const secondsSinceActive = (Date.now() - liveStatus.lastActive.getTime()) / 1000;
      if (secondsSinceActive > 30) {
        return false;
      }
    }

    return true;
  }
}
