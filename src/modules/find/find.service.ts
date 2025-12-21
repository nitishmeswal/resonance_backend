import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  FindSession,
  FindSessionStatus,
  DistanceBucket,
  LiveStatus,
  LocationSnapshot,
  User,
} from '../../database/entities';
import { LocationService } from '../location/location.service';
import { PresenceService } from '../presence/presence.service';
import { RedisService } from '../redis/redis.service';

export interface FindSessionData {
  sessionId: string;
  seekerId: string;
  targetId: string;
  targetDisplayName: string;
  targetAvatarUrl: string | null;
  status: FindSessionStatus;
  currentBucket: DistanceBucket;
  startedAt: Date;
}

@Injectable()
export class FindService {
  constructor(
    @InjectRepository(FindSession)
    private findSessionRepository: Repository<FindSession>,
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
    @InjectRepository(LocationSnapshot)
    private locationRepository: Repository<LocationSnapshot>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private locationService: LocationService,
    private presenceService: PresenceService,
    private redisService: RedisService,
  ) {}

  async startFindSession(seekerId: string, targetId: string): Promise<FindSessionData> {
    // Validate seeker is live
    const seekerLive = await this.presenceService.isUserLive(seekerId);
    if (!seekerLive) {
      throw new BadRequestException('You must be live to start a Find session');
    }

    // Validate target exists and allows finding
    const targetLive = await this.presenceService.isUserLive(targetId);
    if (!targetLive) {
      throw new NotFoundException('Target user is not live');
    }

    const targetAllowsFind = await this.presenceService.canFindUser(targetId);
    if (!targetAllowsFind) {
      throw new ForbiddenException('Target user has disabled Find');
    }

    // Check for existing active session
    const existingSession = await this.findSessionRepository.findOne({
      where: {
        seekerId,
        targetId,
        status: FindSessionStatus.ACTIVE,
      },
    });

    if (existingSession) {
      throw new BadRequestException('You already have an active Find session with this user');
    }

    // Get target user info
    const targetUser = await this.userRepository.findOne({ where: { id: targetId } });
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Calculate initial distance bucket
    const seekerLocation = await this.locationService.getUserLocation(seekerId);
    const targetLocation = await this.locationService.getUserLocation(targetId);

    let initialBucket = DistanceBucket.FAR;
    if (seekerLocation && targetLocation) {
      initialBucket = this.locationService.calculateDistanceBucket(
        seekerLocation.geohash,
        targetLocation.geohash,
      ) as DistanceBucket;
    }

    // Create session
    const session = this.findSessionRepository.create({
      seekerId,
      targetId,
      status: FindSessionStatus.ACTIVE,
      currentBucket: initialBucket,
    });

    const saved = await this.findSessionRepository.save(session);

    // Store in Redis for fast access
    await this.redisService.setFindSession(saved.id, {
      seekerId,
      targetId,
      currentBucket: initialBucket,
      startedAt: saved.startedAt.toISOString(),
    });

    return {
      sessionId: saved.id,
      seekerId,
      targetId,
      targetDisplayName: targetUser.isAnonymous ? 'Anonymous Listener' : targetUser.displayName,
      targetAvatarUrl: targetUser.isAnonymous ? null : targetUser.avatarUrl,
      status: saved.status,
      currentBucket: saved.currentBucket,
      startedAt: saved.startedAt,
    };
  }

  async updateSessionBucket(sessionId: string): Promise<DistanceBucket> {
    const session = await this.findSessionRepository.findOne({
      where: { id: sessionId, status: FindSessionStatus.ACTIVE },
    });

    if (!session) {
      throw new NotFoundException('Find session not found or not active');
    }

    const seekerLocation = await this.locationService.getUserLocation(session.seekerId);
    const targetLocation = await this.locationService.getUserLocation(session.targetId);

    if (!seekerLocation || !targetLocation) {
      return session.currentBucket;
    }

    const newBucket = this.locationService.calculateDistanceBucket(
      seekerLocation.geohash,
      targetLocation.geohash,
    ) as DistanceBucket;

    if (newBucket !== session.currentBucket) {
      session.currentBucket = newBucket;
      await this.findSessionRepository.save(session);

      // Update Redis
      await this.redisService.setFindSession(sessionId, {
        seekerId: session.seekerId,
        targetId: session.targetId,
        currentBucket: newBucket,
        startedAt: session.startedAt.toISOString(),
      });
    }

    return newBucket;
  }

  async endSession(sessionId: string, userId: string, status: FindSessionStatus): Promise<void> {
    const session = await this.findSessionRepository.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Find session not found');
    }

    // Only seeker or target can end the session
    if (session.seekerId !== userId && session.targetId !== userId) {
      throw new ForbiddenException('You cannot end this session');
    }

    session.status = status;
    session.endedAt = new Date();
    await this.findSessionRepository.save(session);

    // Remove from Redis
    await this.redisService.deleteFindSession(sessionId);
  }

  async getActiveSession(userId: string): Promise<FindSessionData | null> {
    const session = await this.findSessionRepository.findOne({
      where: [
        { seekerId: userId, status: FindSessionStatus.ACTIVE },
        { targetId: userId, status: FindSessionStatus.ACTIVE },
      ],
    });

    if (!session) {
      return null;
    }

    const targetUser = await this.userRepository.findOne({
      where: { id: session.targetId },
    });

    return {
      sessionId: session.id,
      seekerId: session.seekerId,
      targetId: session.targetId,
      targetDisplayName: targetUser?.isAnonymous ? 'Anonymous Listener' : (targetUser?.displayName || 'Unknown'),
      targetAvatarUrl: targetUser?.isAnonymous ? null : (targetUser?.avatarUrl || null),
      status: session.status,
      currentBucket: session.currentBucket,
      startedAt: session.startedAt,
    };
  }

  async getSessionById(sessionId: string): Promise<FindSession | null> {
    return this.findSessionRepository.findOne({ where: { id: sessionId } });
  }
}
