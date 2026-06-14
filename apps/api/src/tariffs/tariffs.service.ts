import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTariffInput } from '@aximavpn/shared';

@Injectable()
export class TariffsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Public catalogue — active, public, non-archived tariffs only. */
  listActive() {
    return this.prisma.tariff.findMany({
      where: { isActive: true, isPublic: true, isArchived: false },
      orderBy: { priceCents: 'asc' },
      include: { allowedCountries: { select: { id: true, code: true, name: true, flagEmoji: true } } },
    });
  }

  /** Admin list — everything except archived (soft-deleted) tariffs. */
  listAll() {
    return this.prisma.tariff.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: 'desc' },
      include: { allowedCountries: { select: { id: true, code: true, name: true } } },
    });
  }

  async get(id: string) {
    const tariff = await this.prisma.tariff.findUnique({
      where: { id },
      include: { allowedCountries: true },
    });
    if (!tariff) throw new NotFoundException('Tariff not found');
    return tariff;
  }

  create(input: CreateTariffInput) {
    return this.prisma.tariff.create({
      data: {
        name: input.name,
        priceCents: input.priceCents,
        currency: input.currency,
        durationDays: input.durationDays,
        deviceLimit: input.deviceLimit,
        isActive: input.isActive,
        isPublic: input.isPublic,
        allowedCountries: { connect: input.countryIds.map((id) => ({ id })) },
      },
      include: { allowedCountries: true },
    });
  }

  async update(id: string, input: Partial<CreateTariffInput>) {
    await this.get(id);
    return this.prisma.tariff.update({
      where: { id },
      data: {
        name: input.name,
        priceCents: input.priceCents,
        currency: input.currency,
        durationDays: input.durationDays,
        deviceLimit: input.deviceLimit,
        isActive: input.isActive,
        isPublic: input.isPublic,
        ...(input.countryIds ? { allowedCountries: { set: input.countryIds.map((cid) => ({ id: cid })) } } : {}),
      },
      include: { allowedCountries: true },
    });
  }

  /** Soft-delete: hide everywhere but keep subscription/payment references intact. */
  async archive(id: string) {
    await this.get(id);
    await this.prisma.tariff.update({ where: { id }, data: { isArchived: true } });
    return { archived: true };
  }
}
