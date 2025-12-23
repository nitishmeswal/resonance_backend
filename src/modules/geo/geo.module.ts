import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { GeoService } from './geo.service';
import { GeoController } from './geo.controller';
import { User, LiveStatus, CurrentTrack, LocationSnapshot } from '../../database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, LiveStatus, CurrentTrack, LocationSnapshot]),
  ],
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
