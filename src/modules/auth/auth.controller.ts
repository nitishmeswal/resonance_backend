import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Req,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Get('spotify')
  @ApiOperation({ summary: 'Redirect to Spotify OAuth' })
  spotifyAuth(@Res() res: Response) {
    const authUrl = this.authService.getSpotifyAuthUrl();
    return res.redirect(authUrl);
  }

  @Get('spotify/callback')
  @ApiOperation({ summary: 'Spotify OAuth callback' })
  async spotifyCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get('FRONTEND_URL');

    if (error) {
      return res.redirect(`${frontendUrl}/auth/error?error=${error}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/auth/error?error=no_code`);
    }

    try {
      const { accessToken, user } = await this.authService.handleSpotifyCallback(code);
      
      // Redirect to frontend with token
      return res.redirect(
        `${frontendUrl}/auth/callback?token=${accessToken}&userId=${user.id}`,
      );
    } catch (err) {
      console.error('Spotify callback error:', err);
      return res.redirect(`${frontendUrl}/auth/callback?error=auth_failed`);
    }
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Req() req: Request) {
    return req.user;
  }

  @Get('refresh-token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh Spotify token' })
  async refreshToken(@Req() req: Request) {
    const user = req.user as { id: string };
    const newToken = await this.authService.refreshSpotifyToken(user.id);
    return { success: true, message: 'Token refreshed' };
  }

  @Get('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Res() res: Response) {
    // Frontend should clear the JWT token
    return res.status(HttpStatus.OK).json({ success: true, message: 'Logged out' });
  }
}
