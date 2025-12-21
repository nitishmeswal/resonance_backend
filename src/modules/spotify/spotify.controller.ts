import { Controller, Get, Post, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { SpotifyService } from './spotify.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../database/entities';

@ApiTags('spotify')
@Controller('spotify')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SpotifyController {
  constructor(private spotifyService: SpotifyService) {}

  @Get('currently-playing')
  @ApiOperation({ summary: 'Get user current track from Spotify' })
  async getCurrentlyPlaying(@Req() req: Request) {
    const user = req.user as User;
    return this.spotifyService.getCurrentlyPlaying(user.id);
  }

  @Get('current-track')
  @ApiOperation({ summary: 'Get cached current track' })
  async getCurrentTrack(@Req() req: Request) {
    const user = req.user as User;
    return this.spotifyService.getUserCurrentTrack(user.id);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Force refresh current track from Spotify' })
  async refreshCurrentTrack(@Req() req: Request) {
    const user = req.user as User;
    return this.spotifyService.updateUserCurrentTrack(user.id);
  }
}
