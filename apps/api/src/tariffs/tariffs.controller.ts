import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TariffsService } from './tariffs.service';
import { Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ZodBody } from '../common/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { UserRole, createTariffSchema, CreateTariffInput } from '@aximavpn/shared';

@ApiTags('tariffs')
@ApiBearerAuth()
@Controller()
export class TariffsController {
  constructor(
    private readonly tariffs: TariffsService,
    private readonly audit: AuditService,
  ) {}

  @Get('tariffs')
  @ApiOperation({ summary: 'Active tariffs (public catalogue for logged-in users)' })
  listActive() {
    return this.tariffs.listActive();
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/tariffs')
  @ApiOperation({ summary: 'All tariffs (admin)' })
  listAll() {
    return this.tariffs.listAll();
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/tariffs')
  @ApiOperation({ summary: 'Create a tariff' })
  async create(@CurrentUser() admin: AuthUser, @Body(new ZodBody(createTariffSchema)) dto: CreateTariffInput) {
    const tariff = await this.tariffs.create(dto);
    await this.audit.record({ adminId: admin.id, action: 'tariff.create', entityType: 'Tariff', entityId: tariff.id });
    return tariff;
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/tariffs/:id')
  @ApiOperation({ summary: 'Update a tariff' })
  async update(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body(new ZodBody(createTariffSchema.partial())) dto: Partial<CreateTariffInput>,
  ) {
    const tariff = await this.tariffs.update(id, dto);
    await this.audit.record({ adminId: admin.id, action: 'tariff.update', entityType: 'Tariff', entityId: id });
    return tariff;
  }

  @Roles(UserRole.ADMIN)
  @Delete('admin/tariffs/:id')
  @ApiOperation({ summary: 'Archive (soft-delete) a tariff' })
  async remove(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const res = await this.tariffs.archive(id);
    await this.audit.record({ adminId: admin.id, action: 'tariff.archive', entityType: 'Tariff', entityId: id });
    return res;
  }
}
