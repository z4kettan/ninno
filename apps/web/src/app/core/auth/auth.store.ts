import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { AuthSession, MeResponse, RequestOtpResponse, Role } from '@ninno/contracts';
import { firstValueFrom } from 'rxjs';

export const API = '/api/v1';

/** Marks requests the auth interceptor must leave alone (the auth endpoints themselves). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);
const skipAuth = () => ({ context: new HttpContext().set(SKIP_AUTH, true) });

export type AuthStatus = 'unknown' | 'signedIn' | 'signedOut';
export type Area = 'staff' | 'resident' | 'none';

const STAFF_ROLES: readonly Role[] = ['OWNER', 'MANAGER', 'STAFF'];

/** Staff roles win: someone who is both staff and a resident lands in the staff area. */
export function areaFor(user: MeResponse | null): Area {
  const roles = user?.memberships.map((m) => m.role) ?? [];
  if (roles.some((r) => STAFF_ROLES.includes(r))) {
    return 'staff';
  }
  return roles.includes('RESIDENT') ? 'resident' : 'none';
}

/** Where a signed-in user belongs. Never "/login": that would loop with the signedOut guard. */
export function landingPath(area: Area): string {
  return area === 'staff' ? '/admin' : area === 'resident' ? '/home' : '/no-access';
}

/**
 * The signed-in user and their access token. The token lives only in this object (memory):
 * never in localStorage or sessionStorage. The refresh token is an httpOnly cookie the
 * browser sends to /api/v1/auth by itself.
 */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly http = inject(HttpClient);
  private accessToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  readonly status = signal<AuthStatus>('unknown');
  readonly user = signal<MeResponse | null>(null);
  readonly area = computed(() => areaFor(this.user()));
  readonly isResident = computed(
    () => this.user()?.memberships.some((m) => m.role === 'RESIDENT') ?? false,
  );
  /** The membership the staff shell shows (the first staff one). */
  readonly staffMembership = computed(
    () => this.user()?.memberships.find((m) => STAFF_ROLES.includes(m.role)) ?? null,
  );

  token(): string | null {
    return this.accessToken;
  }

  /** On app start: resume the session from the refresh cookie, if there is one. */
  async restore(): Promise<void> {
    await this.refresh();
  }

  requestCode(phoneDigits: string): Promise<RequestOtpResponse> {
    return firstValueFrom(
      this.http.post<RequestOtpResponse>(`${API}/auth/otp`, { phone: phoneDigits }, skipAuth()),
    );
  }

  async verifyCode(phoneDigits: string, otp: string): Promise<void> {
    const session = await firstValueFrom(
      this.http.post<AuthSession>(
        `${API}/auth/otp/verify`,
        { phone: phoneDigits, otp },
        skipAuth(),
      ),
    );
    this.accept(session);
  }

  /**
   * Exchanges the refresh cookie for a new access token. Concurrent callers share one request,
   * so a burst of 401s triggers a single refresh.
   */
  refresh(): Promise<boolean> {
    this.refreshing ??= firstValueFrom(
      this.http.post<AuthSession>(`${API}/auth/refresh`, {}, skipAuth()),
    )
      .then((session) => {
        this.accept(session);
        return true;
      })
      .catch(() => {
        this.clear();
        return false;
      })
      .finally(() => {
        this.refreshing = null;
      });
    return this.refreshing;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API}/auth/logout`, {}, skipAuth()));
    } finally {
      this.clear();
    }
  }

  /** Forgets the session locally (the server side is handled by logout or has already expired). */
  clear(): void {
    this.accessToken = null;
    this.user.set(null);
    this.status.set('signedOut');
  }

  private accept(session: AuthSession): void {
    this.accessToken = session.accessToken;
    this.user.set(session.user);
    this.status.set('signedIn');
  }
}
