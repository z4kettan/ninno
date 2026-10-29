import type { Page, Route } from '@playwright/test';

export const JOIN_TOKEN = 'e2e-join-token-000000000000000000';
export const SIGNUP_CODE = '615204';

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const error = (route: Route, status: number, code: string) =>
  json(route, status, { code, message: code, details: null, requestId: 'e2e' });

const hostel = {
  name: 'Kayal House',
  addressLine1: '14/220 Kaloor–Kadavanthra Road',
  addressLine2: null,
  city: 'Kochi',
  state: 'Kerala',
  pincode: '682017',
  genderPolicy: 'FEMALE',
  amenities: ['Wi-Fi', 'Meals'],
  rulesText: 'Gate closes at 10 pm.',
};

const membership = (role: 'OWNER' | 'RESIDENT') => ({
  organizationId: 'o1',
  organizationName: 'Kayal Stays',
  hostelId: role === 'OWNER' ? null : 'h1',
  hostelName: role === 'OWNER' ? null : 'Kayal House',
  role,
});

/** Image bytes as the phone's camera would give them (a real, decodable PNG). */
export const PHOTO_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWM4sWoaVsQwtCQA2DaCAe4vKdQAAAAASUVORK5CYII=',
  'base64',
);

/**
 * A stateful fake of the onboarding, approvals and residents API, following their specs.
 * Uploads go to a fake storage URL on the same origin and are recorded.
 */
export async function mockOnboardingApi(page: Page, persona: 'applicant' | 'owner') {
  const state = {
    signedIn: persona === 'owner',
    uploads: [] as { kind: string; contentType: string; size: number }[],
    stored: [] as string[],
    submitted: null as null | { form: Record<string, unknown>; files: Record<string, unknown> },
    applicationStatus: 'PENDING_REVIEW' as 'PENDING_REVIEW' | 'ACTIVE',
    approved: null as null | Record<string, unknown>,
    rotated: 0,
  };
  const user = () =>
    persona === 'owner'
      ? {
          id: 'u-owner',
          name: 'Lakshmi Nair',
          phoneMasked: '+91 ••••••0002',
          memberships: [membership('OWNER')],
        }
      : {
          id: 'u-res',
          name: 'Anjali Menon',
          phoneMasked: '+91 ••••••4471',
          memberships: [membership('RESIDENT')],
        };
  const session = () => ({ accessToken: 'e2e-token', expiresInSeconds: 900, user: user() });

  // India Post's pincode service.
  await page.route('https://api.postalpincode.in/**', (route) =>
    json(route, 200, [
      { Status: 'Success', PostOffice: [{ District: 'Thrissur', State: 'Kerala' }] },
    ]),
  );

  // The private bucket: accepts PUTs with the signed type.
  await page.route('**/__storage/**', async (route) => {
    const req = route.request();
    if (req.method() !== 'PUT') {
      return route.fulfill({ status: 403 });
    }
    state.stored.push(new URL(req.url()).pathname);
    return route.fulfill({ status: 200 });
  });

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const base = `/api/v1/onboarding/${JOIN_TOKEN}`;

    if (path === '/api/v1/auth/refresh') {
      return state.signedIn ? json(route, 200, session()) : error(route, 401, 'UNAUTHORIZED');
    }
    if (path === base) {
      return json(route, 200, hostel);
    }
    if (path.startsWith('/api/v1/onboarding/') && !path.startsWith(base)) {
      return error(route, 404, 'LINK_INVALID');
    }
    if (path === `${base}/drafts`) {
      return json(route, 201, {
        draftId: 'd1',
        draftToken: 'e2e-draft',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      });
    }
    if (path === `${base}/uploads`) {
      if (req.headers()['x-draft-token'] !== 'e2e-draft') {
        return error(route, 401, 'UNAUTHORIZED');
      }
      const body = req.postDataJSON() as { kind: string; contentType: string; size: number };
      state.uploads.push(body);
      const key = `pending/d1/${body.kind}-${state.uploads.length}.${body.contentType === 'application/pdf' ? 'pdf' : 'jpg'}`;
      return json(route, 200, {
        key,
        url: new URL(`/__storage/${key}`, req.url()).toString(),
        headers: { 'Content-Type': body.contentType },
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      });
    }
    if (path === `${base}/verify-phone`) {
      return json(route, 202, { expiresInSeconds: 300, resendAfterSeconds: 30 });
    }
    if (path === `${base}/submit`) {
      const body = req.postDataJSON() as {
        form: Record<string, unknown>;
        files: Record<string, unknown>;
        otp: string;
      };
      if (body.otp !== SIGNUP_CODE) {
        return error(route, 401, 'OTP_INVALID');
      }
      state.submitted = { form: body.form, files: body.files };
      state.signedIn = true;
      return json(route, 201, session());
    }
    if (path === '/api/v1/residents/me') {
      const active = state.applicationStatus === 'ACTIVE';
      return json(route, 200, {
        applications:
          state.submitted || persona === 'applicant'
            ? [
                {
                  residentId: 'r1',
                  hostelId: 'h1',
                  hostelName: 'Kayal House',
                  status: state.applicationStatus,
                  submittedAt: new Date().toISOString(),
                  rejectionReason: null,
                  roomNumber: active ? '101' : null,
                  bedLabel: active ? 'B' : null,
                  checkInDate: active ? '2026-03-10' : null,
                },
              ]
            : [],
      });
    }

    // Staff side.
    if (path === '/api/v1/approvals/count') {
      return json(route, 200, { count: state.approved ? 0 : 1 });
    }
    if (path === '/api/v1/approvals') {
      return json(route, 200, {
        items: state.approved
          ? []
          : [
              {
                residentId: 'r1',
                hostelId: 'h1',
                hostelName: 'Kayal House',
                fullName: 'Anjali Menon',
                phoneMasked: '+91 ••••••4471',
                occupationType: 'STUDENT',
                institutionOrCompany: "St. Teresa's College",
                submittedAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
              },
            ],
      });
    }
    if (path === '/api/v1/approvals/r1') {
      return json(route, 200, {
        residentId: 'r1',
        hostelId: 'h1',
        hostelName: 'Kayal House',
        status: state.approved ? 'ACTIVE' : 'PENDING_REVIEW',
        submittedAt: new Date().toISOString(),
        fullName: 'Anjali Menon',
        dob: '2004-08-24',
        gender: 'FEMALE',
        phone: '+919847204471',
        altPhone: null,
        email: null,
        permanentAddress: {
          line1: '12 Temple Road',
          line2: null,
          city: 'Thrissur',
          state: 'Kerala',
          pincode: '680001',
        },
        occupationType: 'STUDENT',
        institutionOrCompany: "St. Teresa's College",
        emergencyContact: { name: 'Ravi Menon', phone: '+919447000001', relation: 'Father' },
        idDocument: { type: 'AADHAAR', numberMasked: 'XXXX-XXXX-2346', hasBack: true },
        consentVersion: 'v1',
        consentAcceptedAt: new Date().toISOString(),
        vacantBeds: [
          {
            bedId: 'bed-a',
            label: 'A',
            roomId: 'room-101',
            roomNumber: '101',
            floor: 1,
            monthlyRentPaise: '650000',
          },
          {
            bedId: 'bed-b',
            label: 'B',
            roomId: 'room-101',
            roomNumber: '101',
            floor: 1,
            monthlyRentPaise: '650000',
          },
        ],
        defaultSecurityDepositPaise: '500000',
        billingMode: 'CHECKIN_ANNIVERSARY',
        fixedDueDay: null,
      });
    }
    if (path.startsWith('/api/v1/residents/r1/files/')) {
      return json(route, 200, {
        url: new URL('/__photos/selfie.png', req.url()).toString(),
        contentType: 'image/jpeg',
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
      });
    }
    if (path === '/api/v1/approvals/r1/approve') {
      state.approved = req.postDataJSON() as Record<string, unknown>;
      state.applicationStatus = 'ACTIVE';
      return json(route, 200, { residentId: 'r1', status: 'ACTIVE' });
    }
    if (path === '/api/v1/hostels') {
      return json(route, 200, [{ id: 'h1', name: 'Kayal House', city: 'Kochi' }]);
    }
    if (
      path === '/api/v1/hostels/h1/onboarding-link' ||
      path === '/api/v1/hostels/h1/onboarding-link/rotate'
    ) {
      if (path.endsWith('/rotate')) {
        state.rotated++;
      }
      const token = `qr-token-${state.rotated}`;
      return json(route, 200, {
        hostelId: 'h1',
        hostelName: 'Kayal House',
        token,
        url: `https://app.ninno.in/join/${token}`,
        expiresAt: null,
        maxUses: null,
        useCount: 12,
        createdAt: new Date().toISOString(),
      });
    }
    return error(route, 404, 'NOT_FOUND');
  });

  await page.route('**/__photos/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PHOTO_PNG }),
  );
  return state;
}
