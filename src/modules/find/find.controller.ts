import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { FindService } from './find.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User, FindSessionStatus } from '../../database/entities';

@ApiTags('find')
@Controller('find')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FindController {
  constructor(private findService: FindService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a Find session with a target user' })
  async startFind(@Req() req: Request, @Body() body: { targetId: string }) {
    const user = req.user as User;
    return this.findService.startFindSession(user.id, body.targetId);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active Find session' })
  async getActiveSession(@Req() req: Request) {
    const user = req.user as User;
    return this.findService.getActiveSession(user.id);
  }

  @Post(':sessionId/update')
  @ApiOperation({ summary: 'Update Find session distance bucket' })
  async updateBucket(@Param('sessionId') sessionId: string) {
    return this.findService.updateSessionBucket(sessionId);
  }

  @Post(':sessionId/complete')
  @ApiOperation({ summary: 'Mark Find session as completed (found the person)' })
  async completeSession(@Param('sessionId') sessionId: string, @Req() req: Request) {
    const user = req.user as User;
    await this.findService.endSession(sessionId, user.id, FindSessionStatus.COMPLETED);
    return { success: true, message: 'Session completed' };
  }

  @Delete(':sessionId')
  @ApiOperation({ summary: 'Cancel Find session' })
  async cancelSession(@Param('sessionId') sessionId: string, @Req() req: Request) {
    const user = req.user as User;
    await this.findService.endSession(sessionId, user.id, FindSessionStatus.CANCELLED);
    return { success: true, message: 'Session cancelled' };
  }
}
