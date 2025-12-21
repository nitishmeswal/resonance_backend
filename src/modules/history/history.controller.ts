import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private historyService: HistoryService) {}

  @Get(':userId/recent-tracks')
  async getRecentTracks(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
  ) {
    const tracks = await this.historyService.getRecentTracks(
      userId,
      limit ? parseInt(limit, 10) : 5,
    );

    return {
      recentTracks: tracks.map((t) => ({
        trackId: t.trackId,
        name: t.trackName,
        artist: t.artist,
        albumArt: t.albumArt,
        playedAt: t.playedAt,
      })),
    };
  }
}
