import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@ninno/contracts';
import { PrismaService } from '../../database/prisma.service';
import { TokenService } from '../../modules/auth/tokens/token.service';
import { AppException } from '../errors/app.exception';
import { type AuthedRequest, IS_PUBLIC } from './auth.decorators';

/** Global: every route needs a valid access token unless marked @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const [scheme, token] = (req.header('authorization') ?? '').split(' ');
    const userId = scheme === 'Bearer' && token ? this.tokens.verifyAccessToken(token) : null;
    const user = userId
      ? await this.prisma.user.findFirst({
          where: { id: userId, deletedAt: null },
          select: { id: true },
        })
      : null;
    if (!user) {
      throw new AppException(ErrorCode.Unauthorized, HttpStatus.UNAUTHORIZED, 'Please sign in.');
    }
    req.user = { id: user.id };
    return true;
  }
}
