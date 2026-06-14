/**
 * Shared status/role constants mirrored from the Prisma schema.
 *
 * These use `as const` objects (not TS `enum`) so each member's type is a plain
 * string literal — which is assignable to / comparable with Prisma's generated
 * enum unions. This lets api, web and agent share one definition without enum
 * incompatibility friction.
 */

export const UserRole = { USER: 'USER', ADMIN: 'ADMIN' } as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = { ACTIVE: 'ACTIVE', BLOCKED: 'BLOCKED' } as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const SubscriptionSource = { PAYMENT: 'PAYMENT', MANUAL: 'MANUAL' } as const;
export type SubscriptionSource = (typeof SubscriptionSource)[keyof typeof SubscriptionSource];

export const PaymentStatus = {
  PENDING: 'PENDING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  /** Marked paid by an admin without a provider transaction. */
  MANUAL: 'MANUAL',
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const ServerStatus = {
  /** Created in panel, install script not yet run / not registered. */
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
  MAINTENANCE: 'MAINTENANCE',
  /** Health checks failing. */
  UNREACHABLE: 'UNREACHABLE',
} as const;
export type ServerStatus = (typeof ServerStatus)[keyof typeof ServerStatus];

export const PeerStatus = { ACTIVE: 'ACTIVE', REVOKED: 'REVOKED' } as const;
export type PeerStatus = (typeof PeerStatus)[keyof typeof PeerStatus];

export const ServerCostStatus = { PAID: 'PAID', PENDING: 'PENDING', OVERDUE: 'OVERDUE' } as const;
export type ServerCostStatus = (typeof ServerCostStatus)[keyof typeof ServerCostStatus];

export const ProvisionStatus = {
  /** Never provisioned via SSH (manual curl flow or not started). */
  NONE: 'NONE',
  RUNNING: 'RUNNING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;
export type ProvisionStatus = (typeof ProvisionStatus)[keyof typeof ProvisionStatus];
