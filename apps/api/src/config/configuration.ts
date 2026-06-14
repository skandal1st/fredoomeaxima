import { z } from 'zod';

/** Validated, typed environment. Fails fast on boot if misconfigured. */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(4000),
  PANEL_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  WEB_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(2592000),

  // 32-byte key as 64 hex chars.
  ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be 64 hex chars (32 bytes)'),

  ADMIN_EMAIL: z.string().email().default('admin@aximavpn.local'),
  ADMIN_PASSWORD: z.string().default('ChangeMe_Admin123'),

  WG_SUBNET_CIDR: z.string().default('10.66.66.0/24'),
  WG_SERVER_ADDRESS: z.string().default('10.66.66.1/24'),
  WG_DNS: z.string().default('1.1.1.1'),
  WG_DEFAULT_ENDPOINT_PORT: z.coerce.number().default(51820),

  // Path to the built agent bundle the provisioner uploads via SFTP.
  AGENT_BUNDLE_PATH: z.string().default('/repo/apps/agent/dist/index.js'),

  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_ADMIN_CHAT_ID: z.string().optional().default(''),

  PAYMENT_PROVIDER: z.enum(['mock', 'yookassa']).default('mock'),
  YOOKASSA_SHOP_ID: z.string().optional().default(''),
  YOOKASSA_SECRET_KEY: z.string().optional().default(''),
});

export type AppConfig = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
