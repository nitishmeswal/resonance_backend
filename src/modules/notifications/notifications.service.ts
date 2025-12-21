import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Notification, NotificationType, User } from '../../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  fromUserId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create({
      userId: dto.userId,
      type: dto.type,
      title: dto.title,
      message: dto.message || null,
      fromUserId: dto.fromUserId || null,
      metadata: dto.metadata || {},
    });

    const saved = await this.notificationRepository.save(notification);

    // Send real-time notification via WebSocket
    this.realtimeGateway.emitToUser(dto.userId, 'notification:new', {
      id: saved.id,
      type: saved.type,
      title: saved.title,
      message: saved.message,
      createdAt: saved.createdAt,
    });

    return saved;
  }

  async getForUser(userId: string, limit = 20): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      relations: ['fromUser'],
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async delete(userId: string, notificationId: string): Promise<void> {
    await this.notificationRepository.delete({ id: notificationId, userId });
  }

  // Helper methods for creating specific notification types
  async notifyVibeMatch(userId: string, matchUserId: string, matchPercentage: number): Promise<void> {
    const matchUser = await this.userRepository.findOne({ where: { id: matchUserId } });
    await this.create({
      userId,
      type: 'vibe_match',
      title: 'Vibe Match!',
      message: `You and ${matchUser?.displayName || 'someone'} are both feeling the same vibe`,
      fromUserId: matchUserId,
      metadata: { matchPercentage },
    });
  }

  async notifyFindRequest(userId: string, seekerUserId: string): Promise<void> {
    const seeker = await this.userRepository.findOne({ where: { id: seekerUserId } });
    await this.create({
      userId,
      type: 'find_request',
      title: 'Someone wants to find you',
      message: `${seeker?.displayName || 'Someone'} is trying to locate you through sound`,
      fromUserId: seekerUserId,
    });
  }

  async notifyJamRequest(userId: string, fromUserId: string): Promise<void> {
    const fromUser = await this.userRepository.findOne({ where: { id: fromUserId } });
    await this.create({
      userId,
      type: 'jam_request',
      title: 'Jam Request',
      message: `${fromUser?.displayName || 'Someone'} invited you to a Spotify Jam`,
      fromUserId,
    });
  }

  async notifyReaction(userId: string, fromUserId: string, reactionType: string): Promise<void> {
    const fromUser = await this.userRepository.findOne({ where: { id: fromUserId } });
    const emoji = reactionType === 'fire' ? '🔥' : reactionType === 'headphones' ? '🎧' : '💜';
    await this.create({
      userId,
      type: 'reaction',
      title: 'New Reaction',
      message: `${fromUser?.displayName || 'Someone'} sent you ${emoji} on your vibe`,
      fromUserId,
      metadata: { reactionType },
    });
  }

  async notifyNewListenerNearby(userId: string, listenerUserId: string): Promise<void> {
    const listener = await this.userRepository.findOne({ where: { id: listenerUserId } });
    await this.create({
      userId,
      type: 'new_listener',
      title: 'New listener nearby',
      message: `${listener?.displayName || 'Someone'} just went live near you`,
      fromUserId: listenerUserId,
    });
  }
}
