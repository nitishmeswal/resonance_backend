import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CapsulesController } from './capsules.controller';
import { CapsulesService } from './capsules.service';
import { TimeCapsule, CapsuleDiscovery, User } from '../../database/entities';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeCapsule, CapsuleDiscovery, User]),
    NotificationsModule,
  ],
  controllers: [CapsulesController],
  providers: [CapsulesService],
  exports: [CapsulesService],
})
export class CapsulesModule {}
