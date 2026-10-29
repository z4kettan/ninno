import { DRAFT_TOKEN_HEADER, type OnboardingForm } from '@ninno/contracts';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { wrongCode } from '../../../test/auth-doubles';
import { fixtures } from '../../../test/db/fixtures';
import { createTestApp, requireCookie, type TestApp } from '../../../test/db/test-app';
import { truncateAll } from '../../../test/db/test-prisma';
import { StorageService } from '../storage/storage.service';

let t: TestApp;
let make: ReturnType<typeof fixtures>;
let storage: StorageService;
let selfie: Buffer;
let idPhoto: Buffer;

beforeAll(async () => {
  t = await createTestApp();
  make = fixtures(t.prisma);
  storage = t.app.get(StorageService);
  // A selfie straight off a phone: EXIF with a camera name and GPS position.
  selfie = await sharp({
    create: { width: 1200, height: 1600, channels: 3, background: { r: 200, g: 170, b: 150 } },
  })
    .withExif({
      IFD0: { Make: 'TestPhone' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '9/1 58/1 0/1' },
    })
    .jpeg()
    .toBuffer();
  idPhoto = await sharp({
    create: { width: 1000, height: 630, channels: 3, background: { r: 230, g: 230, b: 220 } },
  })
    .png()
    .toBuffer();
});
afterAll(() => t.app.close());
beforeEach(async () => {
  await truncateAll(t.prisma);
  t.sender.reset();
});

let phoneSeq = 0;
const newPhone = () =>
  `+9197${String(Date.now()).slice(-6)}${String(phoneSeq++ % 100).padStart(2, '0')}`;

async function joinLink(overrides: { maxUses?: number } = {}) {
  const org = await make.organization();
  const hostel = await make.hostel(org.id, { name: 'Kayal House' });
  const link = await t.prisma.onboardingLink.create({
    data: {
      organizationId: org.id,
      hostelId: hostel.id,
      token: randomBytes(24).toString('base64url'),
      ...overrides,
    },
  });
  return { org, hostel, link, token: link.token };
}

interface Applicant {
  token: string;
  draftId: string;
  draftToken: string;
}

async function startDraft(token: string): Promise<Applicant> {
  const res = await t.http.post(`/api/v1/onboarding/${token}/drafts`).expect(201);
  return { token, draftId: res.body.draftId, draftToken: res.body.draftToken };
}

async function upload(
  a: Applicant,
  kind: 'selfie' | 'id-front' | 'id-back',
  body: Buffer,
  contentType: string,
): Promise<string> {
  const res = await t.http
    .post(`/api/v1/onboarding/${a.token}/uploads`)
    .set(DRAFT_TOKEN_HEADER, a.draftToken)
    .send({ kind, contentType, size: body.length })
    .expect(200);
  const put = await fetch(res.body.url as string, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: res.body.headers as Record<string, string>,
  });
  expect(put.status).toBe(200);
  return res.body.key as string;
}

async function uploadAll(a: Applicant, withBack = true) {
  return {
    selfieKey: await upload(a, 'selfie', selfie, 'image/jpeg'),
    idFrontKey: await upload(a, 'id-front', idPhoto, 'image/png'),
    idBackKey: withBack ? await upload(a, 'id-back', idPhoto, 'image/png') : null,
  };
}

function form(phone: string, overrides: Partial<OnboardingForm> = {}): OnboardingForm {
  return {
    fullName: '  Anjali Menon ',
    dob: '2004-08-24',
    gender: 'FEMALE',
    phone,
    altPhone: '',
    email: 'anjali@example.com',
    permanentAddress: {
      line1: '12 Temple Road',
      city: 'Thrissur',
      state: 'Kerala',
      pincode: '680001',
    },
    occupationType: 'STUDENT',
    institutionOrCompany: 'St. Teresa’s College',
    emergencyContact: { name: 'Ravi Menon', phone: '+919447000001', relation: 'Father' },
    idDocument: { type: 'AADHAAR', idNumber: '2341 2341 2346' },
    consentVersion: 'v1',
    ...overrides,
  };
}

async function sendCode(a: Applicant, phone: string): Promise<string> {
  await t.http
    .post(`/api/v1/onboarding/${a.token}/verify-phone`)
    .set(DRAFT_TOKEN_HEADER, a.draftToken)
    .send({ phone })
    .expect(202);
  return t.sender.lastCodeFor(phone);
}

const submit = (a: Applicant, body: object) =>
  t.http
    .post(`/api/v1/onboarding/${a.token}/submit`)
    .set(DRAFT_TOKEN_HEADER, a.draftToken)
    .send(body);

/** Uploads, verifies and submits a complete application. */
async function apply(token: string, phone: string, overrides: Partial<OnboardingForm> = {}) {
  const a = await startDraft(token);
  const files = await uploadAll(a);
  const otp = await sendCode(a, phone);
  return { a, files, res: await submit(a, { form: form(phone, overrides), files, otp }) };
}

async function rowCounts() {
  const [users, memberships, residents, documents] = await Promise.all([
    t.prisma.user.count(),
    t.prisma.membership.count(),
    t.prisma.resident.count(),
    t.prisma.identityDocument.count(),
  ]);
  return { users, memberships, residents, documents };
}

describe('submitting the join form', () => {
  it('signs the resident up, pending approval, with cleaned files and a masked ID', async () => {
    const { hostel, link, token } = await joinLink();
    const phone = newPhone();
    const { a, files, res } = await apply(token, phone);

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.memberships).toEqual([
      expect.objectContaining({ hostelId: hostel.id, hostelName: 'Kayal House', role: 'RESIDENT' }),
    ]);
    expect(requireCookie(res, 'ninno_rt')).toMatch(/^ninno_rt=/);
    await t.http
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${res.body.accessToken as string}`)
      .expect(200);

    const resident = await t.prisma.resident.findFirstOrThrow({
      include: { identityDocuments: true, user: true },
    });
    expect(resident).toMatchObject({
      status: 'PENDING_REVIEW',
      fullName: 'Anjali Menon',
      phone,
      altPhone: null,
      emergencyContactPhone: '+919447000001',
      consentVersion: 'v1',
      hostelId: hostel.id,
    });
    expect(resident.user).toMatchObject({ phone, name: 'Anjali Menon' });
    expect(resident.identityDocuments).toEqual([
      expect.objectContaining({
        type: 'AADHAAR',
        numberMasked: 'XXXX-XXXX-2346',
        verificationStatus: 'PENDING',
      }),
    ]);

    // The full Aadhaar number is nowhere in the database.
    const hits = await t.prisma.$queryRaw<{ n: bigint }[]>`
      SELECT (
        (SELECT count(*) FROM residents r WHERE row_to_json(r)::text LIKE '%234123412346%') +
        (SELECT count(*) FROM identity_documents d WHERE row_to_json(d)::text LIKE '%234123412346%') +
        (SELECT count(*) FROM audit_logs l WHERE row_to_json(l)::text LIKE '%2341%2341%2346%')
      ) AS n`;
    expect(Number(hits[0].n)).toBe(0);

    // Files moved to the resident's folder, cleaned; the uploads are gone.
    const doc = resident.identityDocuments[0];
    for (const key of [resident.photoKey, doc.frontKey, doc.backKey]) {
      if (!key) throw new Error('expected all three files to be stored');
      expect(key).toMatch(new RegExp(`^residents/${resident.id}/`));
      const stored = await sharp(await storage.read(key)).metadata();
      expect(stored.format).toBe('jpeg');
      expect(stored.exif).toBeUndefined();
    }
    for (const key of [files.selfieKey, files.idFrontKey, files.idBackKey ?? '']) {
      expect(await storage.head(key)).toBeNull();
    }
    expect(a.draftId).toBeTruthy();

    expect(
      (await t.prisma.onboardingLink.findUniqueOrThrow({ where: { id: link.id } })).useCount,
    ).toBe(1);
    expect(await t.prisma.auditLog.count({ where: { action: 'resident.applied' } })).toBe(1);
  });

  it('creates nothing when the code is wrong, and accepts the right one afterwards', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const a = await startDraft(token);
    const files = await uploadAll(a);
    const otp = await sendCode(a, phone);

    const wrong = await submit(a, { form: form(phone), files, otp: wrongCode(otp) }).expect(401);
    expect(wrong.body.code).toBe('OTP_INVALID');
    expect(await rowCounts()).toEqual({ users: 0, memberships: 0, residents: 0, documents: 0 });
    expect(await storage.head(files.selfieKey)).not.toBeNull();

    await submit(a, { form: form(phone), files, otp }).expect(201);
  });

  it('refuses a second application while one is pending', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    expect((await apply(token, phone)).res.status).toBe(201);
    t.clock.advance(60_000); // past the resend cooldown

    const { res } = await apply(token, phone);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ALREADY_REGISTERED');
    expect(await t.prisma.resident.count()).toBe(1);
  });

  it('lets a rejected applicant apply again and keeps the old record', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    await apply(token, phone);
    await t.prisma.resident.updateMany({
      data: { status: 'REJECTED', rejectionReason: 'Blurry ID' },
    });
    t.clock.advance(60_000);

    const { res } = await apply(token, phone);
    expect(res.status).toBe(201);
    const rows = await t.prisma.resident.findMany({ orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => r.status)).toEqual(['REJECTED', 'PENDING_REVIEW']);
    expect(new Set(rows.map((r) => r.userId)).size).toBe(1);
    expect(await t.prisma.membership.count()).toBe(1);
  });

  it('reuses an existing user, such as a staff member, and adds a RESIDENT membership', async () => {
    const { org, hostel, token } = await joinLink();
    const staff = await make.user();
    await t.prisma.membership.create({
      data: { userId: staff.id, organizationId: org.id, role: 'STAFF' },
    });

    const { res } = await apply(token, staff.phone);
    expect(res.status).toBe(201);
    expect(await t.prisma.user.count()).toBe(1);
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).name).toBe(
      'Test User',
    );
    const memberships = await t.prisma.membership.findMany({ where: { userId: staff.id } });
    expect(memberships.map((m) => [m.role, m.hostelId]).sort()).toEqual(
      [
        ['RESIDENT', hostel.id],
        ['STAFF', null],
      ].sort(),
    );
  });

  it('accepts a PAN card with only a front photo', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const a = await startDraft(token);
    const files = await uploadAll(a, false);
    const otp = await sendCode(a, phone);
    const res = await submit(a, {
      form: form(phone, { idDocument: { type: 'PAN', idNumber: 'abcde1234f' } }),
      files,
      otp,
    }).expect(201);
    expect(res.body.accessToken).toBeTruthy();
    const doc = await t.prisma.identityDocument.findFirstOrThrow();
    expect(doc).toMatchObject({ type: 'PAN', numberMasked: 'XXXXXX234F', backKey: null });
  });

  it('accepts a PDF of the ID and stores it as a PDF', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const a = await startDraft(token);
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
    const files = {
      selfieKey: await upload(a, 'selfie', selfie, 'image/jpeg'),
      idFrontKey: await upload(a, 'id-front', pdf, 'application/pdf'),
    };
    const otp = await sendCode(a, phone);
    await submit(a, {
      form: form(phone, { idDocument: { type: 'PASSPORT', idNumber: 'M1234567' } }),
      files,
      otp,
    }).expect(201);
    const doc = await t.prisma.identityDocument.findFirstOrThrow();
    expect(doc.frontKey).toMatch(/\.pdf$/);
    expect((await storage.read(doc.frontKey)).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('when something fails midway', () => {
  const residentFiles = () => storage.listOlderThan('residents/', new Date(Date.now() + 3600_000));

  it('removes the moved files if the database step fails', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const a = await startDraft(token);
    const files = await uploadAll(a);
    const otp = await sendCode(a, phone);
    const before = await residentFiles();

    const spy = jest
      .spyOn(t.prisma, '$transaction')
      .mockRejectedValueOnce(new Error('database went away'));
    try {
      await submit(a, { form: form(phone), files, otp }).expect(500);
    } finally {
      spy.mockRestore();
    }
    expect(await residentFiles()).toEqual(before);
    expect(await rowCounts()).toEqual({ users: 0, memberships: 0, residents: 0, documents: 0 });
    // The uploads are kept, for the daily sweep or a retry with a new code.
    expect(await storage.head(files.selfieKey)).not.toBeNull();
  });

  it('lets only one of two simultaneous submissions for the same number through', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const first = await startDraft(token);
    const second = await startDraft(token);
    const firstFiles = await uploadAll(first);
    const secondFiles = await uploadAll(second);
    const otp = await sendCode(first, phone);
    const before = new Set(await residentFiles());

    // Both carry the same valid code; at most one can consume it and register.
    const results = await Promise.all([
      submit(first, { form: form(phone), files: firstFiles, otp }),
      submit(second, { form: form(phone), files: secondFiles, otp }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 401].sort());
    expect(await t.prisma.resident.count()).toBe(1);
    const resident = await t.prisma.resident.findFirstOrThrow();
    const added = (await residentFiles()).filter((k) => !before.has(k));
    // Only the winner's three files were kept; the loser stored nothing or cleaned up.
    expect(added).toHaveLength(3);
    expect(added.every((k) => k.startsWith(`residents/${resident.id}/`))).toBe(true);
  });
});

describe('checks before the code is used', () => {
  it('requires the back photo for an Aadhaar', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const a = await startDraft(token);
    const files = await uploadAll(a, false);
    const otp = await sendCode(a, phone);
    const res = await submit(a, { form: form(phone), files, otp }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.details).toEqual([
      { field: 'files.idBackKey', errors: ['a photo of the back of this ID is required'] },
    ]);
    // The code was not used up by the failed attempt.
    await submit(a, {
      form: form(phone, { idDocument: { type: 'PAN', idNumber: 'ABCDE1234F' } }),
      files,
      otp,
    }).expect(201);
  });

  it('refuses a file whose content is not its declared type', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const a = await startDraft(token);
    const files = await uploadAll(a);
    // Overwrite the selfie with PDF bytes under the same .jpg key.
    await storage.write(files.selfieKey, Buffer.from('%PDF-1.7 pretending'), 'image/jpeg');
    const otp = await sendCode(a, phone);

    const res = await submit(a, { form: form(phone), files, otp }).expect(400);
    expect(res.body.code).toBe('FILE_INVALID');
    expect(await rowCounts()).toEqual({ users: 0, memberships: 0, residents: 0, documents: 0 });
  });

  it("refuses another draft's files", async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const other = await startDraft(token);
    const othersFiles = await uploadAll(other);
    const a = await startDraft(token);
    const otp = await sendCode(a, phone);

    const res = await submit(a, { form: form(phone), files: othersFiles, otp }).expect(400);
    expect(res.body.code).toBe('FILE_INVALID');
  });

  it('refuses a file that was never uploaded', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const a = await startDraft(token);
    const files = await uploadAll(a);
    const otp = await sendCode(a, phone);
    const missing = files.selfieKey.replace(/selfie-[0-9a-f-]+/, `selfie-${crypto.randomUUID()}`);
    const res = await submit(a, {
      form: form(phone),
      files: { ...files, selfieKey: missing },
      otp,
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_INVALID');
  });

  it('applies the form rules', async () => {
    const { token } = await joinLink();
    const phone = newPhone();
    const a = await startDraft(token);
    const files = await uploadAll(a);
    const otp = await sendCode(a, phone);
    const year = Number(t.clock.now().toISOString().slice(0, 4));

    const fields = async (overrides: Partial<OnboardingForm>) => {
      const res = await submit(a, { form: form(phone, overrides), files, otp }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      return (res.body.details as { field: string; errors: string[] }[]).map((d) => d.field);
    };

    expect(await fields({ dob: `${year - 15}-01-01` })).toEqual(['form.dob']);
    expect(await fields({ dob: '2004-02-30' })).toEqual(['form.dob']);
    expect(await fields({ idDocument: { type: 'AADHAAR', idNumber: '234123412347' } })).toEqual([
      'form.idDocument.idNumber',
    ]);
    expect(await fields({ consentVersion: 'v0' })).toEqual(['form.consentVersion']);
    expect(await fields({ occupationType: 'WORKING', institutionOrCompany: ' ' })).toEqual([
      'form.institutionOrCompany',
    ]);
    expect(await fields({ emergencyContact: { name: 'Me', phone, relation: 'Self' } })).toEqual([
      'form.emergencyContact.phone',
    ]);
    expect(
      await fields({
        permanentAddress: { line1: 'x', city: 'y', state: 'z', pincode: '012345' },
      }),
    ).toEqual(['form.permanentAddress.pincode']);
    expect(await rowCounts()).toEqual({ users: 0, memberships: 0, residents: 0, documents: 0 });

    // Still the same code, still valid.
    await submit(a, { form: form(phone), files, otp }).expect(201);
  });
});

describe('the link while submitting', () => {
  it('stops accepting registrations at its maximum uses', async () => {
    const { token } = await joinLink({ maxUses: 1 });
    const second = await startDraft(token); // opened before the first person finished
    const secondFiles = await uploadAll(second);
    const secondPhone = newPhone();
    const secondCode = await sendCode(second, secondPhone);

    expect((await apply(token, newPhone())).res.status).toBe(201);

    const res = await submit(second, {
      form: form(secondPhone),
      files: secondFiles,
      otp: secondCode,
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('LINK_INVALID');
    expect(await t.prisma.resident.count()).toBe(1);
  });

  it('needs the draft token to send a code', async () => {
    const { token } = await joinLink();
    const res = await t.http
      .post(`/api/v1/onboarding/${token}/verify-phone`)
      .send({ phone: newPhone() })
      .expect(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
    expect(t.sender.sent).toHaveLength(0);
  });
});
