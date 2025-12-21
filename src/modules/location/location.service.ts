import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ngeohash from 'ngeohash';

import { LocationSnapshot, LiveStatus, User } from '../../database/entities';
import { RedisService } from '../redis/redis.service';

export interface NearbyUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  geohash: string;
  distance?: string;
}

@Injectable()
export class LocationService {
  constructor(
    @InjectRepository(LocationSnapshot)
    private locationRepository: Repository<LocationSnapshot>,
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private redisService: RedisService,
  ) {}

  async updateLocation(userId: string, geohash: string, precisionLevel = 5): Promise<LocationSnapshot> {
    // Get old location to clean up Redis
    const oldLocation = await this.locationRepository.findOne({ where: { userId } });
    const oldGeohash = oldLocation?.geohash;

    let location = oldLocation;
    if (!location) {
      location = this.locationRepository.create({ userId });
    }

    // Truncate geohash to precision level for privacy
    const truncatedGeohash = geohash.substring(0, precisionLevel);
    location.geohash = truncatedGeohash;
    location.precisionLevel = precisionLevel;

    const saved = await this.locationRepository.save(location);

    // Update Redis for fast lookup
    if (oldGeohash && oldGeohash !== truncatedGeohash) {
      await this.redisService.removeUserLocation(userId, oldGeohash);
    }
    await this.redisService.setUserLocation(userId, truncatedGeohash);

    return saved;
  }

  async removeLocation(userId: string): Promise<void> {
    const location = await this.locationRepository.findOne({ where: { userId } });
    if (location) {
      await this.redisService.removeUserLocation(userId, location.geohash);
      await this.locationRepository.remove(location);
    }
  }

  async getNearbyUsers(userId: string, radiusKm?: number): Promise<NearbyUser[]> {
    const userLocation = await this.locationRepository.findOne({ where: { userId } });
    if (!userLocation) {
      return [];
    }

    // Get user's radius setting if not provided
    if (!radiusKm) {
      const liveStatus = await this.liveStatusRepository.findOne({ where: { userId } });
      radiusKm = liveStatus?.radiusKm || 5;
    }

    // Get neighboring geohashes based on radius
    const neighbors = this.getNeighborGeohashes(userLocation.geohash, radiusKm);
    
    // Find users in these geohashes from Redis (fast)
    const nearbyUserIds = await this.redisService.getUsersInGeohashes(neighbors);
    
    // Filter out self and get only live users
    const filteredUserIds = nearbyUserIds.filter((id) => id !== userId);
    
    if (filteredUserIds.length === 0) {
      return [];
    }

    // Get live status for these users
    const liveStatuses = await this.liveStatusRepository
      .createQueryBuilder('status')
      .where('status.user_id IN (:...userIds)', { userIds: filteredUserIds })
      .andWhere('status.is_live = :isLive', { isLive: true })
      .getMany();

    const liveUserIds = liveStatuses.map((s) => s.userId);

    if (liveUserIds.length === 0) {
      return [];
    }

    // Get user profiles
    const users = await this.userRepository
      .createQueryBuilder('user')
      .whereInIds(liveUserIds)
      .getMany();

    // Get locations
    const locations = await this.locationRepository
      .createQueryBuilder('location')
      .where('location.user_id IN (:...userIds)', { userIds: liveUserIds })
      .getMany();

    const locationMap = new Map(locations.map((l) => [l.userId, l]));

    return users.map((user) => ({
      userId: user.id,
      displayName: user.isAnonymous ? 'Anonymous Listener' : user.displayName,
      avatarUrl: user.isAnonymous ? null : user.avatarUrl,
      geohash: locationMap.get(user.id)?.geohash || '',
    }));
  }

  private getNeighborGeohashes(centerGeohash: string, radiusKm: number): string[] {
    // Get the precision based on radius
    // ~5km = precision 5, ~1km = precision 6, ~150m = precision 7
    let precision = 5;
    if (radiusKm <= 1) precision = 6;
    if (radiusKm <= 0.15) precision = 7;

    const truncated = centerGeohash.substring(0, precision);
    const neighbors = ngeohash.neighbors(truncated);
    
    return [truncated, ...neighbors];
  }

  async getUserLocation(userId: string): Promise<LocationSnapshot | null> {
    return this.locationRepository.findOne({ where: { userId } });
  }

  // Calculate approximate distance bucket between two geohashes
  calculateDistanceBucket(geohash1: string, geohash2: string): 'far' | 'warm' | 'close' | 'found' {
    const coords1 = ngeohash.decode(geohash1);
    const coords2 = ngeohash.decode(geohash2);

    const distance = this.haversineDistance(
      coords1.latitude,
      coords1.longitude,
      coords2.latitude,
      coords2.longitude,
    );

    if (distance > 500) return 'far';
    if (distance > 100) return 'warm';
    if (distance > 20) return 'close';
    return 'found';
  }

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

    return R * c; // Distance in meters
  }
}
