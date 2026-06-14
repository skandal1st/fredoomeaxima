import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule, ConfigService } from '@nestjs/config';
import { validateEnv, AppConfig } from './configuration';

/**
 * Typed config accessor. Use `TypedConfigService.get('JWT_ACCESS_SECRET')`
 * for autocompletion and validated values.
 */
export class TypedConfigService {
  constructor(private readonly inner: ConfigService) {}
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.inner.get(key as string) as AppConfig[K];
  }
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      // Load the monorepo-root .env first, then a local apps/api/.env override.
      envFilePath: ['.env', '../../.env'],
      validate: validateEnv,
    }),
  ],
  providers: [
    {
      provide: TypedConfigService,
      useFactory: (cfg: ConfigService) => new TypedConfigService(cfg),
      inject: [ConfigService],
    },
  ],
  exports: [TypedConfigService],
})
export class AppConfigModule {}
