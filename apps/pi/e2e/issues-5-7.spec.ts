import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1920, height: 1000 } })
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

for (const theme of ['light', 'dark']) for (const density of [100, 125]) {
  for (const spans of [0, 1, 2]) {
    test(`#5: непрерывная граница, ${spans + 1} строк, ${theme}, ${density}%`, async ({ page }) => {
      await page.goto(`/e2e/fixtures/grid.html?spans=${spans}&theme=${theme}&density=${density}`)
      const records = page.locator('tbody[data-key]')
      await expect(records).toHaveCount(2)
      const boundaries = await records.evaluateAll((bodies) => bodies.flatMap((body) => {
        const rows = [...body.querySelectorAll('tr')]
        return rows.flatMap((row, i) => [...row.cells].map((cell) => ({
          endsRecord: i + cell.rowSpan === rows.length,
          rowCount: rows.length,
          border: getComputedStyle(cell).borderBottomWidth,
          bottom: cell.getBoundingClientRect().bottom,
          recordBottom: body.getBoundingClientRect().bottom,
        })))
      }))
      for (const cell of boundaries) {
        expect(cell.rowCount).toBe(spans + 1)
        expect(cell.border).toBe(cell.endsRecord ? '1px' : '0px')
        if (cell.endsRecord) expect(Math.abs(cell.bottom - cell.recordBottom)).toBeLessThanOrEqual(1)
      }
    })
  }

  test(`#6: НАЗН. не пересекается с текстом, ${theme}, ${density}%`, async ({ page }) => {
    await page.goto('/?slow=0#/rub-docs')
    await page.getByRole('button', { name: theme === 'dark' ? 'Тёмная' : 'Светлая', exact: true }).click()
    await page.getByRole('button', { name: `${density} %`, exact: true }).click()
    await page.locator('tbody[data-key]').first().waitFor()
    while (await page.getByRole('dialog').count()) await page.keyboard.press('Escape')
    for (const narrow of [false, true]) {
      if (narrow) for (const name of ['Отправитель', 'Получатель']) {
        const handle = page.getByRole('slider', { name: `Ширина колонки ${name}`, exact: true })
        for (let i = 0; i < 12; i++) await handle.press('ArrowLeft')
      }
      const overlaps = await page.locator('.rubSrTag[title="Назначение платежа"]').evaluateAll((tags) => tags.map((tag) => {
        const ink = document.createRange()
        ink.selectNodeContents(tag)
        const valueInk = document.createRange()
        valueInk.selectNodeContents(tag.nextElementSibling!)
        return ink.getBoundingClientRect().right - valueInk.getBoundingClientRect().left
      }))
      expect(overlaps.length).toBeGreaterThan(0)
      for (const overlap of overlaps) expect(overlap).toBeLessThanOrEqual(0)
      const names = await page.locator('tbody[data-key]').evaluateAll((records) => records.flatMap((record) => {
        const purpose = record.querySelector('.rubSrTag[title="Назначение платежа"]')!.getBoundingClientRect()
        return [':7', ':8'].map((column) => {
          const name = record.querySelector(`td[data-cell$="${column}"] .k-copy[data-tone="muted"]`)!
          const ink = document.createRange()
          ink.selectNodeContents(name)
          const text = ink.getBoundingClientRect()
          const clamp = name.closest('.k-clamp')!.getBoundingClientRect()
          return { top: text.top, bottom: text.bottom, clampTop: clamp.top, clampBottom: clamp.bottom, purposeTop: purpose.top }
        })
      }))
      for (const name of names) {
        expect(name.top).toBeGreaterThanOrEqual(name.clampTop)
        expect(name.bottom).toBeLessThanOrEqual(name.clampBottom)
        expect(name.bottom).toBeLessThanOrEqual(name.purposeTop)
      }
    }
  })
}

test('#5: граница скелетона и раскладки со скрытыми spans', async ({ page }) => {
  for (const query of ['spans=2&skeleton', 'spans=2&hidden']) {
    await page.goto(`/e2e/fixtures/grid.html?${query}`)
    const cells = page.locator('.k-record > tr:first-child > td[rowspan], .k-record > tr:last-child > td')
    await expect(cells.first()).toBeVisible()
    for (const border of await cells.evaluateAll((els) => els.map((el) => getComputedStyle(el).borderBottomWidth))) expect(border).toBe('1px')
  }
})

for (const pageScroll of [false, true]) {
  test(`#7: drawer не прокручивает ${pageScroll ? 'страницу' : 'контейнер'} хоста`, async ({ page }, testInfo) => {
    await page.goto(`/e2e/fixtures/grid.html?drawers${pageScroll ? '&pageScroll' : ''}`)
    const host = page.getByTestId('host-scroll')
    const scrollTop = () => pageScroll ? page.evaluate(() => window.scrollY) : host.evaluate((el) => el.scrollTop)
    const setScrollTop = (value: number) => pageScroll
      ? page.evaluate((top) => window.scrollTo(0, top), value)
      : host.evaluate((el, top) => { el.scrollTop = top }, value)
    const wheel = async (delta: number) => {
      await page.mouse.wheel(0, delta)
      // mouse.wheel завершается до нативной прокрутки; проверяем отсутствие движения после её обработки.
      await page.waitForTimeout(150)
    }
    const short = page.getByRole('dialog', { name: 'Короткая B', exact: true })
    const long = page.getByRole('dialog', { name: 'Длинная A', exact: true })
    for (const drawer of [short, long]) await drawer.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
    const shortScroll = short.locator('[data-part="scroll"]')
    const longScroll = long.locator('[data-part="scroll"]')
    if (testInfo.project.name === 'chromium-short-scroll-fallback') {
      // Современный Blink уже не позволяет отключить старый feature flag: снимаем только CSS-защиту короткой панели.
      await shortScroll.evaluate((el) => { el.style.overscrollBehaviorY = 'auto' })
    }
    expect(await shortScroll.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0)
    await short.hover({ position: { x: 400, y: 300 } })
    await wheel(300)
    expect(await scrollTop()).toBe(0)
    await long.hover({ position: { x: 400, y: 300 } })
    await wheel(300)
    await expect.poll(() => longScroll.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
    expect(await scrollTop()).toBe(0)
    await longScroll.evaluate((el) => { el.scrollTop = el.scrollHeight })
    await wheel(300)
    expect(await scrollTop()).toBe(0)
    await longScroll.evaluate((el) => { el.scrollTop = 0 })
    await setScrollTop(100)
    await wheel(-300)
    expect(await scrollTop()).toBe(100)
    await page.mouse.move(100, 300)
    await wheel(300)
    await expect.poll(scrollTop).toBeGreaterThan(100)
    await short.getByRole('button', { name: 'Закрыть', exact: true }).click()
    await expect(short).toHaveCount(0)
    await expect(long).toBeVisible()
  })
}

test('#7: вложенная прокрутка, горизонтальный ввод и Ctrl+wheel сохраняются', async ({ page }, testInfo) => {
  await page.goto('/e2e/fixtures/grid.html?drawers&pageScroll')
  const short = page.getByRole('dialog', { name: 'Короткая B', exact: true })
  await short.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
  const scroll = short.locator('[data-part="scroll"]')
  if (testInfo.project.name === 'chromium-short-scroll-fallback') await scroll.evaluate((el) => { el.style.overscrollBehaviorY = 'auto' })
  const text = short.getByRole('textbox', { name: 'Вложенный текст' })
  await text.hover()
  await page.mouse.wheel(0, 100)
  await expect.poll(() => text.evaluate((el) => el.scrollTop)).toBeGreaterThan(0)
  await text.evaluate((el) => { el.scrollTop = el.scrollHeight })
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const horizontal = page.getByTestId('horizontal')
  await horizontal.hover()
  await page.mouse.wheel(100, 0)
  await expect.poll(() => horizontal.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
  // Проверяем, что локальный listener не отменяет браузерный жест масштабирования.
  const zoomAllowed = await scroll.evaluate((el) => el.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true })))
  expect(zoomAllowed).toBe(true)
})
