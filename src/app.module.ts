import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SpotifyModule } from './modules/spotify/spotify.module';
import { PresenceModule } from './modules/presence/presence.module';
import { LocationModule } from './modules/location/location.module';
import { FindModule } from './modules/find/find.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { RedisModule } from './modules/redis/redis.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { CapsulesModule } from './modules/capsules/capsules.module';
import { ReactionsModule } from './modules/reactions/reactions.module';
import { HistoryModule } from './modules/history/history.module';
import { PushModule } from './modules/push/push.module';
import { BlendModule } from './modules/blend/blend.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get('DATABASE_URL');
        const isProduction = configService.get('NODE_ENV') === 'production';
        
        // Base config
        const config: any = {
          type: 'postgres',
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: !isProduction, // Auto-sync in dev, manual migrations in prod
          logging: !isProduction,
          // Connection pool settings for production
          extra: {
            max: 10, // Max connections
            connectionTimeoutMillis: 10000, // 10 seconds
            idleTimeoutMillis: 30000,
          },
        };

        // Use DATABASE_URL if provided (Supabase/Railway format)
        if (databaseUrl) {
          config.url = databaseUrl;
          // Force SSL for production database URLs
          if (isProduction || databaseUrl.includes('supabase')) {
            config.ssl = { rejectUnauthorized: false };
          }
        } else {
          // Fallback to individual config
          config.host = configService.get('DATABASE_HOST') || 'localhost';
          config.port = configService.get('DATABASE_PORT') || 5432;
          config.username = configService.get('DATABASE_USERNAME') || 'postgres';
          config.password = configService.get('DATABASE_PASSWORD') || '';
          config.database = configService.get('DATABASE_NAME') || 'resonance';
        }

        return config;
      },
      inject: [ConfigService],
    }),

    // Rate Limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ([{
        ttl: configService.get('THROTTLE_TTL') || 60,
        limit: configService.get('THROTTLE_LIMIT') || 100,
      }]),
      inject: [ConfigService],
    }),

    // Scheduled Tasks
    ScheduleModule.forRoot(),

    // Feature Modules
    RedisModule,
    AuthModule,
    UsersModule,
    SpotifyModule,
    PresenceModule,
    LocationModule,
    FindModule,
    RealtimeModule,
    HealthModule,
    NotificationsModule,
    CapsulesModule,
    ReactionsModule,
    HistoryModule,
    PushModule,
    BlendModule,
  ],
})
export class AppModule {}
