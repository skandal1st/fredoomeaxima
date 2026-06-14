import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ZodBody } from '../common/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import {
  UserRole,
  UserStatus,
  SubscriptionSource,
  grantSubscriptionSchema,
  GrantSubscriptionInput,
} from '@aximavpn/shared';

@ApiTags('users')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly subscriptions: SubscriptionsService,
    private readonly audit: AuditService,
  ) {}

  // ── User self-service ──

  @Get('me/overview')
  @ApiOperation({ summary: 'Dashboard overview: active subscription + counts' })
  async myOverview(@CurrentUser() user: AuthUser) {
    const subscription = await this.subscriptions.getActive(user.id);
    return { subscription };
  }

  @Get('me/subscriptions')
  @ApiOperation({ summary: 'My subscription history' })
  mySubscriptions(@CurrentUser() user: AuthUser) {
    return this.subscriptions.listForUser(user.id);
  }

  // ── Admin ──

  @Roles(UserRole.ADMIN)
  @Get('admin/users')
  @ApiOperation({ summary: 'List users' })
  list(@Query('search') search?: string, @Query('cursor') cursor?: string) {
    return this.users.list({ search, cursor });
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/users/:id')
  @ApiOperation({ summary: 'User card' })
  card(@Param('id') id: string) {
    return this.users.getCard(id);
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/users/:id/block')
  @ApiOperation({ summary: 'Block a user' })
  async block(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const res = await this.users.setStatus(id, UserStatus.BLOCKED);
    await this.audit.record({ adminId: admin.id, action: 'user.block', entityType: 'User', entityId: id });
    return res;
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/users/:id/unblock')
  @ApiOperation({ summary: 'Unblock a user' })
  async unblock(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const res = await this.users.setStatus(id, UserStatus.ACTIVE);
    await this.audit.record({ adminId: admin.id, action: 'user.unblock', entityType: 'User', entityId: id });
    return res;
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/users/:id/subscription')
  @ApiOperation({ summary: 'Grant or extend a subscription manually' })
  async grant(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body(new ZodBody(grantSubscriptionSchema.omit({ userId: true }))) dto: Omit<GrantSubscriptionInput, 'userId'>,
  ) {
    const sub = await this.subscriptions.grantOrExtend({
      userId: id,
      tariffId: dto.tariffId,
      durationDays: dto.durationDays,
      source: SubscriptionSource.MANUAL,
    });
    await this.audit.record({
      adminId: admin.id,
      action: 'subscription.grant',
      entityType: 'User',
      entityId: id,
      metadata: { tariffId: dto.tariffId, durationDays: dto.durationDays },
    });
    return sub;
  }
}
