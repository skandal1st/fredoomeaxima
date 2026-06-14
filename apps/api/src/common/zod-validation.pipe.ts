import { PipeTransform, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Validates a request body against a shared zod schema and returns the parsed,
 * typed value. Usage: `@Body(new ZodBody(createTariffSchema)) dto: CreateTariffInput`.
 */
export class ZodBody<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    return result.data;
  }
}
