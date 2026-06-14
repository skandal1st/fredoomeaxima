import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';
import { Public, Roles } from '../common/decorators';
import { UserRole } from '@aximavpn/shared';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get('healthz')
  @ApiOperation({ summary: 'Liveness probe' })
  healthz() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/servers/:id/health')
  @ApiOperation({ summary: 'Recent health checks for a server' })
  recent(@Param('id') id: string) {
    return this.health.recentChecks(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/servers/:id/health/run')
  @ApiOperation({ summary: 'Run a health check now' })
  run(@Param('id') id: string) {
    return this.health.checkServer(id);
  }
}
