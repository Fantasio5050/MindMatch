import { defineConfig, devices } from '@playwright/test'

/**
 * Tests de bout en bout : plusieurs « téléphones » (pages Chromium au format mobile) jouent dans la
 * même salle. Le serveur et le front doivent tourner — `npm run test:e2e:full` s'en charge.
 *
 * `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet d'utiliser un Chromium déjà installé quand sa version ne
 * correspond pas exactement à celle attendue par @playwright/test (environnements cloud, CI).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
})
