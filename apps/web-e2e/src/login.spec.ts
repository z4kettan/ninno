import { expect, type Page, test } from '@playwright/test';
import { GOOD_CODE, mockApi } from './support/mock-api';

// Service workers would sit between the page and the mocked network; these tests are about
// the app, so they run without one (pwa.spec.ts covers the worker).
test.use({ serviceWorkers: 'block' });

async function enterPhone(page: Page, digits = '9000000002') {
  await page.getByLabel('Mobile number').fill(digits);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByRole('heading', { name: 'Enter the code' })).toBeVisible();
}

async function enterCode(page: Page, code: string) {
  await page.getByLabel('6-digit code').fill(code);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test('the owner signs in with a code and lands on the staff overview', async ({ page }) => {
  await mockApi(page, 'owner');
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Sign in with your mobile number' }),
  ).toBeVisible();
  await expectNoSidewaysScroll(page);

  await enterPhone(page, '90000 00002');
  await expect(page.getByText('+91 ••••••0002')).toBeVisible();
  await expect(page.getByText(/Resend code in 0:(29|30)/)).toBeVisible();

  await enterCode(page, GOOD_CODE);
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  // The hostel's name is in the phone header (the sidebar copy is hidden below 1024px).
  await expect(page.getByText('Ninno Demo Stays').filter({ visible: true })).toHaveCount(1);
  await expect(
    page.getByRole('navigation', { name: 'Staff' }).getByRole('link', { name: 'Overview' }),
  ).toHaveAttribute('aria-current', 'page');
  await expectNoSidewaysScroll(page);
});

test('a resident lands on their home and cannot open the staff area', async ({ page }) => {
  await mockApi(page, 'resident');
  await page.goto('/login');
  await enterPhone(page, '9876544471');
  await enterCode(page, GOOD_CODE);
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: 'Ninno Demo Hostel' })).toBeVisible();

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/home$/);
});

test('an invalid number is caught on the phone, without calling the API', async ({ page }) => {
  const state = await mockApi(page, 'owner');
  await page.goto('/login');
  await page.getByLabel('Mobile number').fill('12345');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByText('Enter a 10-digit Indian mobile number.')).toBeVisible();
  expect(state.otpRequests).toBe(0);
});

test('a wrong code explains itself and clears the boxes', async ({ page }) => {
  await mockApi(page, 'owner');
  await page.goto('/login');
  await enterPhone(page);
  await enterCode(page, '111111');
  await expect(page.getByText(/That code is wrong or has expired/)).toBeVisible();
  await expect(page.getByLabel('6-digit code')).toHaveValue('');
  await expect(page).toHaveURL(/\/login$/);
});

test('five wrong codes lock, and a new code can be requested', async ({ page }) => {
  const state = await mockApi(page, 'owner');
  await page.goto('/login');
  await enterPhone(page);
  for (let i = 0; i < 5; i++) {
    await enterCode(page, '111111');
    await expect(page.getByText(/wrong|Too many/)).toBeVisible();
  }
  await expect(page.getByText(/Too many wrong attempts/)).toBeVisible();
  await page.getByRole('button', { name: 'Send a new code' }).click();
  await expect.poll(() => state.otpRequests).toBe(2);
  await enterCode(page, GOOD_CODE);
  await expect(page).toHaveURL(/\/admin$/);
});

test('a deep link survives the login', async ({ page }) => {
  await mockApi(page, 'owner');
  await page.goto('/admin/residents');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fresidents$/);
  await enterPhone(page);
  await enterCode(page, GOOD_CODE);
  await expect(page).toHaveURL(/\/admin\/residents$/);
  await expect(page.getByRole('heading', { name: 'Residents' })).toBeVisible();
});

test('reopening the app restores the session from the cookie, and tokens never touch web storage', async ({
  page,
}) => {
  await mockApi(page, 'owner');
  await page.goto('/login');
  await enterPhone(page);
  await enterCode(page, GOOD_CODE);
  await expect(page).toHaveURL(/\/admin$/);

  await page.reload();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

  const stored = await page.evaluate(
    () => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
  );
  expect(stored).not.toContain('e2e-access-token');
});

test('signing out from the More sheet returns to login', async ({ page }) => {
  await mockApi(page, 'owner');
  await page.goto('/login');
  await enterPhone(page);
  await enterCode(page, GOOD_CODE);
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});
