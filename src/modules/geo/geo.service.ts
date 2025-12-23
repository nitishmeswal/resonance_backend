import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ngeohash from 'ngeohash';

import { User, LiveStatus, CurrentTrack, LocationSnapshot } from '../../database/entities';
import { RedisService } from '../redis/redis.service';

const REDIS_GEO_KEY = 'resonance:users:live';
const LOCATION_TTL_SECONDS = 300; // 5 minutes

export interface GeoUser {
  userId: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  bearing: number; // Direction from requester to this user (0-360°)
}

export interface NearbyUserWithDetails {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
  distanceMeters: number;
  bearing: number;
  latitude: number;
  longitude: number;
  currentTrack?: {
    trackName: string;
    artist: string;
    albumArt: string | null;
    energy?: number;
    valence?: number;
  } | null;
  socials?: {
    instagram?: string;
    discord?: string;
  };
  lastActive: Date | null;
}

@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
    @InjectRepository(CurrentTrack)
    private currentTrackRepository: Repository<CurrentTrack>,
    @InjectRepository(LocationSnapshot)
    private locationRepository: Repository<LocationSnapshot>,
    private redisService: RedisService,
  ) {}

  /**
   * Store user location in Redis GEO set
   * Uses GEOADD for O(log(N)) insertion
   */
  async setUserLocation(userId: string, latitude: number, longitude: number): Promise<void> {
    try {
      // Add to Redis GEO set (lng, lat order for Redis)
      await this.redisService.geoAdd(REDIS_GEO_KEY, longitude, latitude, userId);
      
      // Store individual location data with TTL
      const client = this.redisService.getClient();
      await client.setex(
        `resonance:location:${userId}`,
        LOCATION_TTL_SECONDS,
        JSON.stringify({ latitude, longitude, updatedAt: Date.now() })
      );

      // Also update database for persistence
      const geohash = ngeohash.encode(latitude, longitude, 9); // High precision
      let location = await this.locationRepository.findOne({ where: { userId } });
      if (!location) {
        location = this.locationRepository.create({ userId });
      }
      location.geohash = geohash;
      location.precisionLevel = 9;
      await this.locationRepository.save(location);

      this.logger.debug(`Location set for user ${userId}: ${latitude}, ${longitude}`);
    } catch (error) {
      this.logger.error(`Failed to set location for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get nearby users using Redis GEORADIUS
   * O(log(N) + M) where N = total users, M = results
   */
  async getNearbyUsers(
    requesterId: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    limit: number = 50
  ): Promise<GeoUser[]> {
    try {
      // Use GEORADIUS to find nearby users
      // Returns: [[userId, distance, [lng, lat]], ...]
      const results = await this.redisService.geoRadius(
        REDIS_GEO_KEY,
        longitude,
        latitude,
        radiusKm,
        'km',
        { withDist: true, withCoord: true, sort: 'ASC', count: limit + 1 }
      ) as any[];

      const nearbyUsers: GeoUser[] = [];

      for (const result of results) {
        const userId = result[0];
        
        // Skip self
        if (userId === requesterId) continue;

        const distanceKm = parseFloat(result[1]);
        const [lng, lat] = result[2].map(parseFloat);

        // Calculate bearing from requester to this user
        const bearing = this.calculateBearing(latitude, longitude, lat, lng);

        nearbyUsers.push({
          userId,
          latitude: lat,
          longitude: lng,
          distanceMeters: Math.round(distanceKm * 1000),
          bearing: Math.round(bearing),
        });
      }

      return nearbyUsers;
    } catch (error) {
      this.logger.error('Failed to get nearby users:', error);
      return [];
    }
  }

  /**
   * Get nearby users with full profile details
   */
  async getNearbyUsersWithDetails(
    requesterId: string,
    latitude: number,
    longitude: number,
    radiusKm: number = 5
  ): Promise<NearbyUserWithDetails[]> {
    // Get nearby user IDs and positions from Redis GEO
    const nearbyGeo = await this.getNearbyUsers(requesterId, latitude, longitude, radiusKm);

    if (nearbyGeo.length === 0) {
      return [];
    }

    const userIds = nearbyGeo.map(u => u.userId);

    // Get live statuses - only return users who are actually live
    const liveStatuses = await this.liveStatusRepository
      .createQueryBuilder('status')
      .where('status.user_id IN (:...userIds)', { userIds })
      .andWhere('status.is_live = :isLive', { isLive: true })
      .getMany();

    const liveUserIds = new Set(liveStatuses.map(s => s.userId));
    const statusMap = new Map(liveStatuses.map(s => [s.userId, s]));

    // Get user profiles for live users only
    const liveNearbyGeo = nearbyGeo.filter(u => liveUserIds.has(u.userId));
    
    if (liveNearbyGeo.length === 0) {
      return [];
    }

    const users = await this.userRepository
      .createQueryBuilder('user')
      .whereInIds(liveNearbyGeo.map(u => u.userId))
      .getMany();

    const userMap = new Map(users.map(u => [u.id, u]));

    // Get current tracks
    const tracks = await this.currentTrackRepository
      .createQueryBuilder('track')
      .where('track.user_id IN (:...userIds)', { userIds: liveNearbyGeo.map(u => u.userId) })
      .getMany();

    const trackMap = new Map(tracks.map(t => [t.userId, t]));

    // Build response
    const result: NearbyUserWithDetails[] = [];

    for (const geo of liveNearbyGeo) {
      const user = userMap.get(geo.userId);
      const status = statusMap.get(geo.userId);
      const track = trackMap.get(geo.userId);

      if (!user) continue;

      let currentTrack = null;
      if (status?.shareTrack && track?.isPlaying) {
        currentTrack = {
          trackName: track.trackName,
          artist: track.artist,
          albumArt: track.albumArt,
          energy: track.energy ?? undefined,
          valence: track.valence ?? undefined,
        };
      }

      result.push({
        userId: user.id,
        displayName: user.isAnonymous ? 'Anonymous Listener' : user.displayName,
        avatarUrl: user.isAnonymous ? null : user.avatarUrl,
        isAnonymous: user.isAnonymous,
        distanceMeters: geo.distanceMeters,
        bearing: geo.bearing,
        latitude: geo.latitude,
        longitude: geo.longitude,
        currentTrack,
        socials: user.isAnonymous ? undefined : {
          instagram: user.instagramHandle || undefined,
          discord: user.discordHandle || undefined,
        },
        lastActive: status?.lastActive || null,
      });
    }

    // Already sorted by distance from GEORADIUS
    return result;
  }

  /**
   * Remove user from Redis GEO set (when going offline)
   */
  async removeUser(userId: string): Promise<void> {
    try {
      await this.redisService.geoRemove(REDIS_GEO_KEY, userId);
      const client = this.redisService.getClient();
      await client.del(`resonance:location:${userId}`);
      this.logger.debug(`Removed location for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to remove location for user ${userId}:`, error);
    }
  }

  /**
   * Calculate bearing (direction) from point A to point B
   * Returns angle in degrees (0-360, where 0 = North)
   */
  calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const Δλ = this.toRadians(lng2 - lng1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    let θ = Math.atan2(y, x);
    θ = this.toDegrees(θ);
    
    return (θ + 360) % 360; // Normalize to 0-360
  }

  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in meters
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = this.toRadians(lat1);
    const φ2 = this.toRadians(lat2);
    const Δφ = this.toRadians(lat2 - lat1);
    const Δλ = this.toRadians(lng2 - lng1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Get user's current location from Redis
   */
  async getUserLocation(userId: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
      const client = this.redisService.getClient();
      const data = await client.get(`resonance:location:${userId}`);
      if (data) {
        const parsed = JSON.parse(data);
        return { latitude: parsed.latitude, longitude: parsed.longitude };
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  private toDegrees(radians: number): number {
    return radians * 180 / Math.PI;
  }
}
