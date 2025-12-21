import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, LiveStatus, CurrentTrack, Reaction, TimeCapsule, CapsuleDiscovery, ListeningHistory } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, LiveStatus, CurrentTrack, Reaction, TimeCapsule, CapsuleDiscovery, ListeningHistory])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
