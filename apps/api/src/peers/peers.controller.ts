import { Body, Controller, Delete, Get, Param, Post, Res, Header } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { PeersService } from './peers.service';
import { CurrentUser, AuthUser, Roles } from '../common/decorators';
import { ZodBody } from '../common/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import { UserRole, createPeerSchema, CreatePeerInput } from '@aximavpn/shared';

@ApiTags('peers')
@ApiBearerAuth()
@Controller()
export class PeersController {
  constructor(
    private readonly peers: PeersService,
    private readonly audit: AuditService,
  ) {}

  @Get('peers')
  @ApiOperation({ summary: 'Current user peers' })
  list(@CurrentUser() user: AuthUser) {
    return this.peers.listForUser(user.id);
  }

  @Post('peers')
  @ApiOperation({ summary: 'Create a WireGuard peer (requires active subscription)' })
  create(@CurrentUser() user: AuthUser, @Body(new ZodBody(createPeerSchema)) dto: CreatePeerInput) {
    return this.peers.create(user.id, dto.serverId, dto.label);
  }

  @Get('peers/:id/config')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Download .conf' })
  async config(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    const conf = await this.peers.getConfig(user.id, id);
    res.setHeader('Content-Disposition', `attachment; filename="aximavpn-${id}.conf"`);
    res.send(conf);
  }

  @Get('peers/:id/qr')
  @ApiOperation({ summary: 'QR code (data URL) for the config' })
  async qr(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const dataUrl = await this.peers.getQrDataUrl(user.id, id);
    return { dataUrl };
  }

  @Delete('peers/:id')
  @ApiOperation({ summary: 'Revoke a peer' })
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.peers.revoke(user.id, id);
  }

  @Post('peers/:id/recreate')
  @ApiOperation({ summary: 'Recreate a peer (new keys/config)' })
  recreate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.peers.recreate(user.id, id);
  }

  // ── Admin ──

  @Roles(UserRole.ADMIN)
  @Delete('admin/peers/:id')
  @ApiOperation({ summary: 'Delete a user peer (admin)' })
  async adminDelete(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const res = await this.peers.adminDelete(id);
    await this.audit.record({ adminId: admin.id, action: 'peer.delete', entityType: 'WireguardPeer', entityId: id });
    return res;
  }
}
