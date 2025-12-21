import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, LiveStatus, CurrentTrack } from '../../database/entities';
import { RedisService } from '../redis/redis.service';

export interface BroadcastTrackUpdate {
  userId: string;
  trackId: string;
  trackName: string;
  artist: string;
  albumArt: string | null;
  energy?: number;
  valence?: number;
}

export interface BroadcastPresenceUpdate {
  userId: string;
  isLive: boolean;
  displayName: string;
  avatarUrl: string | null;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
    @InjectRepository(CurrentTrack)
    private currentTrackRepository: Repository<CurrentTrack>,
    private redisService: RedisService,
  ) {}

  async getConnectedUserIds(): Promise<string[]> {
    return this.redisService.getAllConnectedUsers();
  }

  async isUserConnected(userId: string): Promise<boolean> {
    const socketId = await this.redisService.getSocketId(userId);
    return !!socketId;
  }

  async getUserSocketId(userId: string): Promise<string | null> {
    return this.redisService.getSocketId(userId);
  }

  async prepareTrackBroadcast(userId: string): Promise<BroadcastTrackUpdate | null> {
    const track = await this.currentTrackRepository.findOne({ where: { userId } });
    if (!track || !track.isPlaying) {
      return null;
    }

    return {
      userId,
      trackId: track.trackId,
      trackName: track.trackName,
      artist: track.artist,
      albumArt: track.albumArt,
      energy: track.energy ?? undefined,
      valence: track.valence ?? undefined,
    };
  }

  async preparePresenceBroadcast(userId: string, isLive: boolean): Promise<BroadcastPresenceUpdate | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }

    return {
      userId,
      isLive,
      displayName: user.isAnonymous ? 'Anonymous Listener' : user.displayName,
      avatarUrl: user.isAnonymous ? null : user.avatarUrl,
    };
  }

  async getLiveUserCount(): Promise<number> {
    const count = await this.liveStatusRepository.count({
      where: { isLive: true },
    });
    return count;
  }

  async getConnectionStats(): Promise<{
    connectedUsers: number;
    liveUsers: number;
  }> {
    const connectedUsers = await this.redisService.getAllConnectedUsers();
    const liveUsers = await this.getLiveUserCount();

    return {
      connectedUsers: connectedUsers.length,
      liveUsers,
    };
  }
}
