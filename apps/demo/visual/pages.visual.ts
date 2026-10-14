import { expect, test } from '@playwright/test'

// Эталон вида демо (срез styled, Task 0): каждая страница apps/demo/src/pages в светлой и тёмной теме, во всю высоту.
// Плотность 100 % — явно (на широком экране провайдер выбирает 125 % сам); «сегодня» — 23.09.2026.
const PAGES = ['tokens', 'buttons', 'inputs', 'values', 'overlays', 'states', 'pagination', 'tabs'] as const

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 23, 12, 0))
  await page.addInitScript(() => localStorage.clear())
})

for (const id of PAGES) {
  test(`страница ${id}: светлая и тёмная`, async ({ page }) => {
    await page.goto(`/#/${id}`)
    await page.getByRole('button', { name: '100 %' }).click()
    await expect(page.getByRole('navigation', { name: 'Разделы' }).locator('[aria-current="page"]')).toHaveAttribute('href', `#/${id}`)
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    for (const [theme, name] of [['light', 'Светлая'], ['dark', 'Тёмная']] as const) {
      await page.getByRole('button', { name, exact: true }).click()
      await page.mouse.move(0, 0)
      await expect(page).toHaveScreenshot(`${id}-${theme}.png`, { fullPage: true })
    }
  })
}
