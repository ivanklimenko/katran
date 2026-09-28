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

test('многоуровневая сортировка: Shift+клик по второму заголовку даёт два чипа', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.getByRole('columnheader', { name: /Тип/ }).getByRole('button').first().click()
  await page.getByRole('columnheader', { name: /^52/ }).getByRole('button').first().click({ modifiers: ['Shift'] })
  const chips = page.getByRole('group', { name: 'Сортировка' })
  await expect(chips).toContainText('Тип сообщения ↑')
  await expect(chips).toContainText('BIC 52 ↑')
  // порядок уровней: «1 Тип сообщения … › 2 BIC 52 …»
  await expect(chips).toHaveText(/1\s*Тип сообщения ↑.*›\s*2\s*BIC 52 ↑/)
  await expect(chips.getByRole('button', { name: 'Уровень 2: BIC 52, по возрастанию — сменить направление' })).toBeVisible()
})

test('B1: заблокированная запись — кнопка открытия с подсказкой и приглушённым значением; неактивная — чекбокс отключён', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  const locked = page.locator('tbody[data-state="locked"]').first()
  await locked.waitFor()
  await expect(locked.getByRole('button', { name: /^Заблокирована:/ })).toBeVisible()
  const inactive = page.locator('tbody[data-state="inactive"]').first()
  await inactive.waitFor()
  await expect(inactive.getByRole('checkbox')).toBeDisabled()
  // значение внутри заблокированной записи приглушено переопределением --k-val на записи (STATE §8): проверяем computed color, а не класс
  const { valueColor, mutedColor } = await page.evaluate(() => {
    const el = document.querySelector('tbody[data-state="locked"] [class*="copy"]') as HTMLElement
    const probe = document.createElement('div')
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--k-muted')
    document.body.appendChild(probe)
    const mutedColor = getComputedStyle(probe).color
    document.body.removeChild(probe)
    return { valueColor: getComputedStyle(el).color, mutedColor }
  })
  expect(valueColor).toBe(mutedColor)
})

test('сброс ширины: двойной клик по ручке ресайза возвращает исходную ширину заголовка', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  const slider = page.getByRole('slider', { name: 'Ширина колонки ID' })
  const th = page.locator('table[role=grid] thead th').filter({ has: slider })
  const before = (await th.boundingBox())!.width
  await slider.hover()
  await page.mouse.down()
  await page.mouse.move((await slider.boundingBox())!.x + 60, (await slider.boundingBox())!.y)
  await page.mouse.up()
  const resized = (await th.boundingBox())!.width
  expect(Math.abs(resized - before)).toBeGreaterThan(10)
  await slider.dblclick()
  const after = (await th.boundingBox())!.width
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
})
