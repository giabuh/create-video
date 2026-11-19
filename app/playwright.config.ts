import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 600_000, // one real voice job + one real draft render
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:5317', actionTimeout: 15_000},
  webServer: {command: 'NO_OPEN=1 npm start', url: 'http://127.0.0.1:5317/api/health', reuseExistingServer: true, timeout: 180_000},
});
