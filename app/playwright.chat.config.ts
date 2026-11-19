import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir: 'e2e-chat',
  timeout: 60_000,
  workers: 1,
  use: {baseURL: 'http://127.0.0.1:5337', actionTimeout: 10_000},
  webServer: {command: 'node e2e-chat/serve.mjs', url: 'http://127.0.0.1:5337/api/health', reuseExistingServer: false, timeout: 120_000, gracefulShutdown: {signal: 'SIGTERM', timeout: 10_000}},
});
