import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FindController } from './find.controller';
import { FindService } from './find.service';
import { FindSession, LiveStatus, LocationSnapshot, User } from '../../database/entities';
import { LocationModule } from '../location/location.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FindSession, LiveStatus, LocationSnapshot, User]),
    LocationModule,
    PresenceModule,
  ],
  controllers: [FindController],
  providers: [FindService],
  exports: [FindService],
})
export class FindModule {}
