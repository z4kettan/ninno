import { JwtService } from '@nestjs/jwt';
import { TestClock } from '../../../../test/auth-doubles';
import { fixtures } from '../../../../test/db/fixtures';
import { createTestPrisma, truncateAll } from '../../../../test/db/test-prisma';
import { testConfig } from '../../../../test/test-config';
import type { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SESSION_RULES, TokenService } from './token.service';

const prisma = createTestPrisma();
const make = fixtures(prisma);

let clock: TestClock;
let tokens: TokenService;
let userId: string;

beforeEach(async () => {
  await truncateAll(prisma);
  clock = new TestClock();
  const db = prisma as unknown as PrismaService;
  tokens = new TokenService(db, new JwtService(), new AuditService(db), testConfig(), clock);
  userId = (await make.user()).id;
});

afterAll(() => prisma.$disconnect());

const meta = { ip: '203.0.113.7', userAgent: 'jest' };

describe('TokenService', () => {
  describe('access tokens', () => {
    it('round-trips the user id', () => {
      const token = tokens.issueAccessToken(userId);
      expect(tokens.verifyAccessToken(token)).toBe(userId);
    });

    it('rejects tampered tokens and tokens signed with another secret', () => {
      const token = tokens.issueAccessToken(userId);
      expect(tokens.verifyAccessToken(`${token}x`)).toBeNull();
      const foreign = new JwtService().sign(
        { sub: userId, typ: 'access' },
        { secret: 'x'.repeat(32) },
      );
      expect(tokens.verifyAccessToken(foreign)).toBeNull();
    });

    it('expires after 15 minutes', () => {
      jest.useFakeTimers({ now: Date.now() });
      try {
        const token = tokens.issueAccessToken(userId);
        jest.setSystemTime(Date.now() + SESSION_RULES.accessTtlSeconds * 1000 + 1000);
        expect(tokens.verifyAccessToken(token)).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('refresh tokens', () => {
    it('stores only a hash of the token', async () => {
      const { token } = await tokens.startSession(userId, meta);
      const rows = await prisma.refreshToken.findMany();
      expect(rows).toHaveLength(1);
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it('rotates: the new token works, the old one no longer does', async () => {
      const first = await tokens.startSession(userId, meta);
      const { userId: owner, refresh: second } = await tokens.rotate(first.token, meta);
      expect(owner).toBe(userId);
      expect(second.token).not.toBe(first.token);
      await expect(tokens.rotate(second.token, meta)).resolves.toBeTruthy();
    });

    it('detects reuse of a rotated token and revokes the whole family', async () => {
      const first = await tokens.startSession(userId, meta);
      const { refresh: second } = await tokens.rotate(first.token, meta);

      await expect(tokens.rotate(first.token, meta)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      await expect(tokens.rotate(second.token, meta)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      const audit = await prisma.auditLog.findFirst({ where: { action: 'auth.refresh_reuse' } });
      expect(audit?.actorUserId).toBe(userId);
    });

    it('does not touch other logins of the same user', async () => {
      const phone = await tokens.startSession(userId, meta);
      const laptop = await tokens.startSession(userId, meta);
      await tokens.rotate(phone.token, meta);
      await expect(tokens.rotate(phone.token, meta)).rejects.toThrow();
      await expect(tokens.rotate(laptop.token, meta)).resolves.toBeTruthy();
    });

    it('rejects an expired refresh token', async () => {
      const { token } = await tokens.startSession(userId, meta);
      clock.advance(SESSION_RULES.refreshTtlMs);
      await expect(tokens.rotate(token, meta)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('rejects an unknown token', async () => {
      await expect(tokens.rotate('not-a-real-token', meta)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('logout revokes the family so the token cannot be refreshed', async () => {
      const { token } = await tokens.startSession(userId, meta);
      await expect(tokens.revoke(token)).resolves.toBe(userId);
      await expect(tokens.rotate(token, meta)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('logout with an unknown token is a no-op', async () => {
      await expect(tokens.revoke('nope')).resolves.toBeNull();
    });
  });
});
