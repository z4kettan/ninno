import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

/**
 * End-to-end tests run against the production build (so the service worker and manifest are
 * the real ones), served on 4310 so they never collide with `pnpm dev` on 4300. The API is
 * mocked at the network layer (see src/support/mock-api.ts); no backend is needed.
 */
// 127.0.0.1, not localhost: on Windows localhost can resolve to IPv6 (::1) intermittently.
const baseURL = process.env['BASE_URL'] || 'http://127.0.0.1:4310';

export default defineConfig({
  ...nxE2EPreset(import.meta.dirname, { testDir: './src' }),
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm exec nx run web:serve-static',
    url: baseURL,
    reuseExistingServer: !process.env['CI'],
    cwd: workspaceRoot,
    timeout: 300_000,
  },
  projects: [
    {
      // The narrowest phone Ninno targets.
      name: 'phone-360',
      use: {
        ...devices['Pixel 5'],
        viewport: { width: 360, height: 740 },
        // The installed Google Chrome (present on dev machines and GitHub runners), so no
        // Playwright browser download is needed.
        channel: 'chrome',
      },
    },
  ],
});
