import { expect, test, type Page } from '@playwright/test'

// Замер эталона (Task 1, detail-drift.md): Chromium 1600×1000, масштаб 100 %
const REF = { width: 800, head: 44, lane: 36, tabs: 32, field: 27, partyRow: 23 }
const TOL = 2
// В-Д4 (detail-drift.md): открывается ли первая запись при входе на экран
const AUTO_OPEN = true

test.use({ viewport: { width: 1600, height: 1000 } })
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.clear()) })

const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })
const openBtn = (page: Page, n: number) => page.getByRole('button', { name: new RegExp(`^Открыть запись ${n}(\\D|$)`) })
/** Въезд drawer (k-drawer-in, сдвиг --k-drawer-shift) закончен — иначе boundingBox ловит промежуточный transform. */
const still = (page: Page, i = 0) =>
  dialogs(page).nth(i).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined))
const ready = async (page: Page, i = 0) => {
  await dialogs(page).nth(i).locator('[data-part="hero"]').waitFor()
  await still(page, i)
}
const heightIn = async (page: Page, sel: string) => (await dialogs(page).first().locator(sel).first().boundingBox())!.height

/** Экран на 100 % без открытых деталок (при AUTO_OPEN первая запись открыта сразу — закрываем Esc). */
async function start(page: Page, route: 'fx-docs' | 'rub-docs', query = 'slow=0') {
  await page.goto(`/?${query}#/${route}`)
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
}
/** Открыть первую запись с текстом (тип документа) — у валюты строка SWIFT-поля есть не у MT199. */
async function openWith(page: Page, text: string) {
  await page.locator('tbody[data-key]', { hasText: text }).first().locator('[data-k-open]').click()
  await ready(page)
}

for (const route of ['fx-docs', 'rub-docs'] as const) {
  test(`геометрия деталки против эталона ± ${TOL} (${route})`, async ({ page }) => {
    await start(page, route)
    await openWith(page, route === 'fx-docs' ? 'MT103' : 'PAYDOCRU')
    const dw = dialogs(page).first()
    const box = (await dw.boundingBox())!
    const geo = {
      width: box.width, right: box.x + box.width,
      head: await heightIn(page, '[data-part="head"]'), lane: await heightIn(page, '[data-part="lane"]'), tabs: await heightIn(page, '[data-part="tabs"]'),
      row: route === 'fx-docs'
        // строка SWIFT-поля (не текстовое 70/72): кнопка раскрытия — прямой потомок строки, мерим её родителя
        ? (await dw.locator('[data-field]:not([data-empty]) > button').first().locator('..').boundingBox())!.height
        : await heightIn(page, 'tr[data-part="party-row"]'),
    }
    test.info().annotations.push({ type: 'geometry', description: `${route}: ${JSON.stringify(geo)}` })
    expect(Math.abs(geo.width - REF.width)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.right - 1600)).toBeLessThanOrEqual(1)
    expect(Math.abs(geo.head - REF.head)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.lane - REF.lane)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.tabs - REF.tabs)).toBeLessThanOrEqual(TOL)
    expect(Math.abs(geo.row - (route === 'fx-docs' ? REF.field : REF.partyRow))).toBeLessThanOrEqual(TOL)
    await expect(dw.getByRole('heading', { name: 'Платёжная инструкция' })).toBeFocused()
    // скриншот сверки — рядом со скриншотом эталона Task 1
    await page.screenshot({ path: test.info().outputPath(`detail-${route}.png`) })
  })
}

// 2d (г7): лейн — шесть действий, «Редактировать» убран (правка — карандашами на месте); «Аннулировать» — последней
const LANE = {
  'fx-docs': ['Обновить', 'Создать служебный документ', 'Скачать SWIFT-сообщение', 'Печать', 'Скопировать ссылку на документ', 'Аннулировать'],
  'rub-docs': ['Обновить', 'Создать служебный документ', 'Скачать сообщение ED (XML)', 'Печать', 'Скопировать ссылку на документ', 'Аннулировать'],
}
for (const route of ['fx-docs', 'rub-docs'] as const) {
  test(`лейн: шесть действий, «Редактировать» нет (${route})`, async ({ page }) => {
    await start(page, route)
    await openBtn(page, 1).click()
    await ready(page)
    const lane = dialogs(page).first().getByRole('group', { name: 'Действия с документом' })
    await expect(lane.getByRole('button')).toHaveCount(6)
    expect(await lane.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).toEqual(LANE[route])
    await expect(dialogs(page).first().getByRole('button', { name: 'Редактировать', exact: true })).toHaveCount(0)
  })
}

test('A и B рядом: двойной клик открывает B слева, A не заменяется; записи помечены', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await expect(dialogs(page)).toHaveCount(1)
  const nameA = await dialogs(page).first().getAttribute('aria-label')
  await openBtn(page, 2).dblclick()
  await expect(dialogs(page)).toHaveCount(2)
  const b = dialogs(page).nth(0)
  const a = dialogs(page).nth(1)
  expect(await a.getAttribute('aria-label')).toBe(nameA)
  expect(await b.getAttribute('aria-label')).not.toBe(nameA)
  await still(page, 0)
  await still(page, 1)
  const ab = (await a.boundingBox())!
  const bb = (await b.boundingBox())!
  expect(Math.abs(bb.x + bb.width - ab.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(ab.x + ab.width - 1600)).toBeLessThanOrEqual(1)
  await expect(b.getByText('B · сравнение')).toBeVisible()
  await expect(page.locator('tbody[data-key][data-mark="a"]')).toHaveCount(1)
  await expect(page.locator('tbody[data-key][data-mark="b"]')).toHaveCount(1)
})

test('Shift+клик — второй drawer сразу', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await expect(dialogs(page)).toHaveCount(1)
  await openBtn(page, 2).click({ modifiers: ['Shift'] })
  await expect(dialogs(page)).toHaveCount(2)
})

test('Esc закрывает сначала B, потом A; фокус — на кнопке открытия записи', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await expect(dialogs(page)).toHaveCount(1)
  const nameA = await dialogs(page).first().getAttribute('aria-label')
  await openBtn(page, 2).dblclick()
  await expect(dialogs(page)).toHaveCount(2)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(1)
  expect(await dialogs(page).first().getAttribute('aria-label')).toBe(nameA)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(0)
  await expect(openBtn(page, 1)).toBeFocused()
})

test('повторное открытие открытого — второго drawer нет, фокус в его заголовок', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await ready(page)
  await openBtn(page, 1).click()
  await page.waitForTimeout(400)
  await expect(dialogs(page)).toHaveCount(1)
  await expect(dialogs(page).first().getByRole('heading', { name: 'Платёжная инструкция' })).toBeFocused()
})

for (const route of ['fx-docs', 'rub-docs'] as const) {
  test(`R10: автооткрытие первой записи фокус в drawer не переводит; открытие пользователем — в заголовок (${route})`, async ({ page }) => {
    await page.goto(`/?slow=0#/${route}`)
    await page.locator('tbody[data-key]').first().waitFor()
    await expect(dialogs(page)).toHaveCount(1)
    await ready(page)
    expect(await page.evaluate(() => document.activeElement?.closest('[data-k-drawer]') != null)).toBe(false)
    await openBtn(page, 2).click()
    await ready(page)
    await expect(dialogs(page).first().getByRole('heading', { name: 'Платёжная инструкция' })).toBeFocused()
  })
}

test('R11: «Закрыть» у A при открытом B — фокус в заголовок оставшегося drawer (он теперь A)', async ({ page }) => {
  await start(page, 'fx-docs')
  await openBtn(page, 1).click()
  await ready(page)
  const nameA = await dialogs(page).first().getAttribute('aria-label')
  await openBtn(page, 2).dblclick()
  await expect(dialogs(page)).toHaveCount(2)
  const nameB = await dialogs(page).first().getAttribute('aria-label')
  await page.getByRole('dialog', { name: nameA ?? '' }).getByRole('button', { name: 'Закрыть' }).click()
  await expect(dialogs(page)).toHaveCount(1)
  const left = dialogs(page).first()
  await expect(left).toHaveAttribute('aria-label', nameB ?? '')
  await expect(left.getByRole('heading', { name: 'Платёжная инструкция' })).toBeFocused()
})

test('вкладки: в полосе 800 px не помещаются все — «••• N»; Esc закрывает меню, а не drawer', async ({ page }) => {
  await start(page, 'fx-docs')
  await openWith(page, 'MT103')
  const dw = dialogs(page).first()
  const more = dw.getByRole('button', { name: /^Ещё вкладки: \d+$/ })
  await expect(more).toBeVisible()
  const n = Number(((await more.getAttribute('aria-label')) ?? '').replace(/\D/g, ''))
  await more.click()
  const menu = page.getByRole('menu', { name: 'Вкладки' })
  await expect(menu.getByRole('menuitem')).toHaveCount(n)
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
  // с 2b вкладка показывает содержимое, заглушки «будет в срезе 2b» нет (сами вкладки — detail-tabs.spec.ts)
  const statuses = dw.getByRole('tab', { name: 'Статусы' })
  // статусы есть у каждого документа фейка (цепочка не бывает пустой) — вкладка всегда доступна
  await expect(statuses).toBeEnabled()
  await statuses.click()
  await expect(dw.getByRole('tabpanel').getByRole('table').first()).toBeVisible()
  await expect(dw.getByText(/будет в срезе 2b/)).toHaveCount(0)
})

test('медленная загрузка — скелетон, затем форма', async ({ page }) => {
  await start(page, 'fx-docs', 'slow=1500')
  await openBtn(page, 1).click()
  await expect(dialogs(page).first().locator('[data-part="skeleton"]')).toBeVisible()
  await ready(page)
})

test('?fail=detail — ошибка внутри drawer с «Повторить», реестр живой', async ({ page }) => {
  await start(page, 'fx-docs', 'slow=0&fail=detail')
  await openBtn(page, 1).click()
  const alert = dialogs(page).first().getByRole('alert')
  await expect(alert).toContainText('Регулятор ?fail=detail')
  await expect(alert.getByRole('button', { name: 'Повторить' })).toBeVisible()
  await expect(dialogs(page).first()).toHaveAttribute('aria-label', /№ \d+/)
  await expect(page.locator('tbody[data-key]').first()).toBeVisible()
})

test('уход с экрана закрывает деталку; при возврате открыта только первая запись (В-Д4)', async ({ page }) => {
  await start(page, 'fx-docs')
  // имя деталки первой записи — то, что откроет авто-открытие при возврате
  await openBtn(page, 1).click()
  await ready(page)
  const nameFirst = await dialogs(page).first().getAttribute('aria-label')
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(0)
  // перед уходом открыты другие записи в A и B: авто-открытие заменило бы уцелевшую A первой записью,
  // поэтому утечку через pageClosed выдаёт и уцелевшая B (второй drawer), и имя A
  await openBtn(page, 2).click()
  await ready(page)
  const nameLeft = await dialogs(page).first().getAttribute('aria-label')
  expect(nameLeft).not.toBe(nameFirst)
  await openBtn(page, 4).click({ modifiers: ['Shift'] })
  await expect(dialogs(page)).toHaveCount(2)
  // B (x 0–800) закрывает навигацию оболочки — уход тем же маршрутом, что у ссылки «Рублёвые документы»
  await page.evaluate(() => { location.hash = '#/rub-docs' })
  await page.locator('tbody[data-key]').first().waitFor()
  await expect(dialogs(page)).toHaveCount(AUTO_OPEN ? 1 : 0)
  if (AUTO_OPEN) await expect(dialogs(page).first()).not.toHaveAttribute('aria-label', nameLeft ?? '')
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Валютные документы' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  await expect(dialogs(page)).toHaveCount(AUTO_OPEN ? 1 : 0)
  if (AUTO_OPEN) {
    await ready(page)
    await expect(dialogs(page)).toHaveCount(1)
    await expect(dialogs(page).first()).toHaveAttribute('aria-label', nameFirst ?? '')
  }
})

test('враждебный хост (?hostile): ширина drawer и строка поля те же', async ({ page }) => {
  await start(page, 'fx-docs', 'hostile&slow=0')
  await page.waitForFunction(() => getComputedStyle(document.body).fontFamily.includes('Georgia'))
  await openWith(page, 'MT103')
  const dw = dialogs(page).first()
  const width = (await dw.boundingBox())!.width
  const row = (await dw.locator('[data-field]:not([data-empty]) > button').first().locator('..').boundingBox())!.height
  test.info().annotations.push({ type: 'geometry', description: `hostile: width=${width} row=${row}` })
  expect(Math.abs(width - REF.width)).toBeLessThanOrEqual(1)
  expect(Math.abs(row - REF.field)).toBeLessThanOrEqual(TOL)
})
