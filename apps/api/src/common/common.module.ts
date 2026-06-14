import { Global, Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

/** Cross-cutting providers that aren't already global (Prisma/Config are). */
@Global()
@Module({
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CommonModule {}
