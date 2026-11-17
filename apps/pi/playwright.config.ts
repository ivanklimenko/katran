import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5186', viewport: { width: 1600, height: 900 } },
  webServer: { command: 'pnpm exec tsc -p tsconfig.json --noEmit && pnpm exec vite build -c vite.e2e.config.ts && pnpm exec vite preview -c vite.e2e.config.ts --port 5186 --strictPort', url: 'http://localhost:5186', reuseExistingServer: true, timeout: 120_000 },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Эмуляция отсутствия CSS-изоляции короткого scroll-контейнера до Chromium 144.
    { name: 'chromium-short-scroll-fallback', testMatch: 'issues-5-7.spec.ts', grep: /#7/, use: { browserName: 'chromium' } },
  ],
})
