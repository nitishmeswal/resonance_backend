import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BlendService } from './blend.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface CreateBlendDto {
  targetUserId: string;
}

@Controller('blend')
@UseGuards(JwtAuthGuard)
export class BlendController {
  constructor(private blendService: BlendService) {}

  @Post()
  async createBlend(@Req() req: any, @Body() dto: CreateBlendDto) {
    const userId = req.user.id;
    const result = await this.blendService.createBlend(userId, dto.targetUserId);
    return result;
  }
}
