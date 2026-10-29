import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JwtService } from '@nestjs/jwt';
import { parse } from 'yaml';
import { wrongCode } from '../../../test/auth-doubles';
import { cookieFrom, createTestApp, requireCookie, type TestApp } from '../../../test/db/test-app';
import { truncateAll } from '../../../test/db/test-prisma';
import { TEST_ENV } from '../../../test/test-config';
import { seedPilot } from '../../database/seed/seed-pilot';
import { parsePilotHostel } from '../../database/seed/pilot-hostel.schema';
import { OTP_RULES } from './otp/otp.service';

const OWNER_PHONE = '+919876543210';
const UNKNOWN_PHONE = '+919123456780';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(() => t.app.close());
beforeEach(async () => {
  await truncateAll(t.prisma);
  t.sender.reset();
});

/** Seeds the placeholder pilot hostel with the owner on OWNER_PHONE. */
function seedOwner() {
  const file = resolve(__dirname, '../../../../../prisma/pilot-hostel.yaml');
  const data = parsePilotHostel(parse(readFileSync(file, 'utf8')), {
    SEED_OWNER_PHONE: OWNER_PHONE,
  });
  return seedPilot(t.prisma, data);
}

async function login(phone = OWNER_PHONE) {
  await t.http.post('/api/v1/auth/otp').send({ phone }).expect(202);
  const otp = t.sender.lastCodeFor(phone);
  const res = await t.http.post('/api/v1/auth/otp/verify').send({ phone, otp }).expect(200);
  return {
    accessToken: res.body.accessToken as string,
    cookie: requireCookie(res, 'ninno_rt'),
    res,
  };
}

describe('phone OTP login', () => {
  it('sends a code to a registered number and answers 202', async () => {
    await seedOwner();
    const res = await t.http.post('/api/v1/auth/otp').send({ phone: '98765 43210' }).expect(202);
    expect(res.body).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 30 });
    expect(t.sender.lastCodeFor(OWNER_PHONE)).toMatch(/^\d{6}$/);
  });

  it('answers an unknown number identically, without sending an SMS', async () => {
    const res = await t.http.post('/api/v1/auth/otp').send({ phone: UNKNOWN_PHONE }).expect(202);
    expect(res.body).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 30 });
    expect(t.sender.sent).toHaveLength(0);
  });

  it('rejects a malformed number with VALIDATION_FAILED', async () => {
    const res = await t.http.post('/api/v1/auth/otp').send({ phone: '12345' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details).toEqual([expect.objectContaining({ field: 'phone' })]);
  });

  it('enforces the resend cooldown over HTTP', async () => {
    await seedOwner();
    await t.http.post('/api/v1/auth/otp').send({ phone: OWNER_PHONE }).expect(202);
    t.clock.advance(5_000);
    const res = await t.http.post('/api/v1/auth/otp').send({ phone: OWNER_PHONE }).expect(429);
    expect(res.body).toMatchObject({ code: 'OTP_COOLDOWN', details: { retryAfterSeconds: 25 } });
  });

  it('logs in with the right code: token, memberships and a secure refresh cookie', async () => {
    const { organizationId } = await seedOwner();
    const { accessToken, res } = await login();

    expect(accessToken).toEqual(expect.any(String));
    expect(res.body).toMatchObject({
      expiresInSeconds: 900,
      user: {
        name: 'Demo Owner',
        phoneMasked: '+91 ••••••3210',
        memberships: [
          {
            organizationId,
            organizationName: 'Ninno Demo Stays',
            hostelId: null,
            hostelName: null,
            role: 'OWNER',
          },
        ],
      },
    });
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(setCookie).toMatch(/ninno_rt=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(setCookie).toMatch(/Secure/);
    expect(JSON.stringify(res.body)).not.toContain('ninno_rt');
  });

  it('rejects a wrong code with OTP_INVALID and audits it with the phone masked', async () => {
    await seedOwner();
    await t.http.post('/api/v1/auth/otp').send({ phone: OWNER_PHONE }).expect(202);
    const otp = wrongCode(t.sender.lastCodeFor(OWNER_PHONE));
    const res = await t.http
      .post('/api/v1/auth/otp/verify')
      .send({ phone: OWNER_PHONE, otp })
      .expect(401);
    expect(res.body.code).toBe('OTP_INVALID');

    const entry = await t.prisma.auditLog.findFirstOrThrow({
      where: { action: 'auth.otp_failed' },
    });
    expect(entry.actorUserId).toEqual(expect.any(String));
    expect(entry.ip).toBeTruthy();
    expect(entry.metadata).toEqual({ phone: '+91 ••••••3210' });
  });

  it('rejects any code for an unknown number with the same OTP_INVALID', async () => {
    await t.http.post('/api/v1/auth/otp').send({ phone: UNKNOWN_PHONE }).expect(202);
    const res = await t.http
      .post('/api/v1/auth/otp/verify')
      .send({ phone: UNKNOWN_PHONE, otp: '123456' })
      .expect(401);
    expect(res.body.code).toBe('OTP_INVALID');
  });

  it('locks after 5 wrong codes with OTP_LOCKED', async () => {
    await seedOwner();
    await t.http.post('/api/v1/auth/otp').send({ phone: OWNER_PHONE }).expect(202);
    const right = t.sender.lastCodeFor(OWNER_PHONE);
    let last;
    for (let i = 0; i < OTP_RULES.maxAttempts; i++) {
      last = await t.http
        .post('/api/v1/auth/otp/verify')
        .send({ phone: OWNER_PHONE, otp: wrongCode(right) });
    }
    expect(last?.body.code).toBe('OTP_LOCKED');
    const res = await t.http
      .post('/api/v1/auth/otp/verify')
      .send({ phone: OWNER_PHONE, otp: right });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('OTP_LOCKED');
  });

  it('applies the stricter per-IP limit to OTP routes only', async () => {
    const strict = await createTestApp({ env: { AUTH_RATE_LIMIT_PER_MINUTE: '2' } });
    try {
      for (const phone of ['+919000000011', '+919000000012']) {
        await strict.http.post('/api/v1/auth/otp').send({ phone }).expect(202);
      }
      const res = await strict.http.post('/api/v1/auth/otp').send({ phone: '+919000000013' });
      expect(res.status).toBe(429);
      expect(res.body.code).toBe('RATE_LIMITED');
      await strict.http.get('/health').expect((r) => expect(r.status).not.toBe(429));
    } finally {
      await strict.app.close();
    }
  });
});

describe('auth sessions', () => {
  it('accepts a fresh access token on protected routes', async () => {
    await seedOwner();
    const { accessToken } = await login();
    await t.http.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
  });

  it('rejects an expired access token', async () => {
    const { ownerUserId } = await seedOwner();
    const expired = new JwtService().sign(
      { sub: ownerUserId, typ: 'access', exp: Math.floor(Date.now() / 1000) - 60 },
      { secret: TEST_ENV.JWT_ACCESS_SECRET },
    );
    const res = await t.http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('refreshes: new access token and a different refresh cookie', async () => {
    await seedOwner();
    const { cookie } = await login();
    const res = await t.http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const next = cookieFrom(res, 'ninno_rt');
    expect(next).toBeDefined();
    expect(next).not.toBe(cookie);
  });

  it('rejects a refresh without the cookie', async () => {
    const res = await t.http.post('/api/v1/auth/refresh').expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('a replayed (already rotated) refresh token kills the whole login', async () => {
    await seedOwner();
    const { cookie: first } = await login();
    const rotated = await t.http.post('/api/v1/auth/refresh').set('Cookie', first).expect(200);
    const second = requireCookie(rotated, 'ninno_rt');

    await t.http.post('/api/v1/auth/refresh').set('Cookie', first).expect(401);
    await t.http.post('/api/v1/auth/refresh').set('Cookie', second).expect(401);
  });

  it('logout clears the cookie and the old refresh token stops working', async () => {
    await seedOwner();
    const { cookie } = await login();
    const res = await t.http.post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
    expect((res.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(/ninno_rt=;/);
    await t.http.post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('logout without a session still succeeds', async () => {
    await t.http.post('/api/v1/auth/logout').expect(204);
  });

  it('GET /auth/me lists the seeded owner’s OWNER membership', async () => {
    const { organizationId } = await seedOwner();
    const { accessToken } = await login();
    const res = await t.http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.memberships).toEqual([
      expect.objectContaining({ organizationId, hostelId: null, role: 'OWNER' }),
    ]);
    expect(res.body.phoneMasked).toBe('+91 ••••••3210');
  });

  it('records a login audit entry', async () => {
    const { organizationId } = await seedOwner();
    await login();
    const entry = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'auth.login' } });
    expect(entry.organizationId).toBe(organizationId);
  });
});
