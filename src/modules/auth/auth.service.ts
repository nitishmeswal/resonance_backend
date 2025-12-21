import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { User, SpotifyToken, LiveStatus } from '../../database/entities';

interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  images: Array<{ url: string }>;
}

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SpotifyToken)
    private spotifyTokenRepository: Repository<SpotifyToken>,
    @InjectRepository(LiveStatus)
    private liveStatusRepository: Repository<LiveStatus>,
  ) {}

  async handleSpotifyCallback(code: string): Promise<{ accessToken: string; user: User }> {
    // Exchange code for tokens
    const tokens = await this.exchangeCodeForTokens(code);
    
    // Get Spotify profile
    const profile = await this.getSpotifyProfile(tokens.access_token);
    
    // Find or create user
    let user = await this.userRepository.findOne({
      where: { spotifyId: profile.id },
    });

    if (!user) {
      user = this.userRepository.create({
        spotifyId: profile.id,
        displayName: profile.display_name || 'Anonymous',
        email: profile.email,
        avatarUrl: profile.images?.[0]?.url || null,
        isAnonymous: false,
      });
      user = await this.userRepository.save(user);

      // Create initial live status
      const liveStatus = this.liveStatusRepository.create({
        userId: user.id,
        isLive: false,
        shareTrack: false,
        allowFind: false,
        radiusKm: 5,
      });
      await this.liveStatusRepository.save(liveStatus);
    } else {
      // Update profile info
      user.displayName = profile.display_name || user.displayName;
      user.avatarUrl = profile.images?.[0]?.url || user.avatarUrl;
      user.email = profile.email || user.email;
      await this.userRepository.save(user);
    }

    // Store/update Spotify tokens
    await this.storeSpotifyTokens(user.id, tokens);

    // Generate JWT
    const accessToken = this.generateJwt(user);

    return { accessToken, user };
  }

  private async exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
    const clientId = this.configService.get('SPOTIFY_CLIENT_ID');
    const clientSecret = this.configService.get('SPOTIFY_CLIENT_SECRET');
    const redirectUri = this.configService.get('SPOTIFY_CALLBACK_URL');

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      },
    );

    return response.data;
  }

  async refreshSpotifyToken(userId: string): Promise<string> {
    const tokenRecord = await this.spotifyTokenRepository.findOne({
      where: { userId },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('No Spotify token found');
    }

    const clientId = this.configService.get('SPOTIFY_CLIENT_ID');
    const clientSecret = this.configService.get('SPOTIFY_CLIENT_SECRET');

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refreshToken,
    });

    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      },
    );

    const { access_token, expires_in, refresh_token } = response.data;

    // Update stored tokens
    tokenRecord.accessToken = access_token;
    tokenRecord.expiresAt = new Date(Date.now() + expires_in * 1000);
    if (refresh_token) {
      tokenRecord.refreshToken = refresh_token;
    }
    await this.spotifyTokenRepository.save(tokenRecord);

    return access_token;
  }

  async getValidSpotifyToken(userId: string): Promise<string> {
    const tokenRecord = await this.spotifyTokenRepository.findOne({
      where: { userId },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('No Spotify token found');
    }

    // Check if token is expired (with 5 minute buffer)
    const bufferMs = 5 * 60 * 1000;
    if (tokenRecord.expiresAt.getTime() - bufferMs < Date.now()) {
      return this.refreshSpotifyToken(userId);
    }

    return tokenRecord.accessToken;
  }

  private async getSpotifyProfile(accessToken: string): Promise<SpotifyProfile> {
    const response = await axios.get('https://api.spotify.com/v1/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data;
  }

  private async storeSpotifyTokens(userId: string, tokens: SpotifyTokenResponse): Promise<void> {
    let tokenRecord = await this.spotifyTokenRepository.findOne({
      where: { userId },
    });

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    if (tokenRecord) {
      tokenRecord.accessToken = tokens.access_token;
      tokenRecord.refreshToken = tokens.refresh_token || tokenRecord.refreshToken;
      tokenRecord.expiresAt = expiresAt;
    } else {
      tokenRecord = this.spotifyTokenRepository.create({
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
      });
    }

    await this.spotifyTokenRepository.save(tokenRecord);
  }

  private generateJwt(user: User): string {
    const payload = {
      sub: user.id,
      spotifyId: user.spotifyId,
      displayName: user.displayName,
    };
    return this.jwtService.sign(payload);
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id: userId } });
  }

  getSpotifyAuthUrl(): string {
    const clientId = this.configService.get('SPOTIFY_CLIENT_ID');
    const redirectUri = this.configService.get('SPOTIFY_CALLBACK_URL');
    const scopes = [
      'user-read-currently-playing',
      'user-read-playback-state',
      'user-read-private',
      'user-read-email',
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
      show_dialog: 'true',
    });

    return `https://accounts.spotify.com/authorize?${params.toString()}`;
  }
}
