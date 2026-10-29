import type { TenantContext } from './auth.decorators';

/**
 * Prisma filters limiting rows to what the acting membership may see: its organisation and,
 * for a hostel-scoped membership, only that hostel. Anything outside is reported as not found.
 *
 * Combine with other conditions through `AND: [...]`, never by spreading: the `id` key here
 * would silently replace a requested id.
 */
export function hostelScope(tenant: TenantContext) {
  return {
    organizationId: tenant.organizationId,
    deletedAt: null,
    ...(tenant.hostelId ? { id: tenant.hostelId } : {}),
  };
}

/** Same as {@link hostelScope}, for rows that carry `organizationId` and `hostelId`. Combine via `AND`. */
export function inHostelScope(tenant: TenantContext) {
  return {
    organizationId: tenant.organizationId,
    ...(tenant.hostelId ? { hostelId: tenant.hostelId } : {}),
  };
}
