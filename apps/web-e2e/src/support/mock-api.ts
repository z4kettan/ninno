import type { BrowserContext, Page, Route } from '@playwright/test';

export const GOOD_CODE = '482913';

type Persona = 'owner' | 'resident';

const users = {
  owner: {
    id: 'u-owner',
    name: 'Demo Owner',
    phoneMasked: '+91 ••••••0002',
    memberships: [
      {
        organizationId: 'o1',
        organizationName: 'Ninno Demo Stays',
        hostelId: null,
        hostelName: null,
        role: 'OWNER',
      },
    ],
  },
  resident: {
    id: 'u-res',
    name: 'Anjali Menon',
    phoneMasked: '+91 ••••••4471',
    memberships: [
      {
        organizationId: 'o1',
        organizationName: 'Ninno Demo Stays',
        hostelId: 'h1',
        hostelName: 'Ninno Demo Hostel',
        role: 'RESIDENT',
      },
    ],
  },
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const error = (route: Route, status: number, code: string, details: unknown = null) =>
  json(route, status, { code, message: code, details, requestId: 'e2e' });

/**
 * A stateful fake of the auth API, following its specs: `signedIn` stands in for the httpOnly
 * refresh cookie; the right code is GOOD_CODE; five wrong codes lock.
 * Pass a BrowserContext when a service worker is active: context routes also see its requests.
 */
export async function mockApi(target: Page | BrowserContext, persona: Persona) {
  const state = { signedIn: false, wrongAttempts: 0, otpRequests: 0, tokenIssued: 0 };
  const session = () => ({
    accessToken: `e2e-access-token-${++state.tokenIssued}`,
    expiresInSeconds: 900,
    user: users[persona],
  });

  await target.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    switch (path) {
      case '/api/v1/auth/refresh':
        return state.signedIn ? json(route, 200, session()) : error(route, 401, 'UNAUTHORIZED');
      case '/api/v1/auth/otp':
        state.otpRequests++;
        state.wrongAttempts = 0;
        return json(route, 202, { expiresInSeconds: 300, resendAfterSeconds: 30 });
      case '/api/v1/auth/otp/verify': {
        const { otp } = route.request().postDataJSON() as { otp: string };
        if (state.wrongAttempts >= 5) {
          return error(route, 401, 'OTP_LOCKED');
        }
        if (otp !== GOOD_CODE) {
          state.wrongAttempts++;
          return error(route, 401, state.wrongAttempts >= 5 ? 'OTP_LOCKED' : 'OTP_INVALID');
        }
        state.signedIn = true;
        return json(route, 200, session());
      }
      case '/api/v1/auth/logout':
        state.signedIn = false;
        return route.fulfill({ status: 204 });
      default:
        return error(route, 404, 'NOT_FOUND');
    }
  });
  return state;
}
