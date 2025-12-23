import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ngeohash from 'ngeohash';

import { LiveStatus, User, CurrentTrack, LocationSnapshot } from '../../database/entities';
import { RedisService } from '../redis/redis.service';

export interface LiveUserData {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
  currentTrack?: {
    trackName: string;
    artist: string;
    albumArt: string | null;
    energy?: number;
    valence?: number;
  } | null;
  recentTracks?: { name: string; artist: string }[];
  socials?: {
    instagram?: string;
    discord?: string;
  };
  lastActive: Date | null;
  distanceMeters?: number;
  geohash?: string;
}

export interface PresenceSettings {
  isLive: boolean;
  shareTrack: boolean;
  allowFind: boolean;
  radiusKm: number;
}

@Injectable()
export class PresenceService {
  constructor(
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(CurrentTrack)
    private currentTrackRepository: Repository<CurrentTrack>,
    @InjectRepository(LocationSnapshot)
    private locationRepository: Repository<LocationSnapshot>,
    private redisService: RedisService,
  ) {}

  // Haversine distance calculation in meters
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  async goLive(userId: string): Promise<LiveStatus> {
    let status = await this.liveStatusRepository.findOne({ where: { userId } });
    
    if (!status) {
      status = this.liveStatusRepository.create({
        userId,
        isLive: true,
        lastActive: new Date(),
      });
    } else {
      status.isLive = true;
      status.lastActive = new Date();
    }

    const saved = await this.liveStatusRepository.save(status);

    // Update Redis presence
    await this.redisService.setUserPresence(userId, {
      isLive: true,
      lastActive: new Date().toISOString(),
    });

    return saved;
  }

  async goOffline(userId: string): Promise<LiveStatus> {
    const status = await this.liveStatusRepository.findOne({ where: { userId } });
    
    if (!status) {
      throw new NotFoundException('Live status not found');
    }

    status.isLive = false;
    const saved = await this.liveStatusRepository.save(status);

    // Remove from Redis
    await this.redisService.removeUserPresence(userId);

    return saved;
  }

  async updateSettings(userId: string, settings: Partial<PresenceSettings>): Promise<LiveStatus> {
    let status = await this.liveStatusRepository.findOne({ where: { userId } });
    
    if (!status) {
      status = this.liveStatusRepository.create({ userId });
    }

    if (settings.isLive !== undefined) status.isLive = settings.isLive;
    if (settings.shareTrack !== undefined) status.shareTrack = settings.shareTrack;
    if (settings.allowFind !== undefined) status.allowFind = settings.allowFind;
    if (settings.radiusKm !== undefined) status.radiusKm = settings.radiusKm;

    return this.liveStatusRepository.save(status);
  }

  async getSettings(userId: string): Promise<PresenceSettings | null> {
    const status = await this.liveStatusRepository.findOne({ where: { userId } });
    if (!status) return null;

    return {
      isLive: status.isLive,
      shareTrack: status.shareTrack,
      allowFind: status.allowFind,
      radiusKm: status.radiusKm,
    };
  }

  async heartbeat(userId: string): Promise<void> {
    await this.liveStatusRepository.update(
      { userId },
      { lastActive: new Date() },
    );

    // Update Redis TTL
    const presence = await this.redisService.getUserPresence(userId);
    if (presence) {
      await this.redisService.setUserPresence(userId, {
        ...presence,
        lastActive: new Date().toISOString(),
      });
    }
  }

  /**
   * Get nearby live users within the requesting user's radius setting.
   * This is the CORE proximity feature - only returns users actually nearby!
   * 
   * @param requestingUserId - The user requesting nearby users
   * @param maxRadiusMeters - Override max radius (default uses user's setting, max 10km)
   */
  async getLiveUsers(requestingUserId?: string, maxRadiusMeters?: number): Promise<LiveUserData[]> {
    // If no requesting user, return empty (can't calculate distance)
    if (!requestingUserId) {
      return [];
    }

    // Get requesting user's location
    const requestingUserLocation = await this.locationRepository.findOne({
      where: { userId: requestingUserId },
    });

    // If requesting user has no location, return empty
    if (!requestingUserLocation?.geohash) {
      return [];
    }

    // Get user's radius setting (default 5km, max 10km)
    const userStatus = await this.liveStatusRepository.findOne({ where: { userId: requestingUserId } });
    const userRadiusKm = userStatus?.radiusKm || 5;
    const radiusMeters = maxRadiusMeters || (userRadiusKm * 1000);
    const cappedRadiusMeters = Math.min(radiusMeters, 10000); // Cap at 10km

    // Get ALL live users (we'll filter by distance)
    const liveStatuses = await this.liveStatusRepository.find({
      where: { isLive: true },
    });

    const liveUsers: LiveUserData[] = [];
    const requestingCoords = ngeohash.decode(requestingUserLocation.geohash);

    for (const status of liveStatuses) {
      // Skip self
      if (status.userId === requestingUserId) continue;

      // Get user's location
      const userLocation = await this.locationRepository.findOne({
        where: { userId: status.userId },
      });

      // Skip users without location
      if (!userLocation?.geohash) continue;

      // Calculate actual distance in meters
      let distanceMeters: number;
      try {
        const userCoords = ngeohash.decode(userLocation.geohash);
        distanceMeters = Math.round(this.haversineDistance(
          requestingCoords.latitude,
          requestingCoords.longitude,
          userCoords.latitude,
          userCoords.longitude,
        ));
      } catch (e) {
        continue; // Skip if geohash decode fails
      }

      // 🔴 CRITICAL: Filter by distance - ONLY include users within radius!
      if (distanceMeters > cappedRadiusMeters) {
        continue; // Skip users outside radius
      }

      // Get user profile
      const user = await this.userRepository.findOne({
        where: { id: status.userId },
      });
      if (!user) continue;

      // Get current track if sharing
      let currentTrack = null;
      if (status.shareTrack) {
        const track = await this.currentTrackRepository.findOne({
          where: { userId: status.userId },
        });
        if (track && track.isPlaying) {
          currentTrack = {
            trackName: track.trackName,
            artist: track.artist,
            albumArt: track.albumArt,
            energy: track.energy ?? undefined,
            valence: track.valence ?? undefined,
          };
        }
      }

      liveUsers.push({
        userId: user.id,
        displayName: user.isAnonymous ? 'Anonymous Listener' : user.displayName,
        avatarUrl: user.isAnonymous ? null : user.avatarUrl,
        isAnonymous: user.isAnonymous,
        currentTrack,
        recentTracks: [],
        socials: user.isAnonymous ? undefined : {
          instagram: user.instagramHandle || undefined,
          discord: user.discordHandle || undefined,
        },
        lastActive: status.lastActive,
        distanceMeters,
        geohash: userLocation.geohash,
      });
    }

    // Sort by distance (closest first)
    liveUsers.sort((a, b) => {
      if (a.distanceMeters === undefined) return 1;
      if (b.distanceMeters === undefined) return -1;
      return a.distanceMeters - b.distanceMeters;
    });

    return liveUsers;
  }

  /**
   * Get ALL live users globally (for admin/debug purposes only)
   * Use getLiveUsers() for the actual nearby feature!
   */
  async getAllLiveUsersGlobal(): Promise<LiveUserData[]> {
    const liveStatuses = await this.liveStatusRepository.find({
      where: { isLive: true },
    });

    const liveUsers: LiveUserData[] = [];

    for (const status of liveStatuses) {
      const user = await this.userRepository.findOne({
        where: { id: status.userId },
      });
      if (!user) continue;

      let currentTrack = null;
      if (status.shareTrack) {
        const track = await this.currentTrackRepository.findOne({
          where: { userId: status.userId },
        });
        if (track && track.isPlaying) {
          currentTrack = {
            trackName: track.trackName,
            artist: track.artist,
            albumArt: track.albumArt,
            energy: track.energy ?? undefined,
            valence: track.valence ?? undefined,
          };
        }
      }

      const userLocation = await this.locationRepository.findOne({
        where: { userId: status.userId },
      });

      liveUsers.push({
        userId: user.id,
        displayName: user.isAnonymous ? 'Anonymous Listener' : user.displayName,
        avatarUrl: user.isAnonymous ? null : user.avatarUrl,
        isAnonymous: user.isAnonymous,
        currentTrack,
        recentTracks: [],
        socials: user.isAnonymous ? undefined : {
          instagram: user.instagramHandle || undefined,
          discord: user.discordHandle || undefined,
        },
        lastActive: status.lastActive,
        distanceMeters: undefined,
        geohash: userLocation?.geohash,
      });
    }

    return liveUsers;
  }

  async isUserLive(userId: string): Promise<boolean> {
    const status = await this.liveStatusRepository.findOne({ where: { userId } });
    return status?.isLive ?? false;
  }

  async canFindUser(userId: string): Promise<boolean> {
    const status = await this.liveStatusRepository.findOne({ where: { userId } });
    return status?.allowFind ?? false;
  }
}
