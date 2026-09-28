import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

test('свёрнутая панель фильтров не показывает поля', async ({ page }) => {
  await page.goto('/#/grid')
  const toggle = page.getByRole('button', { name: /^Фильтры/ })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByLabel('Номер документа')).toBeHidden()
  await toggle.click()
  await expect(page.getByLabel('Номер документа')).toBeVisible()
})

test('подзаголовок отсортированной колонки — цвета заголовка', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.locator('table[role=grid] thead th').filter({ hasText: 'ID' }).getByRole('button').first().click()
  await page.getByRole('menu').getByText('Номер документа', { exact: true }).click()
  const th = page.locator('table[role=grid] thead th[aria-sort]').filter({ hasText: 'ID' })
  const [head, sub] = await th.evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el.querySelector('[class*="thSub"]')!).color])
  expect(sub).toBe(head)
})
