import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

/** Переход на экран; в режиме ?hostile — предусловие: hostile.css применился (иначе проверки прошли бы вхолостую). */
async function open(page: Page, q: '' | '?hostile') {
  await page.goto(`/${q}#/grid`)
  if (q === '?hostile') await page.waitForFunction(() => getComputedStyle(document.body).fontFamily.includes('Georgia'))
}

/** Заданная ширина колонки ID (ползунок ресайза) и фактическая ширина её заголовка. */
async function idColumn(page: Page) {
  const slider = page.getByRole('slider', { name: 'Ширина колонки ID' })
  const declared = Number(await slider.getAttribute('aria-valuenow'))
  const actual = (await page.locator('table[role=grid] thead th').filter({ has: slider }).boundingBox())!.width
  return { declared, actual }
}

/** Высота первой записи при плотности 100 %. */
async function recordHeight(page: Page) {
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  return (await page.locator('tbody[data-key]').first().boundingBox())!.height
}

for (const [q, name] of [['', 'чистая страница'], ['?hostile', 'враждебный хост']] as const) {
  test(`${name}: ширина колонки равна заданной, запись в коридоре`, async ({ page }) => {
    await open(page, q)
    const record = await recordHeight(page)
    const { declared, actual } = await idColumn(page)
    expect(Math.abs(actual - declared)).toBeLessThanOrEqual(1)
    expect(record).toBeGreaterThanOrEqual(64)
    expect(record).toBeLessThanOrEqual(72)
    test.info().annotations.push({ type: 'geometry', description: `${name}: declared=${declared} actual=${actual} record=${record}` })
  })

  test(`${name}: кнопка «100 %» (size s) 24 px, пункт меню не шире поповера`, async ({ page }) => {
    await open(page, q)
    const btn = page.getByRole('button', { name: '100 %' })
    await btn.click()
    // высота контрола = токен h-ctl-s (24) вместе с рамкой: button под корнем кита — border-box, как встроено в браузер
    const buttonHeight = (await btn.boundingBox())!.height
    expect.soft(Math.abs(buttonHeight - 24), `высота кнопки ${buttonHeight}`).toBeLessThanOrEqual(0.5)
    const slider = page.getByRole('slider', { name: 'Ширина колонки ID' })
    await page.locator('table[role=grid] thead th').filter({ has: slider }).locator('button[aria-haspopup=menu]').click()
    const menu = page.getByRole('menu')
    const item = menu.locator('[role^=menuitem]').first()
    await item.waitFor()
    // оба прямоугольника — в одном кадре: поповер позиционируется асинхронно, смещение от позиции не зависит
    const { itemRight, popRight } = await menu.evaluate((el) => ({
      itemRight: el.querySelector('[role^=menuitem]')!.getBoundingClientRect().right,
      popRight: el.getBoundingClientRect().right,
    }))
    expect(itemRight, `правый край пункта ${itemRight}, поповера ${popRight}`).toBeLessThanOrEqual(popRight + 0.5)
    test.info().annotations.push({ type: 'geometry', description: `${name}: button=${buttonHeight} itemRight−popRight=${itemRight - popRight}` })
  })
}

test('враждебный хост: запись той же высоты, что на чистой странице (±0.5 px)', async ({ page }) => {
  await open(page, '')
  const clean = await recordHeight(page)
  await open(page, '?hostile')
  const hostile = await recordHeight(page)
  expect(Math.abs(hostile - clean)).toBeLessThanOrEqual(0.5)
  test.info().annotations.push({ type: 'geometry', description: `clean=${clean} hostile=${hostile}` })
})

test('враждебный хост: кнопка кита не наследует типографику сброса хоста', async ({ page }) => {
  await open(page, '?hostile')
  const btn = page.getByRole('button', { name: '100 %' })
  await btn.waitFor()
  const style = await btn.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { textTransform: cs.textTransform, letterSpacing: cs.letterSpacing }
  })
  expect(style.textTransform).toBe('none')
  expect(style.letterSpacing).toBe('normal')
  test.info().annotations.push({ type: 'typography', description: `textTransform=${style.textTransform} letterSpacing=${style.letterSpacing}` })
})

test('враждебный хост: ячейка записи без рамок хоста', async ({ page }) => {
  await open(page, '?hostile')
  await page.locator('tbody[data-key]').first().waitFor()
  const td = page.locator('tbody[data-key] td').first()
  const style = await td.evaluate((el) => {
    const cs = getComputedStyle(el)
    return { borderTop: cs.borderTopWidth, borderLeft: cs.borderLeftWidth }
  })
  expect(style.borderTop).toBe('0px')
  expect(style.borderLeft).toBe('0px')
  test.info().annotations.push({ type: 'border', description: `borderTop=${style.borderTop} borderLeft=${style.borderLeft}` })
})
