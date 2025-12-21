import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reaction, ReactionType } from '../../database/entities/reaction.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ReactionsService {
  constructor(
    @InjectRepository(Reaction)
    private reactionRepository: Repository<Reaction>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private notificationsService: NotificationsService,
    private realtimeGateway: RealtimeGateway,
  ) {}

  async sendReaction(
    senderId: string,
    targetUserId: string,
    reactionType: ReactionType,
  ): Promise<Reaction> {
    if (senderId === targetUserId) {
      throw new BadRequestException('Cannot react to yourself');
    }

    // Check if target user exists
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new BadRequestException('Target user not found');
    }

    // Check for existing reaction of same type
    const existing = await this.reactionRepository.findOne({
      where: {
        senderId,
        receiverId: targetUserId,
        type: reactionType,
      },
    });

    if (existing) {
      // Update timestamp (re-send reaction)
      existing.createdAt = new Date();
      return this.reactionRepository.save(existing);
    }

    // Create new reaction
    const reaction = this.reactionRepository.create({
      senderId,
      receiverId: targetUserId,
      type: reactionType,
    });

    const savedReaction = await this.reactionRepository.save(reaction);

    // Get sender info for notification
    const sender = await this.userRepository.findOne({
      where: { id: senderId },
    });

    // Send real-time notification
    this.realtimeGateway.emitToUser(targetUserId, 'reaction:received', {
      reactionId: savedReaction.id,
      senderId,
      senderName: sender?.displayName || 'Someone',
      senderAvatar: sender?.avatarUrl,
      type: reactionType,
      createdAt: savedReaction.createdAt,
    });

    // Create persistent notification
    await this.notificationsService.notifyReaction(
      targetUserId,
      senderId,
      reactionType,
    );

    return savedReaction;
  }

  async getReceivedReactions(userId: string, limit = 50): Promise<Reaction[]> {
    return this.reactionRepository.find({
      where: { receiverId: userId },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getSentReactions(userId: string, limit = 50): Promise<Reaction[]> {
    return this.reactionRepository.find({
      where: { senderId: userId },
      relations: ['receiver'],
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getReactionsBetweenUsers(
    userId1: string,
    userId2: string,
  ): Promise<Reaction[]> {
    return this.reactionRepository.find({
      where: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  private getReactionEmoji(type: ReactionType): string {
    const emojis: Record<ReactionType, string> = {
      fire: '🔥',
      heart: '❤️',
      music: '🎵',
      wave: '👋',
      sparkle: '✨',
    };
    return emojis[type] || '🎵';
  }
}
