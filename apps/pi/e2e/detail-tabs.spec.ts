import { expect, test, type Locator, type Page } from '@playwright/test'

// Замер эталона e065bfb (Task 1, detail-drift.md «2b»): Chromium 1600×1000, масштаб 100 %
// head — шапка мини-таблицы (.tt th), row — строка (.tt td), kv — строка «ключ–значение» (.xr), expand — раскрываемая строка (.tk/.ld)
const REF = { head: 22, row: 24, kv: 24, expand: 26 }
const TOL = 2
const ROUTES = ['fx-docs', 'rub-docs'] as const
type Route = (typeof ROUTES)[number]
// вкладки кроме «Общих»: id — для имён скриншотов, подпись — как в полосе
const TABS: Record<Route, [string, string][]> = {
  'fx-docs': [
    ['extra', 'Доп. поля'], ['statuses', 'Статусы'], ['compliance', 'Комплаенс'], ['linked', 'Связанные документы'], ['tasks', 'Задачи'],
    ['notif', 'Нотификации'], ['source', 'Исходный текст'], ['stream', 'Стриминг'], ['mpu', 'MPU'], ['audit', 'Аудит'],
  ],
  'rub-docs': [
    ['statuses', 'Статусы'], ['compliance', 'Комплаенс'], ['linked', 'Связанные документы'], ['tasks', 'Задачи'],
    ['notif', 'Нотификации'], ['ed244', 'ED244'], ['stream', 'Стриминг'], ['mpu', 'MPU'], ['audit', 'Аудит'],
  ],
}

test.use({ viewport: { width: 1600, height: 1000 } })
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })
/** Кнопка открытия n-й записи по порядку реестра: у заблокированной имя другое («Заблокирована: … · открыть только для просмотра»). */
const openBtn = (page: Page, n: number) => page.locator('tbody[data-key]').nth(n - 1).locator('[data-k-open]')
/** Въезд drawer закончен — иначе boundingBox ловит промежуточный transform. */
const still = (page: Page, i = 0) =>
  dialogs(page).nth(i).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined))
const ready = async (page: Page, i = 0) => {
  await dialogs(page).nth(i).locator('[data-part="hero"]').waitFor()
  await still(page, i)
}
/** Высота строки: сам элемент-строка или ближайшая строка-предок (role="row" или tr). */
const rowHeight = (loc: Locator) => loc.evaluate((el) => (el.closest('[role="row"], tr') ?? el).getBoundingClientRect().height)
/** Регуляторы фейка читаются из location.search на каждом запросе: меняем адрес без перезагрузки и без hashchange. */
const setQuery = (page: Page, query: string) =>
  page.evaluate((q) => history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`), query)

/** Экран на 100 % без открытых деталок (автооткрытие первой записи, В-Д4, закрываем Esc). */
async function start(page: Page, route: Route, query = 'slow=0') {
  await page.goto(`/?${query}#/${route}`)
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
}
/** Содержимое активной вкладки готово: скелетона нет, панель не пуста. */
async function settled(dw: Locator) {
  await expect(dw.locator('[data-part="tab-skeleton"]')).toHaveCount(0)
  await expect(dw.getByRole('tabpanel')).not.toBeEmpty()
}
/** Выбрать вкладку: видимую — кликом, из переполнения — через «••• N». false — вкладка недоступна (нет данных, tabsOff). */
async function pickTab(page: Page, dw: Locator, name: string): Promise<boolean> {
  const tab = dw.getByRole('tab', { name, exact: true })
  if (await tab.count() > 0) {
    if (await tab.isDisabled()) return false
    await tab.click()
    return true
  }
  await dw.getByRole('button', { name: /^Ещё вкладки: \d+$/ }).click()
  const item = page.getByRole('menu', { name: 'Вкладки' }).getByRole('menuitem', { name: new RegExp(`^${name}`) })
  if (await item.isDisabled()) {
    await page.keyboard.press('Escape')
    return false
  }
  await item.click()
  return true
}
/** Открыть в A первую запись (по порядку реестра), у которой вкладка есть, и выбрать её. */
async function openWithTab(page: Page, name: string): Promise<{ dw: Locator; n: number }> {
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
  let prev: string | null = null
  for (let n = 1; n <= 20; n++) {
    await openBtn(page, n).click()
    // открытие — через 220 мс (open-delay): ждём смены документа, иначе ready поймал бы прежний
    if (prev !== null) await expect(dialogs(page).first()).not.toHaveAttribute('aria-label', prev)
    await ready(page)
    const dw = dialogs(page).first()
    if (await pickTab(page, dw, name)) return { dw, n }
    prev = await dw.getAttribute('aria-label')
  }
  throw new Error(`Нет документа с вкладкой «${name}» среди первых 20 записей`)
}

/** Шапка и строка мини-таблицы «Статусов» первого документа, где они есть. */
async function tableRows(page: Page): Promise<{ head: number; row: number }> {
  const { dw } = await openWithTab(page, 'Статусы')
  await settled(dw)
  const table = dw.getByRole('tabpanel').getByRole('table').first()
  return {
    head: await rowHeight(table.getByRole('row').filter({ has: page.getByRole('columnheader') }).first()),
    row: await rowHeight(table.getByRole('row').filter({ has: page.getByRole('cell') }).first()),
  }
}
/** Строка «ключ–значение» «Комплаенса» первого документа, где он есть. */
async function kvRow(page: Page): Promise<number> {
  const { dw } = await openWithTab(page, 'Комплаенс')
  await settled(dw)
  return rowHeight(dw.getByRole('tabpanel').locator('[data-kv]').first())
}

for (const route of ROUTES) {
  test(`высоты вкладок против эталона ± ${TOL} (${route})`, async ({ page }) => {
    test.setTimeout(90_000)
    await start(page, route)
    const { head, row } = await tableRows(page)
    const kv = await kvRow(page)
    const { dw } = await openWithTab(page, 'Задачи')
    await settled(dw)
    const expand = await rowHeight(dw.getByRole('tabpanel').getByRole('table').first().locator('[aria-expanded]').first())
    const geo = { head, row, kv, expand }
    test.info().annotations.push({ type: 'geometry', description: `${route}: ${JSON.stringify(geo)}` })
    expect(Math.abs(geo.head - REF.head)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.row - REF.row)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.kv - REF.kv)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.expand - REF.expand)).toBeLessThanOrEqual(TOL)
  })

  test(`«Связанные документы»: ID связанного открывает его в B (${route})`, async ({ page }) => {
    test.setTimeout(60_000)
    await start(page, route)
    const { dw } = await openWithTab(page, 'Связанные документы')
    await settled(dw)
    const nameA = await dw.getAttribute('aria-label')
    await dw.getByRole('tabpanel').getByRole('button', { name: /^Открыть .+ в соседней панели$/ }).first().click()
    await expect(dialogs(page)).toHaveCount(2)
    const b = dialogs(page).nth(0)
    await expect(b.getByText('B · сравнение')).toBeVisible()
    expect(await b.getAttribute('aria-label')).not.toBe(nameA)
    await expect(dialogs(page).nth(1)).toHaveAttribute('aria-label', nameA ?? '')
    await ready(page, 0)
    await expect(b.getByRole('heading', { name: 'Платёжная инструкция' })).toBeFocused()
  })

  test(`скриншоты вкладок для сверки с эталоном (${route})`, async ({ page }) => {
    test.setTimeout(180_000)
    await start(page, route)
    const shot: string[] = []
    for (const [id, name] of TABS[route]) {
      const { dw } = await openWithTab(page, name)
      await settled(dw)
      await expect(dw.getByRole('alert')).toHaveCount(0)
      await page.screenshot({ path: test.info().outputPath(`tab-${route}-${id}.png`) })
      shot.push(id)
    }
    test.info().annotations.push({ type: 'screenshots', description: `${route}: ${shot.join(', ')}` })
  })
}

test('?fail=tab:audit — ошибка вкладки с «Повторить»; шапка, лейн и «Общие» живы; после снятия регулятора повтор успешен', async ({ page }) => {
  test.setTimeout(60_000)
  await start(page, 'fx-docs', 'slow=0&fail=tab:audit')
  const { dw } = await openWithTab(page, 'Аудит')
  const alert = dw.getByRole('tabpanel').getByRole('alert')
  await expect(alert).toContainText('Не удалось загрузить вкладку')
  await expect(alert).toContainText('Регулятор ?fail=tab:audit')
  await expect(dw).toHaveAttribute('aria-label', /№ \d+/)
  await expect(dw.locator('[data-part="lane"]')).toBeVisible()
  expect(await pickTab(page, dw, 'Общие данные')).toBe(true)
  await expect(dw.locator('[data-part="hero"]')).toBeVisible()
  // регулятор взведён: повторный выбор вкладки с ошибкой — новый запрос и снова ошибка
  expect(await pickTab(page, dw, 'Аудит')).toBe(true)
  await expect(alert).toContainText('Не удалось загрузить вкладку')
  await setQuery(page, 'slow=0')
  await alert.getByRole('button', { name: 'Повторить' }).click()
  await expect(dw.getByRole('alert')).toHaveCount(0)
  await settled(dw)
})

test('кэш вкладок: возврат на вкладку и повторное открытие документа без запроса (взведённый ?fail=tab не срабатывает)', async ({ page }) => {
  test.setTimeout(60_000)
  await start(page, 'fx-docs')
  const { dw, n } = await openWithTab(page, 'Статусы')
  await settled(dw)
  const name = await dw.getAttribute('aria-label')
  // с этого момента любой новый запрос вкладки — 500: ошибки нет ⇔ запроса не было
  await setQuery(page, 'slow=0&fail=tab')
  expect(await pickTab(page, dw, 'Общие данные')).toBe(true)
  await expect(dw.locator('[data-part="hero"]')).toBeVisible()
  expect(await pickTab(page, dw, 'Статусы')).toBe(true)
  await settled(dw)
  await expect(dw.getByRole('alert')).toHaveCount(0)
  // другой документ в A, затем снова тот же — «Статусы» из кэша id:tab
  await openBtn(page, n + 1).click()
  await expect(dialogs(page).first()).not.toHaveAttribute('aria-label', name ?? '')
  await ready(page)
  await openBtn(page, n).click()
  await expect(dialogs(page).first()).toHaveAttribute('aria-label', name ?? '')
  await ready(page)
  const again = dialogs(page).first()
  expect(await pickTab(page, again, 'Статусы')).toBe(true)
  await settled(again)
  await expect(again.getByRole('alert')).toHaveCount(0)
  // контроль: регулятор действительно взведён — вкладка не из кэша падает
  let control = false
  for (const other of ['Комплаенс', 'Задачи', 'Нотификации', 'Стриминг', 'Аудит']) {
    if (await pickTab(page, again, other)) { control = true; break }
  }
  expect(control).toBe(true)
  await expect(again.getByRole('tabpanel').getByRole('alert')).toContainText('Не удалось загрузить вкладку')
})

test('враждебный хост (?hostile): строки вкладок той же высоты', async ({ page }) => {
  test.setTimeout(60_000)
  await start(page, 'fx-docs', 'hostile&slow=0')
  await page.waitForFunction(() => getComputedStyle(document.body).fontFamily.includes('Georgia'))
  const { head, row } = await tableRows(page)
  const kv = await kvRow(page)
  test.info().annotations.push({ type: 'geometry', description: `hostile: ${JSON.stringify({ head, row, kv })}` })
  expect(Math.abs(head - REF.head)).toBeLessThanOrEqual(TOL)
  expect(Math.abs(row - REF.row)).toBeLessThanOrEqual(TOL)
  expect(Math.abs(kv - REF.kv)).toBeLessThanOrEqual(TOL)
})

test('Д28: метка открытой записи сильнее состояния — полоса val у заблокированной и неактивной, фон метки без штриховки', async ({ page }) => {
  await start(page, 'fx-docs')
  for (const state of ['locked', 'inactive'] as const) {
    const rec = page.locator(`tbody[data-key][data-state="${state}"]`).first()
    await rec.locator('[data-k-open]').click()
    await expect(rec).toHaveAttribute('data-mark', 'a')
    await page.mouse.move(1, 1)
    const st = await rec.evaluate((el) => {
      const probe = (value: string) => {
        const p = document.createElement('div')
        p.style.color = value
        document.body.appendChild(p)
        const c = getComputedStyle(p).color
        p.remove()
        return c
      }
      const cells = el.querySelectorAll<HTMLElement>('td[role="gridcell"]')
      const lead = getComputedStyle(cells[0]!)
      const value = getComputedStyle(cells[1]!)
      return { stripe: lead.boxShadow, image: value.backgroundImage, bg: value.backgroundColor, val: probe('var(--k-val)'), soft: probe('var(--k-val-soft)') }
    })
    test.info().annotations.push({ type: 'Д28', description: `${state}: ${JSON.stringify(st)}` })
    expect(st.stripe.startsWith(st.val)).toBe(true)
    expect(st.image).toBe('none')
    expect(st.bg).toBe(st.soft)
  }
})
