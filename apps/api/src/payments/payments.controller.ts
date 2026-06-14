import { Body, Controller, Get, Param, Post, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { Public, Roles, CurrentUser, AuthUser } from '../common/decorators';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '@aximavpn/shared';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  @ApiBearerAuth()
  @Post('payments/checkout/:tariffId')
  @ApiOperation({ summary: 'Start checkout for a tariff' })
  checkout(@CurrentUser() user: AuthUser, @Param('tariffId') tariffId: string) {
    return this.payments.checkout(user.id, tariffId);
  }

  @ApiBearerAuth()
  @Get('payments/mine')
  @ApiOperation({ summary: 'Current user payment history' })
  mine(@CurrentUser() user: AuthUser) {
    return this.payments.listForUser(user.id);
  }

  @Public()
  @Post('payments/webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Payment provider webhook (public, signature-verified inside provider)' })
  async webhook(@Req() req: Request) {
    const raw = (req as Request & { rawBody?: string }).rawBody ?? JSON.stringify(req.body);
    const headers = req.headers as Record<string, string>;
    return this.payments.handleWebhook(headers, raw);
  }

  // ── Admin ──

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/payments')
  @ApiOperation({ summary: 'All payments (admin)' })
  listAll() {
    return this.payments.listAll();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/payments/:id/mark-paid')
  @ApiOperation({ summary: 'Manually mark a payment as paid (stage-1)' })
  async markPaid(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const payment = await this.payments.markManuallyPaid(id);
    await this.audit.record({ adminId: admin.id, action: 'payment.mark_paid', entityType: 'Payment', entityId: id });
    return payment;
  }
}
