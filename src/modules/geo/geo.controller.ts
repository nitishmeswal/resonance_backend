import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { GeoService } from './geo.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../database/entities';

@ApiTags('geo')
@Controller('geo')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GeoController {
  constructor(private geoService: GeoService) {}

  @Post('location')
  @ApiOperation({ summary: 'Update user location with lat/lng (for Redis GEO)' })
  async updateLocation(
    @Req() req: Request,
    @Body() body: { latitude: number; longitude: number },
  ) {
    const user = req.user as User;
    await this.geoService.setUserLocation(user.id, body.latitude, body.longitude);
    return { success: true };
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby live users using Redis GEO (O(log n) query)' })
  async getNearbyUsers(
    @Req() req: Request,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    const user = req.user as User;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radius = radiusKm ? parseFloat(radiusKm) : 5;

    if (isNaN(lat) || isNaN(lng)) {
      return { error: 'Invalid coordinates', users: [] };
    }

    const nearbyUsers = await this.geoService.getNearbyUsersWithDetails(
      user.id,
      lat,
      lng,
      radius
    );

    return {
      count: nearbyUsers.length,
      radiusKm: radius,
      users: nearbyUsers,
    };
  }

  @Get('nearby/raw')
  @ApiOperation({ summary: 'Get nearby user IDs only (fast lookup)' })
  async getNearbyUserIds(
    @Req() req: Request,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    const user = req.user as User;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    const radius = radiusKm ? parseFloat(radiusKm) : 5;

    if (isNaN(lat) || isNaN(lng)) {
      return { error: 'Invalid coordinates', users: [] };
    }

    const nearbyUsers = await this.geoService.getNearbyUsers(
      user.id,
      lat,
      lng,
      radius
    );

    return {
      count: nearbyUsers.length,
      users: nearbyUsers,
    };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my current location from Redis' })
  async getMyLocation(@Req() req: Request) {
    const user = req.user as User;
    const location = await this.geoService.getUserLocation(user.id);
    return location || { error: 'Location not set' };
  }
}
