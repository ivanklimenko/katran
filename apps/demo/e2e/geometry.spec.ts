import { expect, test, type Page } from '@playwright/test'

const h = async (page: Page, sel: string) => (await page.locator(sel).first().boundingBox())!.height

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

test('запись и шапка при 100 %', async ({ page }) => {
  await page.goto('/#/grid')
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  const record = await h(page, 'tbody[data-key]')
  const head = await h(page, 'table[role=grid] thead')
  expect(record).toBeGreaterThanOrEqual(64)
  expect(record).toBeLessThanOrEqual(72)
  expect(head).toBeGreaterThanOrEqual(40)
  expect(head).toBeLessThanOrEqual(56)
  test.info().annotations.push({ type: 'geometry', description: `record=${record} head=${head}` })
})

test('скелетон повторяет высоту записи', async ({ page }) => {
  await page.goto('/?slow=3000#/grid')
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('table[role=grid] tbody').first().waitFor()
  const skeleton = await h(page, 'table[role=grid] tbody')
  await page.locator('tbody[data-key]').first().waitFor({ timeout: 10_000 })
  const record = await h(page, 'tbody[data-key]')
  expect(Math.abs(skeleton - record)).toBeLessThanOrEqual(2)
  test.info().annotations.push({ type: 'geometry', description: `skeleton=${skeleton} record=${record}` })
})

test('плотность 125 % масштабирует запись', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.getByRole('button', { name: '100 %' }).click()
  const base = await h(page, 'tbody[data-key]')
  await page.getByRole('button', { name: '125 %' }).click()
  const big = await h(page, 'tbody[data-key]')
  expect(Math.abs(big - base * 1.25)).toBeLessThanOrEqual(2)
  test.info().annotations.push({ type: 'geometry', description: `base=${base} density125=${big}` })
})
