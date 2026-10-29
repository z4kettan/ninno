import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, ORGANIZATION_HEADER, type Role } from '@ninno/contracts';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../errors/app.exception';
import { type AuthedRequest, IS_TENANT_SCOPED, ROLES } from './auth.decorators';

const ROLE_RANK: Record<Role, number> = { OWNER: 4, MANAGER: 3, STAFF: 2, RESIDENT: 1 };

/**
 * For @TenantScoped()/@Roles() routes: resolves the acting organisation from the caller's
 * own active memberships. The X-Organization-Id header only *selects* among them; tenant
 * ids in request bodies are never used for scoping.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const scoped =
      this.reflector.getAllAndOverride<boolean>(IS_TENANT_SCOPED, targets) ||
      this.reflector.getAllAndOverride<Role[]>(ROLES, targets) !== undefined;
    if (!scoped) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.user) {
      throw new AppException(ErrorCode.Unauthorized, HttpStatus.UNAUTHORIZED, 'Please sign in.');
    }

    const memberships = await this.prisma.membership.findMany({
      where: { userId: req.user.id, deletedAt: null, organization: { deletedAt: null } },
      select: { organizationId: true, hostelId: true, role: true },
    });
    const organizationIds = [...new Set(memberships.map((m) => m.organizationId))];
    const requested = req.header(ORGANIZATION_HEADER);

    let organizationId: string | undefined;
    if (requested) {
      if (!organizationIds.includes(requested)) {
        throw new AppException(
          ErrorCode.Forbidden,
          HttpStatus.FORBIDDEN,
          'You do not have access to this organisation.',
        );
      }
      organizationId = requested;
    } else if (organizationIds.length === 1) {
      organizationId = organizationIds[0];
    } else if (organizationIds.length === 0) {
      throw new AppException(
        ErrorCode.Forbidden,
        HttpStatus.FORBIDDEN,
        'You are not a member of any organisation.',
      );
    } else {
      throw new AppException(
        ErrorCode.TenantRequired,
        HttpStatus.BAD_REQUEST,
        `You belong to several organisations; choose one with the ${ORGANIZATION_HEADER} header.`,
      );
    }

    // Within one organisation, act through the strongest membership. An organisation-wide
    // membership (hostelId null) wins over a hostel one of the same role.
    const [best] = memberships
      .filter((m) => m.organizationId === organizationId)
      .sort(
        (a, b) =>
          ROLE_RANK[b.role] - ROLE_RANK[a.role] ||
          Number(a.hostelId !== null) - Number(b.hostelId !== null),
      );
    if (!best) {
      throw new AppException(ErrorCode.Forbidden, HttpStatus.FORBIDDEN, 'Access denied.');
    }
    req.tenant = { organizationId: best.organizationId, hostelId: best.hostelId, role: best.role };
    return true;
  }
}
