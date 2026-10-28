import { isValidIndianPhone, normalizeIndianPhone, rupeesToPaise } from '@ninno/utils';
import { z } from 'zod';

const phone = z
  .string()
  .refine(isValidIndianPhone, 'must be a 10-digit Indian mobile number')
  .transform((value) => normalizeIndianPhone(value));

const rupees = z.union([z.number(), z.string()]).transform((value, ctx) => {
  try {
    return BigInt(rupeesToPaise(String(value)));
  } catch {
    ctx.addIssue({ code: 'custom', message: 'must be a rupee amount like 6500 or 6500.50' });
    return z.NEVER;
  }
});

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase-with-dashes');

const CAPACITY_BY_TYPE = { SINGLE: 1, DOUBLE: 2, TRIPLE: 3 } as const;

const room = z
  .object({
    number: z.coerce.string().min(1),
    floor: z.number().int(),
    type: z.enum(['SINGLE', 'DOUBLE', 'TRIPLE', 'DORM']),
    capacity: z.number().int().min(1).max(26).optional(),
    monthly_rent: rupees,
  })
  .transform((value, ctx) => {
    const capacity =
      value.type === 'DORM' ? value.capacity : (value.capacity ?? CAPACITY_BY_TYPE[value.type]);
    if (!capacity) {
      ctx.addIssue({ code: 'custom', path: ['capacity'], message: 'is required for DORM rooms' });
      return z.NEVER;
    }
    return { ...value, capacity };
  });

export const pilotHostelSchema = z
  .object({
    organization: z.object({
      name: z.string().min(1),
      slug,
      gstin: z.string().nullish(),
    }),
    hostel: z.object({
      name: z.string().min(1),
      slug,
      address_line1: z.string().min(1),
      address_line2: z.string().nullish(),
      city: z.string().min(1),
      state: z.string().min(1),
      pincode: z.coerce.string().regex(/^[1-9]\d{5}$/, 'must be a 6-digit PIN code'),
      latitude: z.number().min(-90).max(90).nullish(),
      longitude: z.number().min(-180).max(180).nullish(),
      phone,
      gender_policy: z.enum(['MALE', 'FEMALE', 'CO_LIVING']),
      amenities: z.array(z.string().min(1)).default([]),
      upi_vpa: z.string().nullish(),
      rules_text: z.string().default(''),
    }),
    billing: z.object({
      mode: z.enum(['CHECKIN_ANNIVERSARY', 'FIXED_DAY']),
      fixed_due_day: z.number().int().min(1).max(28).nullish(),
      grace_days: z.number().int().min(0).default(5),
      invoice_lead_days: z.number().int().min(0).default(7),
      security_deposit: rupees,
    }),
    rooms: z
      .array(room)
      .min(1)
      .refine(
        (rooms) => new Set(rooms.map((r) => r.number)).size === rooms.length,
        'room numbers must be unique',
      ),
    owner: z.object({
      name: z.string().min(1),
      phone,
      email: z.email().nullish(),
    }),
  })
  .refine((data) => data.billing.mode !== 'FIXED_DAY' || data.billing.fixed_due_day != null, {
    path: ['billing', 'fixed_due_day'],
    message: 'is required when mode is FIXED_DAY',
  });

export type PilotHostel = z.output<typeof pilotHostelSchema>;

export class SeedDataError extends Error {
  constructor(readonly issues: { path: string; message: string }[]) {
    super(
      `Invalid pilot hostel data:\n${issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n')}`,
    );
    this.name = 'SeedDataError';
  }
}

/** Validates the parsed YAML and applies env overrides. Throws {@link SeedDataError} naming each bad field. */
export function parsePilotHostel(raw: unknown, env: NodeJS.ProcessEnv = {}): PilotHostel {
  const result = pilotHostelSchema.safeParse(raw);
  if (!result.success) {
    throw new SeedDataError(
      result.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  const override = env['SEED_OWNER_PHONE'];
  if (override) {
    if (!isValidIndianPhone(override)) {
      throw new SeedDataError([
        { path: 'SEED_OWNER_PHONE', message: 'must be a 10-digit Indian mobile number' },
      ]);
    }
    result.data.owner.phone = normalizeIndianPhone(override);
  }
  return result.data;
}
