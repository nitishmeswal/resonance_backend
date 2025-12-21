import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, LiveStatus, CurrentTrack, Reaction, TimeCapsule, CapsuleDiscovery, ListeningHistory } from '../../database/entities';

export interface PublicUserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isAnonymous: boolean;
  socials?: {
    instagram?: string;
    discord?: string;
  };
  currentTrack?: {
    trackName: string;
    artist: string;
    albumArt: string | null;
  } | null;
}

export interface UserStats {
  tracksShared: number;
  connections: number;
  matchRate: number;
  reactionsReceived: number;
  capsulesDropped: number;
  capsulesDiscovered: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
    @InjectRepository(CurrentTrack)
    private currentTrackRepository: Repository<CurrentTrack>,
    @InjectRepository(Reaction)
    private reactionRepository: Repository<Reaction>,
    @InjectRepository(TimeCapsule)
    private capsuleRepository: Repository<TimeCapsule>,
    @InjectRepository(CapsuleDiscovery)
    private discoveryRepository: Repository<CapsuleDiscovery>,
    @InjectRepository(ListeningHistory)
    private historyRepository: Repository<ListeningHistory>,
  ) {}

  async findById(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  async findBySpotifyId(spotifyId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { spotifyId } });
  }

  async getPublicProfile(userId: string, requesterId?: string): Promise<PublicUserProfile> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const liveStatus = await this.liveStatusRepository.findOne({
      where: { userId },
    });

    let currentTrack = null;
    if (liveStatus?.shareTrack && liveStatus?.isLive) {
      const track = await this.currentTrackRepository.findOne({
        where: { userId },
      });
      if (track) {
        currentTrack = {
          trackName: track.trackName,
          artist: track.artist,
          albumArt: track.albumArt,
        };
      }
    }

    return {
      id: user.id,
      displayName: user.isAnonymous ? 'Anonymous Listener' : user.displayName,
      avatarUrl: user.isAnonymous ? null : user.avatarUrl,
      isAnonymous: user.isAnonymous,
      socials: user.isAnonymous ? undefined : {
        instagram: user.instagramHandle || undefined,
        discord: user.discordHandle || undefined,
      },
      currentTrack,
    };
  }

  async updateProfile(
    userId: string,
    updates: {
      displayName?: string;
      isAnonymous?: boolean;
      socials?: { instagram?: string; discord?: string };
    },
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updates.displayName !== undefined) {
      user.displayName = updates.displayName;
    }
    if (updates.isAnonymous !== undefined) {
      user.isAnonymous = updates.isAnonymous;
    }
    if (updates.socials) {
      if (updates.socials.instagram !== undefined) {
        user.instagramHandle = updates.socials.instagram || null;
      }
      if (updates.socials.discord !== undefined) {
        user.discordHandle = updates.socials.discord || null;
      }
    }

    return this.userRepository.save(user);
  }

  async getUserStats(userId: string): Promise<UserStats> {
    // Get reactions received count
    const reactionsReceived = await this.reactionRepository.count({
      where: { receiverId: userId },
    });

    // Get capsules dropped by user
    const capsulesDropped = await this.capsuleRepository.count({
      where: { creatorId: userId },
    });

    // Get capsules discovered by user
    const capsulesDiscovered = await this.discoveryRepository.count({
      where: { userId },
    });

    // Get tracks shared (from listening history)
    const tracksShared = await this.historyRepository.count({
      where: { userId },
    });

    // Get unique connections (users who reacted to you or you reacted to)
    const sentReactions = await this.reactionRepository
      .createQueryBuilder('r')
      .select('DISTINCT r.receiver_id')
      .where('r.sender_id = :userId', { userId })
      .getRawMany();
    const receivedReactions = await this.reactionRepository
      .createQueryBuilder('r')
      .select('DISTINCT r.sender_id')
      .where('r.receiver_id = :userId', { userId })
      .getRawMany();
    const connections = new Set([...sentReactions, ...receivedReactions]).size;

    return {
      tracksShared,
      connections,
      matchRate: connections > 0 ? Math.min(95, 50 + connections * 5) : 0,
      reactionsReceived,
      capsulesDropped,
      capsulesDiscovered,
    };
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.userRepository.remove(user);
  }

  async getLiveUsers(): Promise<User[]> {
    const liveStatuses = await this.liveStatusRepository.find({
      where: { isLive: true },
    });
    
    const userIds = liveStatuses.map((s) => s.userId);
    if (userIds.length === 0) return [];

    return this.userRepository
      .createQueryBuilder('user')
      .whereInIds(userIds)
      .getMany();
  }
}
