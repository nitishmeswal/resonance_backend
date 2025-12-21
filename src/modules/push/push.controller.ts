import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PushService } from './push.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface SubscribeDto {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

@Controller('notifications')
export class PushController {
  constructor(private pushService: PushService) {}

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return {
      publicKey: this.pushService.getVapidPublicKey(),
    };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Req() req: any, @Body() dto: SubscribeDto) {
    const userId = req.user.id;
    const userAgent = req.headers['user-agent'];
    
    await this.pushService.subscribe(userId, dto.subscription, userAgent);
    
    return { success: true, message: 'Subscribed to push notifications' };
  }

  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Req() req: any, @Body() body: { endpoint: string }) {
    const userId = req.user.id;
    await this.pushService.unsubscribe(userId, body.endpoint);
    return { success: true };
  }
}
