import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { PresenceService, PresenceSettings } from './presence.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../database/entities';

@ApiTags('presence')
@Controller('presence')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PresenceController {
  constructor(private presenceService: PresenceService) {}

  @Post('live')
  @ApiOperation({ summary: 'Go live - start sharing presence' })
  async goLive(@Req() req: Request) {
    const user = req.user as User;
    return this.presenceService.goLive(user.id);
  }

  @Post('offline')
  @ApiOperation({ summary: 'Go offline - stop sharing presence' })
  async goOffline(@Req() req: Request) {
    const user = req.user as User;
    return this.presenceService.goOffline(user.id);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get presence settings' })
  async getSettings(@Req() req: Request) {
    const user = req.user as User;
    return this.presenceService.getSettings(user.id);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update presence settings' })
  async updateSettings(
    @Req() req: Request,
    @Body() settings: Partial<PresenceSettings>,
  ) {
    const user = req.user as User;
    return this.presenceService.updateSettings(user.id, settings);
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Send heartbeat to maintain live status' })
  async heartbeat(@Req() req: Request) {
    const user = req.user as User;
    await this.presenceService.heartbeat(user.id);
    return { success: true };
  }

  @Get('live-users')
  @ApiOperation({ summary: 'Get all live users with distances' })
  async getLiveUsers(@Req() req: Request) {
    const user = req.user as User;
    return this.presenceService.getLiveUsers(user.id);
  }
}
