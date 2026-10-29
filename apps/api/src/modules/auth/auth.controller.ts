import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthSession, MeResponse, RequestOtpResponse } from '@ninno/contracts';
import type { CookieOptions, Request, Response } from 'express';
import {
  type AuthUser,
  AuthThrottled,
  CurrentUser,
  Public,
} from '../../common/auth/auth.decorators';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';
import { AuthService } from './auth.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';
import type { IssuedRefreshToken, RequestMeta } from './tokens/token.service';

export const REFRESH_COOKIE = 'ninno_rt';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  @Public()
  @AuthThrottled()
  @Post('otp')
  @HttpCode(HttpStatus.ACCEPTED)
  requestCode(@Body() dto: RequestOtpDto, @Req() req: Request): Promise<RequestOtpResponse> {
    return this.auth.requestLoginCode(dto.phone, meta(req));
  }

  @Public()
  @AuthThrottled()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyCode(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const { session, refresh } = await this.auth.verifyLoginCode(dto.phone, dto.otp, meta(req));
    this.setRefreshCookie(res, refresh);
    return session;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const { session, refresh } = await this.auth.refresh(refreshCookie(req), meta(req));
    this.setRefreshCookie(res, refresh);
    return session;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(refreshCookie(req), meta(req));
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user.id);
  }

  private setRefreshCookie(res: Response, refresh: IssuedRefreshToken): void {
    res.cookie(REFRESH_COOKIE, refresh.token, {
      ...this.cookieOptions(),
      expires: refresh.expiresAt,
    });
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'strict',
      secure: this.config.auth.cookieSecure,
      path: REFRESH_COOKIE_PATH,
    };
  }
}

function refreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function meta(req: Request): RequestMeta {
  return { ip: req.ip ?? null, userAgent: req.header('user-agent') ?? null };
}
