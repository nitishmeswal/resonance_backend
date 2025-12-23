import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';
import { User, LiveStatus, CurrentTrack, LocationSnapshot } from '../../database/entities';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LiveStatus, CurrentTrack, LocationSnapshot]),
    RedisModule,
  ],
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
