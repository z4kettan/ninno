/**
 * Seeds the pilot hostel from prisma/pilot-hostel.yaml. Run with `pnpm db:seed`.
 * Validation happens before any write; an invalid file changes nothing.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { parse } from 'yaml';
import { PrismaClient } from '../apps/api/src/generated/prisma/client';
import { parsePilotHostel, SeedDataError } from '../apps/api/src/database/seed/pilot-hostel.schema';
import { seedPilot } from '../apps/api/src/database/seed/seed-pilot';

async function main(): Promise<void> {
  const file = resolve(__dirname, 'pilot-hostel.yaml');
  const data = parsePilotHostel(parse(readFileSync(file, 'utf8')), process.env);

  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set.');
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    const result = await seedPilot(prisma, data);
    const beds = await prisma.bed.count({ where: { hostelId: result.hostelId } });
    console.log(
      `Seeded "${data.hostel.name}": ${data.rooms.length} rooms, ${beds} beds, owner ${data.owner.name}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof SeedDataError ? error.message : error);
  process.exit(1);
});
