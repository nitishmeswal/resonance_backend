import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscription } from '../../database/entities/push-subscription.entity';

interface WebPushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private vapidConfigured = false;

  constructor(
    @InjectRepository(PushSubscription)
    private subscriptionRepository: Repository<PushSubscription>,
    private configService: ConfigService,
  ) {
    this.initVapid();
  }

  private initVapid() {
    const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const email = this.configService.get<string>('VAPID_EMAIL') || 'mailto:hello@resonance.app';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(email, publicKey, privateKey);
      this.vapidConfigured = true;
      this.logger.log('VAPID keys configured for web push');
    } else {
      this.logger.warn('VAPID keys not configured - push notifications disabled');
    }
  }

  async subscribe(
    userId: string,
    subscription: WebPushSubscription,
    userAgent?: string,
  ): Promise<void> {
    // Check if subscription already exists
    const existing = await this.subscriptionRepository.findOne({
      where: { endpoint: subscription.endpoint },
    });

    if (existing) {
      // Update if same user, otherwise replace
      if (existing.userId === userId) {
        return; // Already subscribed
      }
      await this.subscriptionRepository.delete({ id: existing.id });
    }

    const sub = this.subscriptionRepository.create({
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent || null,
    });

    await this.subscriptionRepository.save(sub);
    this.logger.log(`User ${userId} subscribed to push notifications`);
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subscriptionRepository.delete({ userId, endpoint });
  }

  async unsubscribeAll(userId: string): Promise<void> {
    await this.subscriptionRepository.delete({ userId });
  }

  async sendToUser(
    userId: string,
    notification: {
      title: string;
      body: string;
      icon?: string;
      data?: Record<string, any>;
    },
  ): Promise<void> {
    if (!this.vapidConfigured) {
      this.logger.debug('Push skipped - VAPID not configured');
      return;
    }

    const subscriptions = await this.subscriptionRepository.find({
      where: { userId },
    });

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/icon-192.png',
      data: notification.data || {},
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        );
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Subscription expired or invalid, remove it
          await this.subscriptionRepository.delete({ id: sub.id });
          this.logger.debug(`Removed expired subscription for user ${userId}`);
        } else {
          this.logger.error(`Failed to send push to ${userId}:`, error.message);
        }
      }
    });

    await Promise.all(sendPromises);
  }

  async notifyNearbyUser(userId: string, nearbyUserName: string): Promise<void> {
    await this.sendToUser(userId, {
      title: '🎵 Someone nearby!',
      body: `${nearbyUserName} is listening near you`,
      data: { type: 'nearby', action: 'open_feed' },
    });
  }

  async notifyReaction(userId: string, senderName: string, reactionType: string): Promise<void> {
    const emoji = reactionType === 'fire' ? '🔥' : reactionType === 'heart' ? '❤️' : '🎵';
    await this.sendToUser(userId, {
      title: `${emoji} New Reaction`,
      body: `${senderName} sent you a ${reactionType} reaction`,
      data: { type: 'reaction', action: 'open_profile' },
    });
  }

  async notifyMatch(userId: string, matchName: string, percentage: number): Promise<void> {
    await this.sendToUser(userId, {
      title: '💕 New Match!',
      body: `You and ${matchName} are ${percentage}% compatible!`,
      data: { type: 'match', action: 'open_matches' },
    });
  }

  getVapidPublicKey(): string | null {
    return this.configService.get<string>('VAPID_PUBLIC_KEY') || null;
  }
}
