import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, type UrlTree } from '@angular/router';
import type { AuthSession, MeResponse } from '@ninno/contracts';
import { firstValueFrom } from 'rxjs';
import { describeLoginError } from './auth-errors';
import { authInterceptor } from './auth.interceptor';
import { AuthStore, areaFor, landingPath } from './auth.store';
import { landing, residentArea, signedIn, signedOut, staffArea } from './guards';
import { HttpErrorResponse } from '@angular/common/http';

const me = (roles: MeResponse['memberships'][number]['role'][]): MeResponse => ({
  id: 'u1',
  name: 'Demo Owner',
  phoneMasked: '+91 ••••••0002',
  memberships: roles.map((role) => ({
    organizationId: 'o1',
    organizationName: 'Ninno Demo Stays',
    hostelId: null,
    hostelName: null,
    role,
  })),
});
type Roles = MeResponse['memberships'][number]['role'][];

const session = (token: string, roles: Roles = ['OWNER']): AuthSession => ({
  accessToken: token,
  expiresInSeconds: 900,
  user: me(roles),
});

function setup() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  });
  return {
    store: TestBed.inject(AuthStore),
    http: TestBed.inject(HttpClient),
    backend: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve));

describe('AuthStore', () => {
  it('restores a session from the refresh cookie on start', async () => {
    const { store, backend } = setup();
    const restored = store.restore();
    backend.expectOne('/api/v1/auth/refresh').flush(session('t1'));
    await restored;
    expect(store.status()).toBe('signedIn');
    expect(store.token()).toBe('t1');
    expect(store.area()).toBe('staff');
  });

  it('is signed out when there is no valid refresh cookie', async () => {
    const { store, backend } = setup();
    const restored = store.restore();
    backend
      .expectOne('/api/v1/auth/refresh')
      .flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });
    await restored;
    expect(store.status()).toBe('signedOut');
    expect(store.token()).toBeNull();
  });

  it('keeps tokens out of web storage', async () => {
    const { store, backend } = setup();
    const verified = store.verifyCode('9000000002', '123456');
    backend.expectOne('/api/v1/auth/otp/verify').flush(session('secret-token'));
    await verified;
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage });
    expect(stored).not.toContain('secret-token');
  });

  it('logs out on the server and clears the client even if the call fails', async () => {
    const { store, backend } = setup();
    const verified = store.verifyCode('9000000002', '123456');
    backend.expectOne('/api/v1/auth/otp/verify').flush(session('t1'));
    await verified;
    const out = store.logout().catch(() => undefined);
    backend.expectOne('/api/v1/auth/logout').flush(null, { status: 500, statusText: 'Error' });
    await out;
    expect(store.status()).toBe('signedOut');
    expect(store.user()).toBeNull();
  });
});

describe('authInterceptor', () => {
  async function signIn(ctx: ReturnType<typeof setup>, token = 'old') {
    const verified = ctx.store.verifyCode('9000000002', '123456');
    ctx.backend.expectOne('/api/v1/auth/otp/verify').flush(session(token));
    await verified;
  }

  it('adds the bearer token to protected API calls, but not to the login/refresh calls', async () => {
    const ctx = setup();
    await signIn(ctx);
    const done = firstValueFrom(ctx.http.get('/api/v1/auth/me'));
    const me = ctx.backend.expectOne('/api/v1/auth/me');
    expect(me.request.headers.get('Authorization')).toBe('Bearer old');
    me.flush({});
    await done;

    const refreshed = ctx.store.refresh();
    const refresh = ctx.backend.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    refresh.flush(session('new'));
    await refreshed;
  });

  it('refreshes once for concurrent 401s and retries each call with the new token', async () => {
    const ctx = setup();
    await signIn(ctx);
    const a = firstValueFrom(ctx.http.get('/api/v1/things/a'));
    const b = firstValueFrom(ctx.http.get('/api/v1/things/b'));
    for (const url of ['/api/v1/things/a', '/api/v1/things/b']) {
      ctx.backend.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    }
    await flushMicrotasks();
    const refreshes = ctx.backend.match('/api/v1/auth/refresh');
    expect(refreshes).toHaveLength(1);
    refreshes[0]?.flush(session('new'));
    await flushMicrotasks();
    for (const url of ['/api/v1/things/a', '/api/v1/things/b']) {
      const retry = ctx.backend.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
      retry.flush({ ok: url });
    }
    await expect(a).resolves.toEqual({ ok: '/api/v1/things/a' });
    await expect(b).resolves.toEqual({ ok: '/api/v1/things/b' });
  });

  it('signs out and sends the user to login when the refresh fails', async () => {
    const ctx = setup();
    await signIn(ctx);
    const navigate = vi.spyOn(ctx.router, 'navigate').mockResolvedValue(true);
    const call = firstValueFrom(ctx.http.get('/api/v1/things/a')).catch((e: unknown) => e);
    ctx.backend
      .expectOne('/api/v1/things/a')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();
    ctx.backend
      .expectOne('/api/v1/auth/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(call).resolves.toBeInstanceOf(HttpErrorResponse);
    expect(ctx.store.status()).toBe('signedOut');
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { next: '/' } });
  });

  it('leaves non-API requests alone', async () => {
    const ctx = setup();
    await signIn(ctx);
    const done = firstValueFrom(ctx.http.get('/assets/x.json'));
    const asset = ctx.backend.expectOne('/assets/x.json');
    expect(asset.request.headers.has('Authorization')).toBe(false);
    asset.flush({});
    await done;
  });
});

describe('areas and guards', () => {
  const run = (guard: typeof signedIn, url = '/admin/residents') =>
    TestBed.runInInjectionContext(() => guard({} as never, { url } as never)) as boolean | UrlTree;
  const path = (result: boolean | UrlTree) => (result === true ? true : result.toString());

  function signedInAs(roles: MeResponse['memberships'][number]['role'][]) {
    const { store } = setup();
    (store as unknown as { accept(s: AuthSession): void }).accept(session('t', roles));
    return store;
  }

  it('maps roles to areas, staff winning over resident', () => {
    expect(areaFor(me(['OWNER']))).toBe('staff');
    expect(areaFor(me(['RESIDENT']))).toBe('resident');
    expect(areaFor(me(['RESIDENT', 'STAFF']))).toBe('staff');
    expect(areaFor(me([]))).toBe('none');
    expect(landingPath('none')).toBe('/no-access');
  });

  it('sends signed-out users to login with the page they wanted', () => {
    setup().store.clear();
    expect(path(run(signedIn))).toBe('/login?next=%2Fadmin%2Fresidents');
  });

  it('keeps residents out of the staff area', () => {
    signedInAs(['RESIDENT']);
    expect(path(run(staffArea))).toBe('/home');
    expect(path(run(residentArea))).toBe(true);
  });

  it('keeps staff out of the resident area unless they also live there', () => {
    signedInAs(['MANAGER']);
    expect(path(run(residentArea))).toBe('/admin');
    expect(path(run(staffArea))).toBe(true);
  });

  it('bounces signed-in users away from login, and never loops for users with no membership', () => {
    signedInAs([]);
    expect(path(run(signedOut))).toBe('/no-access');
    expect(path(run(landing))).toBe('/no-access');
  });
});

describe('describeLoginError', () => {
  const apiError = (status: number, body: object) =>
    new HttpErrorResponse({ status, error: body, url: '/api/v1/auth/otp' });

  it.each([
    ['OTP_INVALID', 401, /wrong or has expired/],
    ['OTP_LOCKED', 401, /Too many wrong attempts/],
    ['OTP_DELIVERY_FAILED', 502, /couldn't send the SMS/],
    ['RATE_LIMITED', 429, /Too many tries/],
  ])('%s → plain language', (code, status, message) => {
    expect(describeLoginError(apiError(status, { code })).message).toMatch(message);
  });

  it('carries the cooldown seconds', () => {
    const result = describeLoginError(
      apiError(429, { code: 'OTP_COOLDOWN', details: { retryAfterSeconds: 25 } }),
    );
    expect(result).toMatchObject({ code: 'OTP_COOLDOWN', retryAfterSeconds: 25 });
    expect(result.message).toContain('25 seconds');
  });

  it('recognises being offline', () => {
    expect(describeLoginError(new HttpErrorResponse({ status: 0 })).code).toBe('OFFLINE');
  });
});
