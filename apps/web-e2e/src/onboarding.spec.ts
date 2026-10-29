import { expect, type Page, test } from '@playwright/test';
import { JOIN_TOKEN, mockOnboardingApi, PHOTO_PNG, SIGNUP_CODE } from './support/onboarding-api';

test.use({ serviceWorkers: 'block' });

const photo = (name: string) => ({ name, mimeType: 'image/png', buffer: PHOTO_PNG });

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const cont = (page: Page) => page.getByRole('button', { name: 'Continue' }).click();

test('a new resident scans the QR, fills in six steps and is signed in, waiting for approval', async ({
  page,
}) => {
  const api = await mockOnboardingApi(page, 'applicant');
  await page.goto(`/join/${JOIN_TOKEN}`);

  // The hostel leads the first screen.
  await expect(page.getByRole('heading', { name: 'Kayal House' })).toBeVisible();
  await expect(page.getByText('Women only')).toBeVisible();
  await expect(page.getByText('Gate closes at 10 pm.')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Start' }).click();

  // 1. About you: nothing advances until the step is complete.
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  await cont(page);
  await expect(page.getByText('Some details are missing.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  await page.getByLabel('Full name, as on your ID').fill('Anjali Menon');
  await page.getByLabel('Date of birth').fill('2004-08-24');
  await page.getByLabel('Female').check();
  await page.locator('input[type=file]').setInputFiles(photo('selfie.png'));
  await expect(page.getByText('Uploaded')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await cont(page);

  // 2. Contact: the pincode fills in city and state.
  await expect(page.getByRole('heading', { name: 'How to reach you' })).toBeVisible();
  await page.getByLabel('Mobile number').fill('98472 04471');
  await page.getByLabel('House and street').fill('12 Temple Road');
  await page.getByLabel('Pincode').fill('680001');
  await expect(page.getByLabel('City or district')).toHaveValue('Thrissur');
  await expect(page.getByLabel('State')).toHaveValue('Kerala');
  await cont(page);

  // 3. Work or study.
  await page.getByLabel('Student').check();
  await page.getByLabel('College or institution').fill("St. Teresa's College");
  await cont(page);

  // 4. Emergency contact.
  await page.getByLabel('Their name').fill('Ravi Menon');
  await page.getByLabel('Their mobile number').fill('9447000001');
  await page.getByLabel('How are they related to you?').fill('Father');
  await cont(page);

  // 5. ID: Aadhaar checks its checksum and needs both sides.
  await page.getByLabel('Aadhaar').check();
  await page.getByLabel('Aadhaar number').fill('2341 2341 2347');
  await page.getByLabel('Aadhaar number').blur();
  await expect(page.getByText('This is not a valid number for this ID.')).toBeVisible();
  await page.getByLabel('Aadhaar number').fill('2341 2341 2346');
  await page.locator('input[type=file]').nth(0).setInputFiles(photo('front.png'));
  await expect(page.getByText('Uploaded')).toHaveCount(1);
  await cont(page);
  await expect(page.getByText('Add a photo of the back of your ID.')).toBeVisible();
  await page.locator('input[type=file]').nth(1).setInputFiles(photo('back.png'));
  await expect(page.getByText('Uploaded')).toHaveCount(2);
  await cont(page);

  // 6. Review and consent.
  await expect(page.getByRole('heading', { name: 'Check and submit' })).toBeVisible();
  await expect(page.getByText('XXXX-XXXX-2346')).toBeVisible();
  await expect(page.getByText('234123412346')).toHaveCount(0);
  await page.getByRole('button', { name: 'Verify and submit' }).click();
  await expect(page.getByText('Tick the box to agree before submitting.')).toBeVisible();
  await page.getByLabel(/I have read this and agree to Kayal House/).check();
  await page.getByRole('button', { name: 'Verify and submit' }).click();

  // The SMS code is the signup.
  await expect(page.getByRole('heading', { name: 'Enter the code' })).toBeVisible();
  await page.getByLabel('6-digit code').fill(SIGNUP_CODE);
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByText('Waiting for approval')).toBeVisible();
  await expectNoSidewaysScroll(page);

  // What the server received: three compressed JPEGs, the full form, nothing left on the device.
  expect(api.uploads.map((u) => [u.kind, u.contentType])).toEqual([
    ['selfie', 'image/jpeg'],
    ['id-front', 'image/jpeg'],
    ['id-back', 'image/jpeg'],
  ]);
  expect(api.stored).toHaveLength(3);
  expect(api.submitted?.form).toMatchObject({
    fullName: 'Anjali Menon',
    phone: '98472 04471',
    consentVersion: 'v1',
    idDocument: { type: 'AADHAAR', idNumber: '2341 2341 2346' },
    permanentAddress: { city: 'Thrissur', state: 'Kerala', pincode: '680001' },
  });
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ninno.join.'))),
  ).toEqual([]);
});

test('the draft survives a closed tab', async ({ page }) => {
  await mockOnboardingApi(page, 'applicant');
  await page.goto(`/join/${JOIN_TOKEN}`);
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByLabel('Full name, as on your ID').fill('Anjali Menon');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  await expect(page.getByLabel('Full name, as on your ID')).toHaveValue('Anjali Menon');
});

test('a rotated QR code shows a plain message and no form', async ({ page }) => {
  await mockOnboardingApi(page, 'applicant');
  await page.goto('/join/old-token');
  await expect(
    page.getByRole('heading', { name: 'This QR code is no longer active' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start' })).toHaveCount(0);
});

test('staff approve the applicant into a bed', async ({ page }) => {
  const api = await mockOnboardingApi(page, 'owner');
  await page.goto('/admin/approvals');

  await expect(page.getByRole('heading', { name: 'Approvals' })).toBeVisible();
  await page.getByRole('link', { name: /Anjali Menon/ }).click();
  await expect(page.getByRole('heading', { name: 'Anjali Menon' })).toBeVisible();
  await expect(page.getByText('XXXX-XXXX-2346')).toBeVisible();

  await page.getByRole('button', { name: 'View front' }).click();
  await expect(page.getByText('This view is recorded.')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByLabel('Bed', { exact: true }).selectOption('bed-b');
  await expect(page.getByLabel('Monthly rent (₹)')).toHaveValue('6500');
  await expect(page.getByLabel('Deposit (₹)')).toHaveValue('5000');
  await page.getByLabel('Check-in date').fill('2026-03-10');
  await expect(page.getByText('Rent is due on day 10 of each month')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await page.getByRole('button', { name: 'Approve', exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/approvals$/);
  await expect(page.getByText('Nothing to review')).toBeVisible();
  expect(api.approved).toEqual({
    bedId: 'bed-b',
    checkInDate: '2026-03-10',
    monthlyRentPaise: '650000',
    securityDepositPaise: '500000',
  });
});

test('the QR screen shows the code and prints a one-page poster', async ({ page }) => {
  const api = await mockOnboardingApi(page, 'owner');
  await page.goto('/admin/onboarding');

  await expect(page.getByRole('img', { name: 'QR code to join Kayal House' })).toBeVisible();
  await expect(page.getByText('https://app.ninno.in/join/qr-token-0')).toBeVisible();
  await expectNoSidewaysScroll(page);

  await page.emulateMedia({ media: 'print' });
  const poster = page.locator('.nn-print-poster');
  await expect(poster).toBeVisible();
  await expect(poster).toContainText('Kayal House');
  await expect(poster).toContainText('Scan to join');
  await expect(page.getByRole('button', { name: 'Print poster' })).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  await page.getByRole('button', { name: 'Make a new QR code' }).click();
  await page.getByRole('button', { name: 'Make a new code' }).click();
  await expect(page.getByText('https://app.ninno.in/join/qr-token-1')).toBeVisible();
  expect(api.rotated).toBe(1);
});
