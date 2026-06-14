import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AdminBillingService } from './admin-billing.service';
import { Roles } from '../common/decorators';
import { UserRole } from '@aximavpn/shared';

@ApiTags('admin-billing')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin/billing')
export class AdminBillingController {
  constructor(private readonly billing: AdminBillingService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Infra spend, revenue, renewals' })
  overview() {
    return this.billing.overview();
  }
}
