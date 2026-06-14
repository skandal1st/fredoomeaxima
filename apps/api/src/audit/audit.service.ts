import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface AuditEntry {
  adminId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

/** Append-only admin action log. Call from admin-only service methods. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.adminAction.create({
      data: {
        adminId: entry.adminId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: (entry.metadata as object) ?? undefined,
        ip: entry.ip,
      },
    });
  }

  list(params: { limit?: number; cursor?: string } = {}) {
    const limit = Math.min(params.limit ?? 50, 200);
    return this.prisma.adminAction.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      include: { admin: { select: { email: true } } },
    });
  }
}
