import { expect, test, type Page } from '@playwright/test'

// Эталон вида реестров (срез styled, Task 0): оба реестра в светлой, тёмной теме и при плотности 125 %; записи валютного
// реестра в состояниях; панель фильтров, поповер периода, список MultiSelect, подсказки ввода и тултип.
// Фейк без задержки (?slow=0), без автооткрытия первой записи (?noauto); «сегодня» — 23.09.2026, как в данных фейка.

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 8, 23, 12, 0))
  await page.addInitScript(() => localStorage.clear())
})

type Route = 'fx-docs' | 'rub-docs'
const rows = (page: Page) => page.locator('tbody[data-key]')
const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })

/** Экран реестра: 100 %, записи на месте, шрифты загружены, курсор в углу (без наведения). */
async function start(page: Page, route: Route) {
  await page.goto(`/?slow=0&noauto#/${route}`)
  await page.getByRole('button', { name: '100 %' }).click()
  await rows(page).first().waitFor()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.mouse.move(0, 0)
}
/** Анимации въезда drawer'ов закончены. */
const still = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)).then(() => undefined))

for (const route of ['fx-docs', 'rub-docs'] as const) {
  test(`реестр ${route}: светлая, тёмная, 125 %`, async ({ page }) => {
    await start(page, route)
    await expect(page).toHaveScreenshot(`${route}-light.png`)
    await page.getByRole('button', { name: 'Тёмная' }).click()
    await page.mouse.move(0, 0)
    await expect(page).toHaveScreenshot(`${route}-dark.png`)
    await page.getByRole('button', { name: 'Светлая' }).click()
    await page.getByRole('button', { name: '125 %' }).click()
    await page.mouse.move(0, 0)
    await expect(page).toHaveScreenshot(`${route}-density-125.png`)
  })
}

test('записи валютного реестра: выделенная, наведённая, заблокированная, неактивная', async ({ page }) => {
  await start(page, 'fx-docs')
  const first = rows(page).first()
  await first.getByRole('checkbox').check()
  await page.mouse.move(0, 0)
  await expect(first).toHaveScreenshot('record-selected.png')
  const third = rows(page).nth(2)
  await third.hover({ position: { x: 600, y: 10 } })
  await expect(third).toHaveScreenshot('record-hover.png')
  await page.mouse.move(0, 0)
  const locked = page.locator('tbody[data-key][data-state="locked"]').first()
  await expect(locked).toHaveScreenshot('record-locked.png')
  const inactive = page.locator('tbody[data-key][data-state="inactive"]').first()
  await expect(inactive).toHaveScreenshot('record-inactive.png')
})

test('записи, открытые в A и B: метки записей и два drawer\'а', async ({ page }) => {
  // окно шире двух drawer'ов (2 × 800): слева виден реестр с метками записей
  await page.setViewportSize({ width: 2200, height: 900 })
  await start(page, 'fx-docs')
  await rows(page).nth(0).locator('[data-k-open]').click()
  await expect(dialogs(page)).toHaveCount(1)
  await rows(page).nth(1).locator('[data-k-open]').click({ modifiers: ['Shift'] })
  await expect(dialogs(page)).toHaveCount(2)
  for (const i of [0, 1]) await dialogs(page).nth(i).locator('[data-part="hero"]').waitFor()
  await still(page)
  await page.mouse.move(0, 0)
  await expect(page.locator('tbody[data-key][data-mark="a"]')).toHaveCount(1)
  await expect(page.locator('tbody[data-key][data-mark="b"]')).toHaveCount(1)
  await expect(page).toHaveScreenshot('records-open-a-b.png')
})

test('тултип: кнопка открытия заблокированной записи', async ({ page }) => {
  await start(page, 'fx-docs')
  const locked = page.locator('tbody[data-key][data-state="locked"]').first()
  await locked.getByRole('button', { name: /^Заблокирована:/ }).hover()
  await expect(page.getByRole('tooltip')).toBeVisible()
  await expect(page).toHaveScreenshot('tooltip-locked.png')
})

test.describe('панель фильтров', () => {
  async function openFilters(page: Page) {
    await start(page, 'fx-docs')
    await page.getByRole('button', { name: /^Фильтры/ }).click()
    await expect(page.getByLabel('Номер документа')).toBeVisible()
    await page.mouse.move(0, 0)
  }

  test('развёрнута', async ({ page }) => {
    await openFilters(page)
    await expect(page).toHaveScreenshot('filters-open.png')
  })
  test('поповер периода', async ({ page }) => {
    await openFilters(page)
    await page.getByRole('button', { name: 'Выбрать период' }).first().click()
    await expect(page.getByRole('dialog', { name: /выбор периода/ })).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page).toHaveScreenshot('filters-period-popover.png')
  })
  test('список MultiSelect', async ({ page }) => {
    await openFilters(page)
    await page.getByRole('button', { name: /^Статус:/ }).click()
    await expect(page.getByRole('listbox').first()).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page).toHaveScreenshot('filters-multiselect.png')
  })
  test('подсказки ввода', async ({ page }) => {
    await openFilters(page)
    await page.getByRole('combobox', { name: 'Приказодатель' }).pressSequentially('ооо')
    const list = page.getByRole('listbox', { name: 'Подсказки: Приказодатель' })
    await expect(list.getByRole('option', { disabled: false }).first()).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page).toHaveScreenshot('filters-suggest.png')
  })
})
