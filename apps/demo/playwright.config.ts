import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5182', viewport: { width: 1600, height: 900 } },
  webServer: { command: 'pnpm build && pnpm exec vite preview --port 5182 --strictPort', url: 'http://localhost:5182', reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
