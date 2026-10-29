import { Body, Controller, Get, Post } from '@nestjs/common';
import { fixtures } from '../../../test/db/fixtures';
import { createTestApp, type TestApp } from '../../../test/db/test-app';
import { truncateAll } from '../../../test/db/test-prisma';
import { Roles, Tenant, type TenantContext, TenantScoped } from './auth.decorators';

/** Test-only endpoints exercising the real guards. */
@Controller('access-probe')
class AccessProbeController {
  @Get('signed-in')
  signedIn() {
    return { ok: true };
  }

  @TenantScoped()
  @Get('tenant')
  tenant(@Tenant() tenant: TenantContext) {
    return tenant;
  }

  /** The body's organizationId must be ignored for scoping. */
  @TenantScoped()
  @Post('tenant')
  tenantFromBody(@Tenant() tenant: TenantContext, @Body() _body: unknown) {
    return tenant;
  }

  @Roles('OWNER', 'MANAGER')
  @Get('staff-only')
  staffOnly(@Tenant() tenant: TenantContext) {
    return tenant;
  }
}

let t: TestApp;
let make: ReturnType<typeof fixtures>;

beforeAll(async () => {
  t = await createTestApp({ controllers: [AccessProbeController] });
  make = fixtures(t.prisma);
});
afterAll(() => t.app.close());
beforeEach(async () => {
  await truncateAll(t.prisma);
  t.sender.reset();
});

/** Creates a user with the given memberships and returns a bearer token for them. */
async function userWith(
  memberships: { organizationId: string; hostelId?: string; role: TenantContext['role'] }[],
) {
  const user = await make.user();
  for (const m of memberships) {
    await t.prisma.membership.create({ data: { userId: user.id, ...m } });
  }
  await t.http.post('/api/v1/auth/otp').send({ phone: user.phone }).expect(202);
  const otp = t.sender.lastCodeFor(user.phone);
  const res = await t.http
    .post('/api/v1/auth/otp/verify')
    .send({ phone: user.phone, otp })
    .expect(200);
  return `Bearer ${res.body.accessToken as string}`;
}

describe('access control', () => {
  describe('authenticated by default', () => {
    it('rejects a protected route without a token', async () => {
      const res = await t.http.get('/api/v1/access-probe/signed-in').expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('rejects a garbage token', async () => {
      await t.http
        .get('/api/v1/access-probe/signed-in')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('serves public routes without a token', async () => {
      await t.http.get('/health').expect(200);
    });

    it('rejects a token whose user was deleted', async () => {
      const org = await make.organization();
      const auth = await userWith([{ organizationId: org.id, role: 'STAFF' }]);
      await t.prisma.user.updateMany({ data: { deletedAt: new Date() } });
      await t.http.get('/api/v1/access-probe/signed-in').set('Authorization', auth).expect(401);
    });
  });

  describe('tenant derived from memberships', () => {
    it('uses the only membership when no header is sent', async () => {
      const org = await make.organization();
      const auth = await userWith([{ organizationId: org.id, role: 'STAFF' }]);
      const res = await t.http
        .get('/api/v1/access-probe/tenant')
        .set('Authorization', auth)
        .expect(200);
      expect(res.body).toEqual({ organizationId: org.id, hostelId: null, role: 'STAFF' });
    });

    it('refuses a header naming an organisation the user does not belong to', async () => {
      const mine = await make.organization();
      const other = await make.organization();
      const auth = await userWith([{ organizationId: mine.id, role: 'OWNER' }]);
      const res = await t.http
        .get('/api/v1/access-probe/tenant')
        .set('Authorization', auth)
        .set('X-Organization-Id', other.id)
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('requires a header when the user belongs to several organisations', async () => {
      const a = await make.organization();
      const b = await make.organization();
      const auth = await userWith([
        { organizationId: a.id, role: 'OWNER' },
        { organizationId: b.id, role: 'STAFF' },
      ]);
      const res = await t.http
        .get('/api/v1/access-probe/tenant')
        .set('Authorization', auth)
        .expect(400);
      expect(res.body.code).toBe('TENANT_REQUIRED');

      const chosen = await t.http
        .get('/api/v1/access-probe/tenant')
        .set('Authorization', auth)
        .set('X-Organization-Id', b.id)
        .expect(200);
      expect(chosen.body).toMatchObject({ organizationId: b.id, role: 'STAFF' });
    });

    it('ignores an organisation id in the request body', async () => {
      const mine = await make.organization();
      const other = await make.organization();
      const auth = await userWith([{ organizationId: mine.id, role: 'OWNER' }]);
      const res = await t.http
        .post('/api/v1/access-probe/tenant')
        .set('Authorization', auth)
        .send({ organizationId: other.id })
        .expect(201);
      expect(res.body.organizationId).toBe(mine.id);
    });

    it('carries the hostel of a hostel-scoped membership', async () => {
      const org = await make.organization();
      const hostel = await make.hostel(org.id);
      const auth = await userWith([{ organizationId: org.id, hostelId: hostel.id, role: 'STAFF' }]);
      const res = await t.http
        .get('/api/v1/access-probe/tenant')
        .set('Authorization', auth)
        .expect(200);
      expect(res.body).toEqual({ organizationId: org.id, hostelId: hostel.id, role: 'STAFF' });
    });
  });

  describe('role checks', () => {
    it('forbids a RESIDENT on an OWNER/MANAGER endpoint', async () => {
      const org = await make.organization();
      const auth = await userWith([{ organizationId: org.id, role: 'RESIDENT' }]);
      const res = await t.http
        .get('/api/v1/access-probe/staff-only')
        .set('Authorization', auth)
        .expect(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('allows a MANAGER on an OWNER/MANAGER endpoint', async () => {
      const org = await make.organization();
      const auth = await userWith([{ organizationId: org.id, role: 'MANAGER' }]);
      await t.http.get('/api/v1/access-probe/staff-only').set('Authorization', auth).expect(200);
    });

    it('acts through the strongest membership within the organisation', async () => {
      const org = await make.organization();
      const hostel = await make.hostel(org.id);
      const auth = await userWith([
        { organizationId: org.id, hostelId: hostel.id, role: 'STAFF' },
        { organizationId: org.id, role: 'MANAGER' },
      ]);
      const res = await t.http
        .get('/api/v1/access-probe/staff-only')
        .set('Authorization', auth)
        .expect(200);
      expect(res.body).toEqual({ organizationId: org.id, hostelId: null, role: 'MANAGER' });
    });
  });
});
