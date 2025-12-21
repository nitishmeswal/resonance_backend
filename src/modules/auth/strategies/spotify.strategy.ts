import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-spotify';

@Injectable()
export class SpotifyStrategy extends PassportStrategy(Strategy, 'spotify') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get('SPOTIFY_CLIENT_ID'),
      clientSecret: configService.get('SPOTIFY_CLIENT_SECRET'),
      callbackURL: configService.get('SPOTIFY_CALLBACK_URL'),
      scope: [
        'user-read-currently-playing',
        'user-read-playback-state',
        'user-read-private',
        'user-read-email',
      ],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: Function,
  ) {
    const user = {
      spotifyId: profile.id,
      displayName: profile.displayName,
      email: profile.emails?.[0]?.value,
      avatarUrl: profile.photos?.[0]?.value,
      accessToken,
      refreshToken,
    };
    done(null, user);
  }
}
