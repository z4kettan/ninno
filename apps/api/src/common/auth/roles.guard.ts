import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type Role } from '@ninno/contracts';
import { AppException } from '../errors/app.exception';
import { type AuthedRequest, ROLES } from './auth.decorators';

/** Checks @Roles() against the role resolved by TenantGuard for the acting tenant. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles) {
      return true;
    }
    const tenant = context.switchToHttp().getRequest<AuthedRequest>().tenant;
    if (!tenant || !roles.includes(tenant.role)) {
      throw new AppException(
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
        'You do not have permission to do this.',
      );
    }
    return true;
  }
}
