import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, IsNull, Or } from 'typeorm';
import * as ngeohash from 'ngeohash';

import { TimeCapsule, CapsuleDiscovery, User, CapsuleVisibility } from '../../database/entities';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateCapsuleDto {
  geohash: string;
  locationName?: string;
  trackId: string;
  trackName: string;
  artist: string;
  albumArt?: string;
  previewUrl?: string;
  message?: string;
  mood?: string;
  visibility?: CapsuleVisibility;
  unlockAt?: Date;
  expiresAt?: Date;
  discoveryRadiusMeters?: number;
  maxDiscoveries?: number;
  isAnonymous?: boolean;
}

export interface NearbyCapsule {
  id: string;
  trackName: string;
  artist: string;
  albumArt: string | null;
  mood: string | null;
  locationName: string | null;
  distanceMeters: number;
  creatorName: string;
  createdAt: Date;
  isUnlocked: boolean;
  discoveryCount: number;
}

@Injectable()
export class CapsulesService {
  constructor(
    @InjectRepository(TimeCapsule)
    private capsuleRepository: Repository<TimeCapsule>,
    @InjectRepository(CapsuleDiscovery)
    private discoveryRepository: Repository<CapsuleDiscovery>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async createCapsule(userId: string, dto: CreateCapsuleDto): Promise<TimeCapsule> {
    const capsule = this.capsuleRepository.create({
      creatorId: userId,
      geohash: dto.geohash,
      locationName: dto.locationName || null,
      trackId: dto.trackId,
      trackName: dto.trackName,
      artist: dto.artist,
      albumArt: dto.albumArt || null,
      previewUrl: dto.previewUrl || null,
      message: dto.message || null,
      mood: dto.mood || null,
      visibility: dto.visibility || 'public',
      unlockAt: dto.unlockAt || null,
      expiresAt: dto.expiresAt || null,
      discoveryRadiusMeters: dto.discoveryRadiusMeters || 100,
      maxDiscoveries: dto.maxDiscoveries || null,
      isAnonymous: dto.isAnonymous || false,
    });

    return this.capsuleRepository.save(capsule);
  }

  async getNearbyCapsules(userId: string, userGeohash: string, radiusMeters = 500): Promise<NearbyCapsule[]> {
    const now = new Date();
    
    // Get geohash neighbors for broader search
    const precision = Math.min(userGeohash.length, 7);
    const truncatedHash = userGeohash.substring(0, precision);
    const neighbors = ngeohash.neighbors(truncatedHash);
    const searchHashes = [truncatedHash, ...neighbors];

    // Find capsules in nearby geohashes
    const capsules = await this.capsuleRepository
      .createQueryBuilder('capsule')
      .leftJoinAndSelect('capsule.creator', 'creator')
      .where('capsule.isActive = :active', { active: true })
      .andWhere('capsule.visibility = :visibility', { visibility: 'public' })
      .andWhere('(capsule.expiresAt IS NULL OR capsule.expiresAt > :now)', { now })
      .andWhere(
        searchHashes.map((_, i) => `capsule.geohash LIKE :hash${i}`).join(' OR '),
        searchHashes.reduce((acc, hash, i) => ({ ...acc, [`hash${i}`]: `${hash}%` }), {}),
      )
      .orderBy('capsule.createdAt', 'DESC')
      .take(50)
      .getMany();

    // Calculate distances and filter
    const userCoords = ngeohash.decode(userGeohash);
    const nearbyCapsules: NearbyCapsule[] = [];

    for (const capsule of capsules) {
      const capsuleCoords = ngeohash.decode(capsule.geohash);
      const distance = this.haversineDistance(
        userCoords.latitude, userCoords.longitude,
        capsuleCoords.latitude, capsuleCoords.longitude,
      );

      // Check if within discovery radius
      if (distance <= radiusMeters) {
        const isUnlocked = !capsule.unlockAt || capsule.unlockAt <= now;
        
        nearbyCapsules.push({
          id: capsule.id,
          trackName: capsule.trackName,
          artist: capsule.artist,
          albumArt: capsule.albumArt,
          mood: capsule.mood,
          locationName: capsule.locationName,
          distanceMeters: Math.round(distance),
          creatorName: capsule.isAnonymous ? 'Anonymous' : (capsule.creator?.displayName || 'Someone'),
          createdAt: capsule.createdAt,
          isUnlocked,
          discoveryCount: capsule.discoveryCount,
        });
      }
    }

    // Sort by distance
    return nearbyCapsules.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  async discoverCapsule(userId: string, capsuleId: string, userGeohash?: string): Promise<any> {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: capsuleId },
      relations: ['creator'],
    });

    if (!capsule) {
      throw new NotFoundException('Capsule not found');
    }

    if (!capsule.isActive) {
      throw new BadRequestException('This capsule is no longer active');
    }

    const now = new Date();
    if (capsule.expiresAt && capsule.expiresAt < now) {
      throw new BadRequestException('This capsule has expired');
    }

    if (capsule.unlockAt && capsule.unlockAt > now) {
      throw new BadRequestException('This capsule is not unlocked yet');
    }

    // Check if already discovered
    const existing = await this.discoveryRepository.findOne({
      where: { capsuleId, userId },
    });

    if (existing) {
      // Already discovered, return capsule with discovery info
      return this.formatCapsuleResponse(capsule, true, existing.hasLiked);
    }

    // Check max discoveries
    if (capsule.maxDiscoveries && capsule.discoveryCount >= capsule.maxDiscoveries) {
      throw new BadRequestException('This capsule has reached max discoveries');
    }

    // Check distance only if geohash provided
    const discoveryGeohash = userGeohash || capsule.geohash; // Use capsule's geohash if not provided
    if (userGeohash) {
      const userCoords = ngeohash.decode(userGeohash);
      const capsuleCoords = ngeohash.decode(capsule.geohash);
      const distance = this.haversineDistance(
        userCoords.latitude, userCoords.longitude,
        capsuleCoords.latitude, capsuleCoords.longitude,
      );

      if (distance > capsule.discoveryRadiusMeters) {
        throw new BadRequestException(`You need to be within ${capsule.discoveryRadiusMeters}m to discover this capsule`);
      }
    }

    // Record discovery
    const discovery = this.discoveryRepository.create({
      capsuleId,
      userId,
      discoveredAtGeohash: discoveryGeohash,
    });
    await this.discoveryRepository.save(discovery);

    // Increment discovery count
    capsule.discoveryCount += 1;
    await this.capsuleRepository.save(capsule);

    // Notify creator
    if (capsule.creatorId !== userId) {
      await this.notificationsService.create({
        userId: capsule.creatorId,
        type: 'reaction',
        title: 'Someone found your capsule!',
        message: `Your "${capsule.trackName}" drop was discovered`,
        fromUserId: userId,
        metadata: { capsuleId },
      });
    }

    return this.formatCapsuleResponse(capsule, true, false);
  }

  async likeCapsule(userId: string, capsuleId: string): Promise<{ success: boolean }> {
    // First check if capsule exists
    const capsule = await this.capsuleRepository.findOne({ where: { id: capsuleId } });
    if (!capsule) {
      throw new NotFoundException('Capsule not found');
    }

    // Check if user has discovered this capsule
    let discovery = await this.discoveryRepository.findOne({
      where: { capsuleId, userId },
    });

    // Auto-discover if not yet discovered (for simpler UX)
    if (!discovery) {
      discovery = this.discoveryRepository.create({
        capsuleId,
        userId,
        discoveredAtGeohash: capsule.geohash,
      });
      await this.discoveryRepository.save(discovery);
      capsule.discoveryCount += 1;
    }

    if (discovery.hasLiked) {
      return { success: true }; // Already liked
    }

    discovery.hasLiked = true;
    await this.discoveryRepository.save(discovery);

    // Increment like count
    capsule.likeCount += 1;
    await this.capsuleRepository.save(capsule);

    // Notify creator
    if (capsule.creatorId !== userId) {
      await this.notificationsService.create({
        userId: capsule.creatorId,
        type: 'reaction',
        title: 'Someone liked your capsule!',
        message: `Your "${capsule.trackName}" drop got a like`,
        fromUserId: userId,
        metadata: { capsuleId },
      });
    }

    return { success: true };
  }

  async getMyCapsules(userId: string): Promise<TimeCapsule[]> {
    return this.capsuleRepository.find({
      where: { creatorId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getMyDiscoveries(userId: string): Promise<CapsuleDiscovery[]> {
    return this.discoveryRepository.find({
      where: { userId },
      relations: ['capsule', 'capsule.creator'],
      order: { discoveredAt: 'DESC' },
    });
  }

  async deleteCapsule(userId: string, capsuleId: string): Promise<void> {
    const capsule = await this.capsuleRepository.findOne({
      where: { id: capsuleId, creatorId: userId },
    });

    if (!capsule) {
      throw new NotFoundException('Capsule not found or not owned by you');
    }

    await this.capsuleRepository.remove(capsule);
  }

  private formatCapsuleResponse(capsule: TimeCapsule, isDiscovered: boolean, isLiked: boolean) {
    // Respect capsule's isAnonymous setting - hide creator name if anonymous
    const creatorName = capsule.isAnonymous ? null : (capsule.creator?.displayName || 'Someone');
    
    return {
      id: capsule.id,
      creatorId: capsule.isAnonymous ? null : capsule.creatorId,
      creatorName,
      creatorIsAnonymous: capsule.isAnonymous,
      trackId: capsule.trackId,
      trackName: capsule.trackName,
      artist: capsule.artist,
      albumArt: capsule.albumArt,
      message: capsule.message,
      geohash: capsule.geohash,
      likes: capsule.likeCount,
      discoveryCount: capsule.discoveryCount,
      createdAt: capsule.createdAt,
      isDiscovered,
      isLiked,
    };
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
