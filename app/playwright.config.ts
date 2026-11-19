import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 600_000, // one real voice job + one real draft render
  workers: 1,
  use: {baseURL: process.env.REEL_UI_URL ?? 'http://127.0.0.1:5317', actionTimeout: 15_000},
  webServer: {command: 'NO_OPEN=1 npm start', url: `${process.env.REEL_UI_URL ?? 'http://127.0.0.1:5317'}/api/health`, reuseExistingServer: true, timeout: 180_000},
});
