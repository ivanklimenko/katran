import { defineConfig } from '@playwright/test'

/**
 * Эталонные снимки стенда (срез styled, Task 0): вид до и после перевода на styled-components совпадает пиксель в пиксель.
 * Обновление эталона (--update-snapshots) — только с записью причины в леджер среза. Снимки сняты на macOS (Chromium Playwright);
 * на другой системе шрифты растрируются иначе — эталон своей системы снимается заново, в отдельную папку {platform}.
 * Порт 5187 — свой, чтобы не мешать dev (5185) и e2e (5186).
 */
export default defineConfig({
  testDir: './visual',
  testMatch: '*.visual.ts',
  timeout: 60_000,
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFilePath}/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixels: 0, animations: 'disabled', caret: 'hide' } },
  use: { baseURL: 'http://localhost:5187', viewport: { width: 1600, height: 900 }, colorScheme: 'light', locale: 'ru-RU', timezoneId: 'Europe/Moscow' },
  webServer: { command: 'pnpm build && pnpm exec vite preview --port 5187 --strictPort', url: 'http://localhost:5187', reuseExistingServer: false, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
