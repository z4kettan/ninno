import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthSession, MeResponse, RequestOtpResponse } from '@ninno/contracts';
import type { Request, Response } from 'express';
import {
  type AuthUser,
  AuthThrottled,
  CurrentUser,
  Public,
} from '../../common/auth/auth.decorators';
import { requestMeta as meta } from '../../common/http/request-meta';
import { InjectConfig } from '../../config/config.module';
import type { AppConfig } from '../../config/env.schema';
import { AuthService } from './auth.service';
import { RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { REFRESH_COOKIE, refreshCookieOptions, setRefreshCookie } from './refresh-cookie';

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
    setRefreshCookie(res, refresh, this.config);
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
    setRefreshCookie(res, refresh, this.config);
    return session;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(refreshCookie(req), meta(req));
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions(this.config));
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<MeResponse> {
    return this.auth.me(user.id);
  }
}

function refreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
