import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReactionsService } from './reactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReactionType } from '../../database/entities/reaction.entity';

interface SendReactionDto {
  targetUserId: string;
  reactionType: ReactionType;
}

@Controller('reactions')
@UseGuards(JwtAuthGuard)
export class ReactionsController {
  constructor(private reactionsService: ReactionsService) {}

  @Post()
  async sendReaction(@Req() req: any, @Body() dto: SendReactionDto) {
    const userId = req.user.id;
    const reaction = await this.reactionsService.sendReaction(
      userId,
      dto.targetUserId,
      dto.reactionType,
    );
    return {
      success: true,
      reaction: {
        id: reaction.id,
        type: reaction.type,
        createdAt: reaction.createdAt,
      },
    };
  }

  @Get('received')
  async getReceivedReactions(@Req() req: any) {
    const userId = req.user.id;
    const reactions = await this.reactionsService.getReceivedReactions(userId);
    return {
      reactions: reactions.map((r) => ({
        id: r.id,
        type: r.type,
        senderId: r.senderId,
        senderName: r.sender?.displayName,
        senderAvatar: r.sender?.avatarUrl,
        createdAt: r.createdAt,
      })),
    };
  }

  @Get('sent')
  async getSentReactions(@Req() req: any) {
    const userId = req.user.id;
    const reactions = await this.reactionsService.getSentReactions(userId);
    return {
      reactions: reactions.map((r) => ({
        id: r.id,
        type: r.type,
        receiverId: r.receiverId,
        receiverName: r.receiver?.displayName,
        createdAt: r.createdAt,
      })),
    };
  }
}
