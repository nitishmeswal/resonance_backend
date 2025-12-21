import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { LocationSnapshot, LiveStatus, User } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([LocationSnapshot, LiveStatus, User])],
  controllers: [LocationController],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
