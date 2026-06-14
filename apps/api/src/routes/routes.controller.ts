import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoutesService } from './routes.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ZodBody } from '../common/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { UserRole, upsertRouteGroupSchema, UpsertRouteGroupInput } from '@aximavpn/shared';

@ApiTags('routes')
@ApiBearerAuth()
@Controller()
export class RoutesController {
  constructor(
    private readonly routes: RoutesService,
    private readonly audit: AuditService,
  ) {}

  @Get('routes/groups')
  @ApiOperation({ summary: 'Route groups (split-tunnel services)' })
  groups() {
    return this.routes.listGroups();
  }

  @Get('routes/current')
  @ApiOperation({ summary: 'Current route list version + CIDRs' })
  current() {
    return this.routes.getCurrentVersion();
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/routes/groups')
  @ApiOperation({ summary: 'Create/update a route group' })
  async upsert(@CurrentUser() admin: AuthUser, @Body(new ZodBody(upsertRouteGroupSchema)) dto: UpsertRouteGroupInput) {
    const group = await this.routes.upsertGroup(dto);
    await this.audit.record({ adminId: admin.id, action: 'route_group.upsert', entityType: 'RouteGroup', entityId: group.id });
    return group;
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/routes/groups/:key/enabled')
  setEnabled(@Param('key') key: string, @Body() body: { isEnabled: boolean }) {
    return this.routes.setEnabled(key, body.isEnabled);
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/routes/resolve')
  @ApiOperation({ summary: 'Resolve domains now and publish a new route list version' })
  async resolve(@CurrentUser() admin: AuthUser) {
    const result = await this.routes.resolveAndPublish('manual admin trigger');
    await this.audit.record({ adminId: admin.id, action: 'route_list.resolve', metadata: result });
    return result;
  }
}
