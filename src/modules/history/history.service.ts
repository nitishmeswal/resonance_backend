import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListeningHistory } from '../../database/entities/listening-history.entity';

const MAX_HISTORY_PER_USER = 10;

@Injectable()
export class HistoryService {
  constructor(
    @InjectRepository(ListeningHistory)
    private historyRepository: Repository<ListeningHistory>,
  ) {}

  async addTrackToHistory(
    userId: string,
    trackData: {
      trackId: string;
      trackName: string;
      artist: string;
      albumArt?: string;
    },
  ): Promise<void> {
    // Check if this track was already the last one played
    const lastTrack = await this.historyRepository.findOne({
      where: { userId },
      order: { playedAt: 'DESC' },
    });

    if (lastTrack && lastTrack.trackId === trackData.trackId) {
      // Same track, don't add duplicate
      return;
    }

    // Add new track
    const history = this.historyRepository.create({
      userId,
      trackId: trackData.trackId,
      trackName: trackData.trackName,
      artist: trackData.artist,
      albumArt: trackData.albumArt || null,
      playedAt: new Date(),
    });

    await this.historyRepository.save(history);

    // Cleanup old entries (keep only last MAX_HISTORY_PER_USER)
    await this.cleanupOldHistory(userId);
  }

  async getRecentTracks(userId: string, limit = 5): Promise<ListeningHistory[]> {
    return this.historyRepository.find({
      where: { userId },
      order: { playedAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentTracksForUsers(userIds: string[], limit = 5): Promise<Map<string, ListeningHistory[]>> {
    if (userIds.length === 0) return new Map();

    const histories = await this.historyRepository
      .createQueryBuilder('history')
      .where('history.user_id IN (:...userIds)', { userIds })
      .orderBy('history.played_at', 'DESC')
      .getMany();

    // Group by userId
    const result = new Map<string, ListeningHistory[]>();
    for (const userId of userIds) {
      result.set(userId, []);
    }

    for (const history of histories) {
      const userHistory = result.get(history.userId) || [];
      if (userHistory.length < limit) {
        userHistory.push(history);
        result.set(history.userId, userHistory);
      }
    }

    return result;
  }

  private async cleanupOldHistory(userId: string): Promise<void> {
    const count = await this.historyRepository.count({ where: { userId } });
    
    if (count > MAX_HISTORY_PER_USER) {
      // Get IDs to keep
      const toKeep = await this.historyRepository.find({
        where: { userId },
        order: { playedAt: 'DESC' },
        take: MAX_HISTORY_PER_USER,
        select: ['id'],
      });

      const keepIds = toKeep.map((h) => h.id);

      // Delete older entries
      await this.historyRepository
        .createQueryBuilder()
        .delete()
        .where('user_id = :userId', { userId })
        .andWhere('id NOT IN (:...keepIds)', { keepIds })
        .execute();
    }
  }
}
