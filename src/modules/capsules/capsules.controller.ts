import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';

import { CapsulesService, CreateCapsuleDto } from './capsules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../database/entities';

@ApiTags('capsules')
@Controller('capsules')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CapsulesController {
  constructor(private capsulesService: CapsulesService) {}

  @Post()
  @ApiOperation({ summary: 'Drop a time capsule at current location' })
  async createCapsule(@Req() req: Request, @Body() dto: CreateCapsuleDto) {
    const user = req.user as User;
    return this.capsulesService.createCapsule(user.id, dto);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Get nearby capsules' })
  async getNearbyCapsules(
    @Req() req: Request,
    @Query('geohash') geohash: string,
    @Query('radius') radius?: string,
  ) {
    const user = req.user as User;
    return this.capsulesService.getNearbyCapsules(
      user.id,
      geohash,
      radius ? parseInt(radius) : 500,
    );
  }

  @Post(':id/discover')
  @ApiOperation({ summary: 'Discover a capsule' })
  async discoverCapsule(
    @Req() req: Request,
    @Param('id') id: string,
    @Body('geohash') geohash?: string,
  ) {
    const user = req.user as User;
    return this.capsulesService.discoverCapsule(user.id, id, geohash);
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like a discovered capsule' })
  async likeCapsule(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as User;
    return this.capsulesService.likeCapsule(user.id, id);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get my dropped capsules' })
  async getMyCapsules(@Req() req: Request) {
    const user = req.user as User;
    return this.capsulesService.getMyCapsules(user.id);
  }

  @Get('discoveries')
  @ApiOperation({ summary: 'Get my discovered capsules' })
  async getMyDiscoveries(@Req() req: Request) {
    const user = req.user as User;
    return this.capsulesService.getMyDiscoveries(user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete my capsule' })
  async deleteCapsule(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as User;
    await this.capsulesService.deleteCapsule(user.id, id);
    return { success: true };
  }
}
