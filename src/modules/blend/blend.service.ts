import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { SpotifyToken } from '../../database/entities/spotify-token.entity';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class BlendService {
  private readonly logger = new Logger(BlendService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SpotifyToken)
    private tokenRepository: Repository<SpotifyToken>,
    private configService: ConfigService,
  ) {}

  async createBlend(userId: string, targetUserId: string): Promise<{ blendUrl: string }> {
    if (userId === targetUserId) {
      throw new BadRequestException('Cannot create blend with yourself');
    }

    // Get both users
    const [user, targetUser] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.userRepository.findOne({ where: { id: targetUserId } }),
    ]);

    if (!user || !targetUser) {
      throw new BadRequestException('User not found');
    }

    // Get access tokens
    const [userToken, targetToken] = await Promise.all([
      this.tokenRepository.findOne({ where: { userId } }),
      this.tokenRepository.findOne({ where: { userId: targetUserId } }),
    ]);

    if (!userToken) {
      throw new BadRequestException('Please connect your Spotify account');
    }

    // Note: Spotify's Blend feature is not directly available via API
    // We can generate a deep link that opens Spotify's Blend feature
    // or create a collaborative playlist as an alternative

    // Option 1: Deep link to Blend (opens Spotify app)
    const blendDeepLink = `spotify:blend`;

    // Option 2: Create a collaborative playlist with both users' top tracks
    try {
      const blendPlaylistUrl = await this.createCollaborativePlaylist(
        userToken.accessToken,
        user.spotifyId,
        targetUser.displayName,
      );
      return { blendUrl: blendPlaylistUrl };
    } catch (error) {
      this.logger.error('Failed to create collaborative playlist:', error);
      // Fallback to Blend deep link
      return { blendUrl: blendDeepLink };
    }
  }

  private async createCollaborativePlaylist(
    accessToken: string,
    spotifyUserId: string,
    partnerName: string,
  ): Promise<string> {
    // Create a new collaborative playlist
    const createResponse = await axios.post(
      `https://api.spotify.com/v1/users/${spotifyUserId}/playlists`,
      {
        name: `Resonance Blend with ${partnerName}`,
        description: 'Created by Resonance - your music connection app',
        public: false,
        collaborative: true,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const playlistId = createResponse.data.id;
    const playlistUrl = createResponse.data.external_urls.spotify;

    // Get user's top tracks
    const topTracksResponse = await axios.get(
      'https://api.spotify.com/v1/me/top/tracks?limit=10&time_range=short_term',
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const trackUris = topTracksResponse.data.items.map((track: any) => track.uri);

    // Add tracks to playlist
    if (trackUris.length > 0) {
      await axios.post(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        { uris: trackUris },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );
    }

    return playlistUrl;
  }

  async getBlendSuggestion(userId: string, targetUserId: string): Promise<{
    sharedGenres: string[];
    recommendedTracks: string[];
  }> {
    // This would analyze both users' listening history and suggest tracks
    // For now, return placeholder
    return {
      sharedGenres: [],
      recommendedTracks: [],
    };
  }
}
