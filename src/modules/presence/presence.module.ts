import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { LiveStatus, User, CurrentTrack, LocationSnapshot } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([LiveStatus, User, CurrentTrack, LocationSnapshot])],
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
