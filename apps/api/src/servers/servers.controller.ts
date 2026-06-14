import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  Header,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { existsSync, createReadStream } from 'fs';
import { ServersService } from './servers.service';
import { PrismaService } from '../common/prisma.service';
import { SshProvisionerService } from '../provisioning/ssh-provisioner.service';
import { TypedConfigService } from '../config/config.module';
import { Public, Roles, CurrentUser, AuthUser } from '../common/decorators';
import { ZodBody } from '../common/zod-validation.pipe';
import { AuditService } from '../audit/audit.service';
import {
  UserRole,
  createServerSchema,
  CreateServerInput,
  provisionServerSchema,
  ProvisionServerInput,
} from '@aximavpn/shared';

@ApiTags('servers')
@Controller()
export class ServersController {
  constructor(
    private readonly servers: ServersService,
    private readonly prisma: PrismaService,
    private readonly provisioner: SshProvisionerService,
    private readonly config: TypedConfigService,
    private readonly audit: AuditService,
  ) {}

  // ── Catalogue (authenticated users) ──

  @ApiBearerAuth()
  @Get('countries')
  @ApiOperation({ summary: 'VPN countries' })
  countries() {
    return this.prisma.vpnCountry.findMany({ orderBy: { name: 'asc' } });
  }

  @ApiBearerAuth()
  @Get('servers/available')
  @ApiOperation({ summary: 'Available servers (active, with free capacity)' })
  available(@Query('countryId') countryId?: string) {
    return this.servers.listAvailable(countryId);
  }

  // ── Agent bootstrap (public, token-gated) ──

  @Public()
  @Get('servers/agent-bundle')
  @Header('Content-Type', 'application/javascript')
  @ApiOperation({ summary: 'Built agent bundle (fallback for the manual curl flow)' })
  agentBundle(@Res() res: Response) {
    const path = this.config.get('AGENT_BUNDLE_PATH');
    if (!existsSync(path)) throw new NotFoundException('Agent bundle not available on this panel build');
    createReadStream(path).pipe(res);
  }

  @Public()
  @Get('servers/:id/install-script')
  @Header('Content-Type', 'text/x-shellscript')
  @ApiOperation({ summary: 'Install script body (install token required)' })
  installScript(@Param('id') id: string, @Query('token') token: string) {
    return this.servers.getInstallScript(id, token);
  }

  @Public()
  @Post('servers/:id/register')
  @ApiOperation({ summary: 'Agent self-registration (one-time install token)' })
  register(
    @Param('id') id: string,
    @Body() body: { installToken: string; serverPublicKey: string },
  ) {
    return this.servers.register({ serverId: id, installToken: body.installToken, serverPublicKey: body.serverPublicKey });
  }

  @Public()
  @Post('servers/:id/heartbeat')
  @HttpCode(200)
  @ApiOperation({ summary: 'Agent heartbeat (agent token in Authorization)' })
  heartbeat(@Param('id') id: string, @Req() req: Request, @Body() body: { peerCount?: number; wgUp?: boolean }) {
    const auth = req.headers.authorization ?? '';
    const agentToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    return this.servers.heartbeat({ serverId: id, agentToken, peerCount: body.peerCount, wgUp: body.wgUp });
  }

  // ── Admin CRUD ──

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/servers')
  list() {
    return this.servers.list();
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/servers/:id')
  get(@Param('id') id: string) {
    return this.servers.get(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/servers')
  @ApiOperation({ summary: 'Add a server; optionally provision it over SSH right away' })
  async create(@CurrentUser() admin: AuthUser, @Body(new ZodBody(createServerSchema)) dto: CreateServerInput) {
    const { server, installToken } = await this.servers.create(dto);
    const instructions = await this.servers.getInstallInstructions(server.id);
    await this.audit.record({ adminId: admin.id, action: 'server.create', entityType: 'VpnServer', entityId: server.id });

    let provisioning = false;
    if (dto.provision) {
      if (!dto.sshPassword) throw new BadRequestException('sshPassword is required to provision over SSH');
      // Fire-and-forget; the password is never stored.
      this.provisioner.start(server.id, {
        host: server.ip,
        port: server.sshPort,
        user: server.sshUser,
        password: dto.sshPassword,
      });
      await this.audit.record({ adminId: admin.id, action: 'server.provision', entityType: 'VpnServer', entityId: server.id });
      provisioning = true;
    }

    return { server, installToken, command: instructions.command, provisioning };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Post('admin/servers/:id/provision')
  @HttpCode(202)
  @ApiOperation({ summary: 'Provision (or re-run) a server over SSH' })
  async provision(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body(new ZodBody(provisionServerSchema)) dto: ProvisionServerInput,
  ) {
    const server = await this.servers.getRaw(id);
    if (!server.installToken) {
      throw new BadRequestException('Server already registered; nothing to provision');
    }
    this.provisioner.start(id, {
      host: dto.host ?? server.ip,
      port: dto.sshPort ?? server.sshPort,
      user: dto.sshUser ?? server.sshUser,
      password: dto.password,
    });
    await this.audit.record({ adminId: admin.id, action: 'server.provision', entityType: 'VpnServer', entityId: id });
    return { provisioning: true };
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/servers/:id/provision')
  @ApiOperation({ summary: 'Provisioning status + live log' })
  provisionState(@Param('id') id: string) {
    return this.provisioner.getState(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Get('admin/servers/:id/install')
  @ApiOperation({ summary: 'Re-fetch install command/script for a server' })
  install(@Param('id') id: string) {
    return this.servers.getInstallInstructions(id);
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Patch('admin/servers/:id')
  async update(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body(new ZodBody(createServerSchema.partial())) dto: Partial<CreateServerInput>,
  ) {
    const server = await this.servers.update(id, dto);
    await this.audit.record({ adminId: admin.id, action: 'server.update', entityType: 'VpnServer', entityId: id });
    return server;
  }

  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @Delete('admin/servers/:id')
  async remove(@CurrentUser() admin: AuthUser, @Param('id') id: string) {
    const res = await this.servers.remove(id);
    await this.audit.record({ adminId: admin.id, action: 'server.delete', entityType: 'VpnServer', entityId: id });
    return res;
  }
}
