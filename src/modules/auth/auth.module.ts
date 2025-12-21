import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SpotifyStrategy } from './strategies/spotify.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User, SpotifyToken, LiveStatus } from '../../database/entities';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User, SpotifyToken, LiveStatus]),
  ],
  controllers: [AuthController],
  providers: [AuthService, SpotifyStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
