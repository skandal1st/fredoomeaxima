/** Shared zod schemas + inferred types used by both the API (validation) and the web app (forms/typing). */
import { z } from 'zod';

export const emailSchema = z.string().email().max(254);
export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshInput = z.infer<typeof refreshSchema>;

export const createTariffSchema = z.object({
  name: z.string().min(1).max(80),
  priceCents: z.number().int().min(0),
  currency: z.string().length(3).default('RUB'),
  durationDays: z.number().int().min(1).max(3650),
  deviceLimit: z.number().int().min(1).max(10000),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  countryIds: z.array(z.string()).default([]),
});
export type CreateTariffInput = z.infer<typeof createTariffSchema>;

export const grantSubscriptionSchema = z.object({
  userId: z.string(),
  tariffId: z.string(),
  /** Optional override for the period; defaults to tariff.durationDays. */
  durationDays: z.number().int().min(1).max(3650).optional(),
});
export type GrantSubscriptionInput = z.infer<typeof grantSubscriptionSchema>;

export const createCountrySchema = z.object({
  code: z.string().trim().length(2).toUpperCase(), // ISO 3166-1 alpha-2
  name: z.string().min(1).max(80),
  flagEmoji: z.string().max(8).optional(),
});
export type CreateCountryInput = z.infer<typeof createCountrySchema>;

export const createServerSchema = z.object({
  name: z.string().min(1).max(80),
  countryId: z.string(),
  ip: z.string().min(3).max(45),
  sshUser: z.string().min(1).max(64).default('root'),
  sshPort: z.number().int().min(1).max(65535).default(22),
  wgEndpointPort: z.number().int().min(1).max(65535).default(51820),
  // Agent HTTP endpoint. Optional — derived as http://<ip>:<agentPort> when omitted.
  agentUrl: z.string().url().optional(),
  agentPort: z.number().int().min(1).max(65535).default(8443),
  maxPeers: z.number().int().min(1).max(5000).default(200),
  monthlyCostCents: z.number().int().min(0).default(0),
  costCurrency: z.string().length(3).default('USD'),
  provider: z.string().max(80).optional(),
  nextRenewalAt: z.string().datetime().optional(),
  // SSH provisioning (write-only, never stored): if `provision` is true the panel
  // SSHes in with `sshPassword` and runs the install script remotely.
  provision: z.boolean().default(false),
  sshPassword: z.string().min(1).max(256).optional(),
});
export type CreateServerInput = z.infer<typeof createServerSchema>;

export const provisionServerSchema = z.object({
  password: z.string().min(1).max(256),
  host: z.string().min(3).max(255).optional(),
  sshUser: z.string().min(1).max(64).optional(),
  sshPort: z.number().int().min(1).max(65535).optional(),
});
export type ProvisionServerInput = z.infer<typeof provisionServerSchema>;

export const createPeerSchema = z.object({
  serverId: z.string(),
  label: z.string().max(80).optional(),
});
export type CreatePeerInput = z.infer<typeof createPeerSchema>;

export const upsertRouteGroupSchema = z.object({
  key: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  domains: z.array(z.string().min(1)).min(1),
  isEnabled: z.boolean().default(true),
});
export type UpsertRouteGroupInput = z.infer<typeof upsertRouteGroupSchema>;
