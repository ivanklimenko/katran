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

// Кт валютирования красится в --k-warn классом демо .warn (спека 5b §3, R10) — .warn.warn (0,2,0)
// бьёт CopyValue .muted (0,1,0) независимо от порядка правил в сборке (находка контроллера, раунд 1).
// Ячейка ищется по заголовку колонки «Дата / Время», строки Дт/Кт — по подписи (финал 5b, M7), не по позициям.
// В записи-состоянии (заблокирована/неактивна) warn приглушён до muted (финал 5b, M3).
test('Кт валютирования, если отличается от Дт, — цвет из --k-warn; в записи-состоянии — muted', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  // 100 записей на странице: на 20 может не оказаться записи-состояния с Кт ≠ Дт (данные детерминированы, но редки)
  await page.getByRole('combobox', { name: 'На странице' }).selectOption('100')
  await page.locator('tbody[data-key]').nth(20).waitFor()
  const res = await page.evaluate(() => {
    const probe = (v: string) => {
      const el = document.createElement('div')
      el.style.color = getComputedStyle(document.documentElement).getPropertyValue(v)
      document.body.appendChild(el)
      const c = getComputedStyle(el).color
      document.body.removeChild(el)
      return c
    }
    const heads = [...document.querySelectorAll('table[role=grid] thead th')]
    const col = heads.findIndex((th) => th.textContent?.includes('Дата / Время'))
    const line = (cell: Element, label: string) =>
      [...cell.querySelectorAll('div')].find((d) => d.textContent?.trim().startsWith(label))?.querySelector('button') ?? null
    const find = (sel: string) => {
      for (const row of document.querySelectorAll(sel)) {
        const cell = row.querySelector('tr')?.children[col]
        if (!cell) continue
        const dt = line(cell, 'Дт'), kt = line(cell, 'Кт')
        if (dt && kt && dt.textContent !== kt.textContent) return getComputedStyle(kt).color
      }
      return null
    }
    return { col, plain: find('tbody[data-key]:not([data-state])'), stated: find('tbody[data-key][data-state]'), warn: probe('--k-warn'), muted: probe('--k-muted') }
  })
  expect(res.col).toBeGreaterThan(0)
  expect(res.plain).toBe(res.warn)
  expect(res.stated).toBe(res.muted)
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

// Финал 5b, I1: обесцвечивание (grayscale + прозрачность) в записи-состоянии — только у статусной точки
// ([data-st]); тег типа в той же записи непрозрачен, его текст приглушён токеном (--k-ink2 → muted).
test('заблокированная запись: тег типа непрозрачен, точка статуса обесцвечена, замок — warn', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-state="locked"]').first().waitFor()
  const r = await page.evaluate(() => {
    const rec = document.querySelector('tbody[data-state="locked"]')!
    const heads = [...document.querySelectorAll('table[role=grid] thead th')]
    const col = heads.findIndex((th) => th.textContent?.trim().startsWith('Тип'))
    const tag = rec.querySelector('tr')!.children[col]!.querySelector('span')!
    const dot = rec.querySelector('[data-st]') as HTMLElement
    const lock = rec.querySelector('button[aria-label^="Заблокирована"]') as HTMLElement
    const probe = document.createElement('div')
    probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--k-warn')
    document.body.appendChild(probe)
    const warn = getComputedStyle(probe).color
    document.body.removeChild(probe)
    return { tagOpacity: getComputedStyle(tag).opacity, tagFilter: getComputedStyle(tag).filter, tagText: tag.textContent, dotOpacity: getComputedStyle(dot).opacity, lock: getComputedStyle(lock).color, warn }
  })
  expect(r.tagText).toMatch(/^MT/)
  expect(r.tagOpacity).toBe('1')
  expect(r.tagFilter).toBe('none')
  expect(Number(r.dotOpacity)).toBeLessThan(1)
  // замок в служебной ячейке остаётся тона warn: приглушение warn — только в ячейках значений (M3)
  expect(r.lock).toBe(r.warn)
})

// Финал 5b, I3 и I4: счётчик на primary-кнопке «Фильтры» — текст и рамка paper и в нуле (не faint на val);
// лейн статусов на бумаге (эталон .slane), счётчики фона chip на нём видны.
test('бейдж «Фильтры» читаем в нуле; лейн на фоне paper', async ({ page }) => {
  await page.goto('/#/grid')
  await page.locator('tbody[data-key]').first().waitFor()
  const r = await page.evaluate(() => {
    const probe = (v: string) => {
      const el = document.createElement('div')
      el.style.color = getComputedStyle(document.documentElement).getPropertyValue(v)
      document.body.appendChild(el)
      const c = getComputedStyle(el).color
      document.body.removeChild(el)
      return c
    }
    const toggle = [...document.querySelectorAll('button[aria-expanded]')].find((b) => b.textContent?.startsWith('Фильтры'))!
    const badge = toggle.querySelector('[data-tone="accent"]') as HTMLElement
    const lane = document.querySelector('[role=group][aria-label="Статусы"]') as HTMLElement
    return {
      text: badge.textContent, color: getComputedStyle(badge).color, border: getComputedStyle(badge).borderTopColor,
      laneBg: getComputedStyle(lane).backgroundColor, paper: probe('--k-paper'),
    }
  })
  expect(r.text).toBe('0')
  expect(r.color).toBe(r.paper)
  expect(r.border).toBe(r.paper)
  expect(r.laneBg).toBe(r.paper)
})
