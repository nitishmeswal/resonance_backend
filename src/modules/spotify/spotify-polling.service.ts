import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';

import { LiveStatus } from '../../database/entities';
import { SpotifyService } from './spotify.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SpotifyPollingService {
  private readonly logger = new Logger(SpotifyPollingService.name);
  private isPolling = false;

  constructor(
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
    private spotifyService: SpotifyService,
    private redisService: RedisService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async pollLiveUsers() {
    if (this.isPolling) {
      this.logger.debug('Skipping poll - previous poll still running');
      return;
    }

    this.isPolling = true;

    try {
      // Get all live users who have been active in the last 30 seconds
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
      
      const liveStatuses = await this.liveStatusRepository.find({
        where: {
          isLive: true,
          lastActive: LessThan(thirtySecondsAgo) ? undefined : undefined,
        },
      });

      // Filter to only active users
      const activeStatuses = liveStatuses.filter((status) => {
        if (!status.lastActive) return false;
        return status.lastActive.getTime() > thirtySecondsAgo.getTime();
      });

      this.logger.debug(`Polling ${activeStatuses.length} live users`);

      // Poll each user with rate limiting
      const pollPromises = activeStatuses.map(async (status, index) => {
        // Stagger requests to avoid rate limits
        await this.delay(index * 100);
        
        try {
          const track = await this.spotifyService.updateUserCurrentTrack(status.userId);
          
          if (track) {
            // Broadcast track update via Redis pub/sub
            await this.redisService.setUserPresence(status.userId, {
              trackId: track.trackId,
              trackName: track.trackName,
              artist: track.artist,
              isPlaying: track.isPlaying,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (error: any) {
          this.logger.error(`Failed to poll user ${status.userId}:`, error.message);
        }
      });

      await Promise.all(pollPromises);
    } catch (error: any) {
      this.logger.error('Polling error:', error.message);
    } finally {
      this.isPolling = false;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Clean up stale live statuses
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupStaleStatuses() {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      
      await this.liveStatusRepository
        .createQueryBuilder()
        .update(LiveStatus)
        .set({ isLive: false })
        .where('is_live = :isLive', { isLive: true })
        .andWhere('last_active < :threshold', { threshold: twoMinutesAgo })
        .execute();

      this.logger.debug('Cleaned up stale live statuses');
    } catch (error: any) {
      this.logger.error('Cleanup error:', error.message);
    }
  }
}
