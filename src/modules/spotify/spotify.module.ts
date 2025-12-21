import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { SpotifyService } from './spotify.service';
import { SpotifyController } from './spotify.controller';
import { SpotifyPollingService } from './spotify-polling.service';
import { CurrentTrack, LiveStatus, SpotifyToken } from '../../database/entities';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CurrentTrack, LiveStatus, SpotifyToken]),
    ScheduleModule,
    AuthModule,
  ],
  controllers: [SpotifyController],
  providers: [SpotifyService, SpotifyPollingService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
