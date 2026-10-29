import { createTestPrisma, truncateAll } from '../../../test/db/test-prisma';
import type { PrismaService } from '../../database/prisma.service';
import { AuditService } from './audit.service';

const prisma = createTestPrisma();
const audit = new AuditService(prisma as unknown as PrismaService);

beforeEach(() => truncateAll(prisma));
afterAll(() => prisma.$disconnect());

describe('AuditService', () => {
  it('stores an auth.otp_failed entry with the phone masked', async () => {
    await audit.log({
      action: 'auth.otp_failed',
      entity: 'user',
      ip: '203.0.113.7',
      metadata: { phone: '+919876543210', nested: { mobile: '9876543210' }, attempts: 3 },
    });

    const [row] = await prisma.auditLog.findMany();
    expect(row).toMatchObject({ action: 'auth.otp_failed', ip: '203.0.113.7' });
    expect(row?.metadata).toEqual({
      phone: '+91 ••••••3210',
      nested: { mobile: '+91 ••••••3210' },
      attempts: 3,
    });
    expect(JSON.stringify(row)).not.toContain('9876543210');
  });

  it('records platform-level events without an organisation', async () => {
    await audit.log({ action: 'auth.otp_requested', entity: 'otp' });
    const [row] = await prisma.auditLog.findMany();
    expect(row?.organizationId).toBeNull();
  });
});
