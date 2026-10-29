import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../../config/env.schema';
import type { IssuedRefreshToken } from './tokens/token.service';

export const REFRESH_COOKIE = 'ninno_rt';
const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function refreshCookieOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: config.auth.cookieSecure,
    path: REFRESH_COOKIE_PATH,
  };
}

/** Sets the httpOnly refresh cookie; shared by login and onboarding signup. */
export function setRefreshCookie(
  res: Response,
  refresh: IssuedRefreshToken,
  config: AppConfig,
): void {
  res.cookie(REFRESH_COOKIE, refresh.token, {
    ...refreshCookieOptions(config),
    expires: refresh.expiresAt,
  });
}
