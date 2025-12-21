import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlendService } from './blend.service';
import { BlendController } from './blend.controller';
import { User } from '../../database/entities/user.entity';
import { SpotifyToken } from '../../database/entities/spotify-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, SpotifyToken])],
  controllers: [BlendController],
  providers: [BlendService],
  exports: [BlendService],
})
export class BlendModule {}
