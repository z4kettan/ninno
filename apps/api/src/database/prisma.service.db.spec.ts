import { runDatabaseUrl } from '../../test/db/env';
import { testConfig } from '../../test/test-config';
import { PrismaService } from './prisma.service';

describe('PrismaService.isReachable', () => {
  const config = (databaseUrl: string) => testConfig({ DATABASE_URL: databaseUrl });

  it('is true for a running database', async () => {
    const prisma = new PrismaService(config(runDatabaseUrl()));
    await expect(prisma.isReachable()).resolves.toBe(true);
    await prisma.$disconnect();
  });

  it('is false (without throwing) when nothing listens', async () => {
    const prisma = new PrismaService(config('postgresql://u:p@127.0.0.1:1/none'));
    await expect(prisma.isReachable(1000)).resolves.toBe(false);
    await prisma.$disconnect().catch(() => undefined);
  });
});
