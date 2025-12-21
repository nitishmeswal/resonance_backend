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

  async getLiveUsers(requestingUserId?: string): Promise<LiveUserData[]> {
    const liveStatuses = await this.liveStatusRepository.find({
      where: { isLive: true },
    });

    const liveUsers: LiveUserData[] = [];

    // Get requesting user's location for distance calculation
    let requestingUserLocation: LocationSnapshot | null = null;
    if (requestingUserId) {
      requestingUserLocation = await this.locationRepository.findOne({
        where: { userId: requestingUserId },
      });
    }

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

      // Calculate distance if both users have location
      let distanceMeters: number | undefined;
      let userGeohash: string | undefined;
      
      const userLocation = await this.locationRepository.findOne({
        where: { userId: status.userId },
      });
      
      if (userLocation) {
        userGeohash = userLocation.geohash;
        
        if (requestingUserLocation?.geohash && userLocation.geohash) {
          try {
            const coords1 = ngeohash.decode(requestingUserLocation.geohash);
            const coords2 = ngeohash.decode(userLocation.geohash);
            distanceMeters = Math.round(this.haversineDistance(
              coords1.latitude,
              coords1.longitude,
              coords2.latitude,
              coords2.longitude,
            ));
          } catch (e) {
            // Geohash decode failed, skip distance
          }
        }
      }

      liveUsers.push({
        userId: user.id,
        displayName: user.isAnonymous ? 'Anonymous Listener' : user.displayName,
        avatarUrl: user.isAnonymous ? null : user.avatarUrl,
        isAnonymous: user.isAnonymous,
        currentTrack,
        recentTracks: [], // Will be populated by HistoryService integration
        socials: user.isAnonymous ? undefined : {
          instagram: user.instagramHandle || undefined,
          discord: user.discordHandle || undefined,
        },
        lastActive: status.lastActive,
        distanceMeters,
        geohash: userGeohash,
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

  async isUserLive(userId: string): Promise<boolean> {
    const status = await this.liveStatusRepository.findOne({ where: { userId } });
    return status?.isLive ?? false;
  }

  async canFindUser(userId: string): Promise<boolean> {
    const status = await this.liveStatusRepository.findOne({ where: { userId } });
    return status?.allowFind ?? false;
  }
}
