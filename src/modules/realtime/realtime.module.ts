import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { User, LiveStatus, CurrentTrack, LocationSnapshot, FindSession } from '../../database/entities';
import { PresenceModule } from '../presence/presence.module';
import { LocationModule } from '../location/location.module';
import { FindModule } from '../find/find.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LiveStatus, CurrentTrack, LocationSnapshot, FindSession]),
    PresenceModule,
    LocationModule,
    FindModule,
    AuthModule,
  ],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeGateway, RealtimeService],
})
export class RealtimeModule {}
