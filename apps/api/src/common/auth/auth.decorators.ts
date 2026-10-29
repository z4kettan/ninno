import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@ninno/contracts';
import type { Request } from 'express';

export const IS_PUBLIC = 'ninno:isPublic';
export const IS_TENANT_SCOPED = 'ninno:tenantScoped';
export const ROLES = 'ninno:roles';
export const AUTH_THROTTLED = 'ninno:authThrottled';

export interface AuthUser {
  id: string;
}

/** The acting tenant, always derived from the caller's own memberships. */
export interface TenantContext {
  organizationId: string;
  /** null when acting through an organisation-wide membership. */
  hostelId: string | null;
  role: Role;
}

export type AuthedRequest = Request & { user?: AuthUser; tenant?: TenantContext };

/** Opts a route (or controller) out of the global authentication requirement. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Resolves `req.tenant` from the caller's memberships (see TenantGuard). */
export const TenantScoped = () => SetMetadata(IS_TENANT_SCOPED, true);

/** Allowed roles in the acting tenant. Implies {@link TenantScoped}. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Applies the stricter per-IP limit used for OTP endpoints. */
export const AuthThrottled = () => SetMetadata(AUTH_THROTTLED, true);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
  if (!user) {
    throw new Error('@CurrentUser() used on a route without authentication');
  }
  return user;
});

export const Tenant = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const tenant = ctx.switchToHttp().getRequest<AuthedRequest>().tenant;
  if (!tenant) {
    throw new Error('@Tenant() used on a route without @TenantScoped() or @Roles()');
  }
  return tenant;
});
