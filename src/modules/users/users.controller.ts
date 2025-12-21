import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../database/entities';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@Req() req: Request) {
    const user = req.user as User;
    return this.usersService.getPublicProfile(user.id, user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user public profile' })
  async getUser(@Param('id') id: string, @Req() req: Request) {
    const requester = req.user as User;
    return this.usersService.getPublicProfile(id, requester.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateMe(
    @Req() req: Request,
    @Body() body: {
      displayName?: string;
      isAnonymous?: boolean;
      socials?: {
        instagram?: string;
        discord?: string;
      };
    },
  ) {
    const user = req.user as User;
    return this.usersService.updateProfile(user.id, body);
  }

  @Get('me/stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user stats' })
  async getMyStats(@Req() req: Request) {
    const user = req.user as User;
    return this.usersService.getUserStats(user.id);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user account' })
  async deleteMe(@Req() req: Request) {
    const user = req.user as User;
    await this.usersService.deleteUser(user.id);
    return { success: true, message: 'Account deleted' };
  }
}
