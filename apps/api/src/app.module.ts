import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './common/prisma.service';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TariffsModule } from './tariffs/tariffs.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { ServersModule } from './servers/servers.module';
import { AgentGatewayModule } from './agent-gateway/agent-gateway.module';
import { PeersModule } from './peers/peers.module';
import { RoutesModule } from './routes/routes.module';
import { HealthModule } from './health/health.module';
import { AdminBillingModule } from './admin-billing/admin-billing.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/telegram.service';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    CommonModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

    NotificationsModule,
    AuditModule,
    AgentGatewayModule,
    AuthModule,
    UsersModule,
    TariffsModule,
    SubscriptionsModule,
    PaymentsModule,
    ServersModule,
    PeersModule,
    RoutesModule,
    HealthModule,
    AdminBillingModule,
  ],
  providers: [
    // Order matters: authenticate, then authorize, then rate-limit.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
