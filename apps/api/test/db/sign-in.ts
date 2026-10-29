import type { Role } from '@ninno/contracts';
import type { fixtures } from './fixtures';
import type { TestApp } from './test-app';

export interface SignedInUser {
  id: string;
  phone: string;
  /** `Bearer <access token>`, ready for the Authorization header. */
  auth: string;
}

/** Signs a user in through the real OTP endpoints and returns their bearer header. */
export async function signIn(
  t: TestApp,
  user: { id: string; phone: string },
): Promise<SignedInUser> {
  await t.http.post('/api/v1/auth/otp').send({ phone: user.phone }).expect(202);
  const otp = t.sender.lastCodeFor(user.phone);
  const res = await t.http
    .post('/api/v1/auth/otp/verify')
    .send({ phone: user.phone, otp })
    .expect(200);
  return { id: user.id, phone: user.phone, auth: `Bearer ${res.body.accessToken as string}` };
}

/** Creates a user with these memberships and signs them in. */
export async function memberWith(
  t: TestApp,
  make: ReturnType<typeof fixtures>,
  memberships: { organizationId: string; hostelId?: string; role: Role }[],
): Promise<SignedInUser> {
  const user = await make.user();
  for (const m of memberships) {
    await t.prisma.membership.create({ data: { userId: user.id, ...m } });
  }
  return signIn(t, user);
}
