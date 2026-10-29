import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type BrowserContext, chromium, devices, expect, type Page, test } from '@playwright/test';
import { mockApi } from './support/mock-api';

/**
 * Installability and caching need a real profile: Chrome never offers installation in an
 * incognito context (Playwright's default), so these tests use a persistent profile, the way
 * a phone's browser runs.
 */
test.describe('PWA (production build)', () => {
  test.setTimeout(120_000);

  let profile: string;
  let context: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ baseURL }) => {
    profile = mkdtempSync(join(tmpdir(), 'ninno-pwa-'));
    context = await chromium.launchPersistentContext(profile, {
      ...devices['Pixel 5'],
      viewport: { width: 360, height: 740 },
      channel: 'chrome',
      baseURL,
      serviceWorkers: 'allow',
    });
    page = context.pages()[0] ?? (await context.newPage());
  });

  test.afterEach(async () => {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  });

  async function waitForServiceWorker() {
    // registerWhenStable:30000 registers once the app is stable, or after 30 s at the latest.
    await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated',
      undefined,
      { timeout: 60_000, polling: 500 },
    );
  }

  test('Chrome reports the app as installable', async () => {
    await page.goto('/login');
    await waitForServiceWorker();

    const manifest = await page.evaluate(async () => {
      const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      return link
        ? ((await (await fetch(link.href)).json()) as { name: string; display: string })
        : null;
    });
    expect(manifest).toMatchObject({ name: 'Ninno', display: 'standalone' });

    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: { errorId: string }[];
    };
    expect(installabilityErrors).toEqual([]);
  });

  test('the service worker caches the app shell but never an API response', async () => {
    await mockApi(context, 'owner');
    await page.goto('/login');
    await waitForServiceWorker();

    // A freshly installed worker takes over on a later navigation, and right after activation
    // Chrome sometimes still loads the next page uncontrolled. Wait until a load is controlled…
    await expect
      .poll(
        async () => {
          await page.reload();
          return page.evaluate(() => !!navigator.serviceWorker.controller);
        },
        { timeout: 30_000, intervals: [500] },
      )
      .toBe(true);

    // …then load once more, so the app's start-up API call is sure to pass through the worker.
    const refreshed = page.waitForResponse('**/api/v1/auth/refresh');
    await page.reload();
    await refreshed;
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    const cachedUrls = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys()) {
          urls.push(request.url);
        }
      }
      return urls;
    });
    expect(cachedUrls.some((url) => url.endsWith('/index.html'))).toBe(true);
    expect(cachedUrls.filter((url) => url.includes('/api/'))).toEqual([]);
  });
});
