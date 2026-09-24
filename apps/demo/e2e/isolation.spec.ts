import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

/** Заданная ширина колонки ID (ползунок ресайза) и фактическая ширина её заголовка. */
async function idColumn(page: Page) {
  const slider = page.getByRole('slider', { name: 'Ширина колонки ID' })
  const declared = Number(await slider.getAttribute('aria-valuenow'))
  const actual = (await page.locator('table[role=grid] thead th').filter({ has: slider }).boundingBox())!.width
  return { declared, actual }
}

for (const [q, name] of [['', 'чистая страница'], ['?hostile', 'враждебный хост']] as const) {
  test(`${name}: ширина колонки равна заданной, запись в коридоре`, async ({ page }) => {
    await page.goto(`/${q}#/grid`)
    await page.getByRole('button', { name: '100 %' }).click()
    await page.locator('tbody[data-key]').first().waitFor()
    const { declared, actual } = await idColumn(page)
    expect(Math.abs(actual - declared)).toBeLessThanOrEqual(1)
    const record = (await page.locator('tbody[data-key]').first().boundingBox())!.height
    expect(record).toBeGreaterThanOrEqual(64)
    expect(record).toBeLessThanOrEqual(72)
    test.info().annotations.push({ type: 'geometry', description: `${name}: declared=${declared} actual=${actual} record=${record}` })
  })
}
