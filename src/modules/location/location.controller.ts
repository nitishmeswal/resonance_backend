import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { LocationService } from './location.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../database/entities';

@ApiTags('location')
@Controller('location')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LocationController {
  constructor(private locationService: LocationService) {}

  @Post('update')
  @ApiOperation({ summary: 'Update user location with geohash' })
  async updateLocation(
    @Req() req: Request,
    @Body() body: { geohash: string; precisionLevel?: number },
  ) {
    const user = req.user as User;
    return this.locationService.updateLocation(
      user.id,
      body.geohash,
      body.precisionLevel,
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Remove user location' })
  async removeLocation(@Req() req: Request) {
    const user = req.user as User;
    await this.locationService.removeLocation(user.id);
    return { success: true };
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby live users' })
  async getNearbyUsers(@Req() req: Request) {
    const user = req.user as User;
    return this.locationService.getNearbyUsers(user.id);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user location' })
  async getMyLocation(@Req() req: Request) {
    const user = req.user as User;
    return this.locationService.getUserLocation(user.id);
  }
}
