import { Injectable, Logger } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { PrismaService } from '../common/prisma.service';

/**
 * Split-tunnel route resolving is disabled: all peers now use a full tunnel
 * (AllowedIPs = 0.0.0.0/0), so there are no domains to re-resolve and no peers
 * to flag for updates. Kept as a no-op (and the RoutesService DI wiring intact)
 * for the upcoming whitelist/bypass feature, which will reuse route groups for
 * services that should go *around* the tunnel rather than through it.
 */
@Injectable()
export class RouteResolverScheduler {
  private readonly logger = new Logger(RouteResolverScheduler.name);

  constructor(
    private readonly routes: RoutesService,
    private readonly prisma: PrismaService,
  ) {}
}
