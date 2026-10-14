import { defineConfig } from '@playwright/test'

/**
 * Эталонные снимки демо (срез styled, Task 0): каждая страница в светлой и тёмной теме, пиксель в пиксель.
 * Обновление эталона (--update-snapshots) — только с записью причины в леджер среза. Снимки сняты на macOS (Chromium Playwright).
 * Порт 5188 — свой, чтобы не мешать dev (5181).
 */
export default defineConfig({
  testDir: './visual',
  testMatch: '*.visual.ts',
  timeout: 60_000,
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFilePath}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixels: 0, animations: 'disabled', caret: 'hide' } },
  use: { baseURL: 'http://localhost:5188', viewport: { width: 1600, height: 900 }, colorScheme: 'light', locale: 'ru-RU', timezoneId: 'Europe/Moscow' },
  webServer: { command: 'pnpm build && pnpm exec vite preview --port 5188 --strictPort', url: 'http://localhost:5188', reuseExistingServer: false, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
