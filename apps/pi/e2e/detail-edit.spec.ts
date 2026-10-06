import { expect, test, type Locator, type Page } from '@playwright/test'

// Замер эталона e065bfb (Task 1, detail-drift.md «2c»): Chromium 1600×1000, 100 %
const REF = { line: 21, opt: 18, inline: 22, sug: 24, promptW: 340, promptBtn: 30 }
// величины без токена — из таблицы «2c» (раскладка и Button кита): ширина редактора = сетка полей 772, кнопки подвала 23;
// строка поля сетки — 27 (detail-drift «2a», detail.spec.ts), пересверяется при правимых ячейках (карандаш — сосед строки)
const LAYOUT = { editW: 772, foot: 23, field: 27 }
const TOL = 2
const SUG_MIN_W = 320

test.use({ viewport: { width: 1600, height: 1000 } })
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    // фейк живёт в странице (сеть его не видит): запросы — по событию k-fake-request (app/fake/params.ts);
    // объявления живой области — журналом (текст перезаписывается следующим объявлением)
    const w = window as unknown as { __reqs: string[]; __said: string[] }
    w.__reqs = []
    w.__said = []
    window.addEventListener('k-fake-request', (e) => {
      const d = (e as CustomEvent<{ method: string; url: string }>).detail
      w.__reqs.push(`${d.method} ${d.url}`)
    })
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[role="status"][aria-live]')) {
        const t = el.textContent ?? ''
        if (t && w.__said[w.__said.length - 1] !== t) w.__said.push(t)
      }
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
})

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
/** Регуляторы фейка читаются из location.search на каждом запросе: меняем адрес без перезагрузки и без hashchange. */
const setQuery = (page: Page, query: string) =>
  page.evaluate((q) => history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`), query)

/** Экран на 100 % без открытых деталок (автооткрытие первой записи, В-Д4, закрываем Esc). */
async function start(page: Page, route: 'fx-docs' | 'rub-docs' = 'fx-docs', query = 'slow=0') {
  await page.goto(`/?${query}#/${route}`)
  await page.getByRole('button', { name: '100 %' }).click()
  await page.locator('tbody[data-key]').first().waitFor()
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
}
/** Открыть n-ю запись в A и дождаться её детали (открытие — через 220 мс, open-delay: ждём смены документа). */
async function open(page: Page, n: number): Promise<Locator> {
  const prev = await dialogs(page).count() > 0 ? await dialogs(page).first().getAttribute('aria-label') : null
  await openBtn(page, n).click()
  if (prev !== null) await expect(dialogs(page).first()).not.toHaveAttribute('aria-label', prev)
  await ready(page)
  return dialogs(page).first()
}
/** Сид правки поля 57 — вторая запись (MT202, CNY; preflight D1); 20 исх и подсказка счетов — первая (MT199, USD: 6 счетов Кт). */
const SEED = 2
const USD = 1
/** Маршрут есть не у MT199: пересчёт маршрута — на первой записи в USD другого типа (у CNY 0 счетов банка, preflight T12 п. 4). */
const routed = (page: Page) => page.locator('tbody[data-key]').filter({ hasText: 'USD' }).filter({ hasText: /MT103|MT202/ }).first()

/** Запросы фейка по шаблону «МЕТОД путь». */
const reqs = (page: Page, re: RegExp) => page.evaluate((src) => (window as unknown as { __reqs: string[] }).__reqs.filter((r) => new RegExp(src).test(r)).length, re.source)
const SEARCH = /^POST \/grids\/fx-docs\/search$/
const EDIT = /^POST \/grids\/fx-docs\/documents\/[^/]+\/edits$/
const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice())

/** Анимации внутри drawer закончены (подъём Prompt и подложка) — иначе замер и скриншот ловят промежуточный кадр. */
const settle = (dw: Locator) => dw.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)).then(() => undefined))
const box = async (loc: Locator) => (await loc.boundingBox())!
const near = (got: number, ref: number) => expect(Math.abs(got - ref), `${got} против ${ref}`).toBeLessThanOrEqual(TOL)
const editor57 = (dw: Locator) => dw.getByRole('region', { name: /^Поле 57 · .+ — правка$/ })
/** Новая дата валютирования в маске DateInput: fill даёт один onChange (у нативного date эталона второй change давал второй Prompt). */
async function pickDate(dw: Locator, ddmmyyyy: string) {
  await dw.getByRole('textbox', { name: 'Дата валютирования' }).fill(ddmmyyyy)
}

test(`геометрия правки против эталона ± ${TOL}`, async ({ page }) => {
  await start(page)
  const geo: Record<string, unknown> = {}

  // 20 исх и счёт Кт с подсказкой — на USD-документе
  let dw = await open(page, USD)
  await dw.getByRole('button', { name: 'Изменить 20 исх' }).click()
  geo.refOut = (await box(dw.getByRole('textbox', { name: '20 исх' }))).height
  await page.keyboard.press('Escape')
  await dw.getByRole('button', { name: 'Изменить счёт Кт' }).click()
  const acc = dw.getByRole('combobox', { name: 'Счёт Кт' })
  geo.acc = (await box(acc)).height
  await acc.pressSequentially('4')
  const list = page.getByRole('listbox')
  await expect(list.getByRole('option')).toHaveCount(5)
  await expect(page.getByText('ещё 1 — уточните номер')).toBeVisible()
  const sug = await list.getByRole('option').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
  // поповер подсказки: каскад .sug против .pop (Task 4) — padding 0, ширина max(поле, 320)
  const pop = await list.evaluate((el) => {
    const p = el.closest('[role="presentation"]') as HTMLElement
    const cs = getComputedStyle(p)
    return { w: p.getBoundingClientRect().width, pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft] }
  })
  const field = (await box(acc)).width
  geo.sug = { rows: sug, pop, field }
  await page.screenshot({ path: test.info().outputPath('edit-suggest.png') })
  await page.keyboard.press('Escape')

  // редактор поля 57 и Prompt даты — на документе сида
  dw = await open(page, SEED)
  await dw.getByRole('button', { name: 'Редактировать поле 57' }).click()
  const ed = editor57(dw)
  await expect(ed).toBeVisible()
  const grid = await ed.evaluate((el) => {
    let g = el.parentElement
    while (g && getComputedStyle(g).display !== 'grid') g = g.parentElement
    return g ? g.getBoundingClientRect().width : 0
  })
  const rows = await dw.locator('[data-field]:not([data-empty]) > button').evaluateAll((els) => els.map((e) => e.parentElement!.getBoundingClientRect().height))
  Object.assign(geo, {
    line: (await box(ed.getByRole('textbox', { name: 'Строка 1' }))).height,
    // кнопки опции — переключатели aria-pressed «Редактирования»
    opt: (await box(ed.locator('button[aria-pressed]').first())).height,
    editW: (await box(ed)).width,
    grid,
    foot: (await box(ed.getByRole('button', { name: 'Сохранить' }))).height,
    rows,
  })
  await page.screenshot({ path: test.info().outputPath('edit-editor.png') })
  await ed.getByRole('button', { name: 'Отмена' }).click()

  await dw.getByRole('button', { name: 'Изменить дату валютирования' }).click()
  // DateInput кита (Д52, класс C): размер s, не нативное поле эталона 22 — замер в аннотации, не сверка
  geo.date = (await box(dw.getByRole('textbox', { name: 'Дата валютирования' }))).height
  await pickDate(dw, '25.09.2026')
  const prompt = dw.getByRole('alertdialog', { name: 'Утвердить новую дату валютирования?' })
  await expect(prompt).toBeVisible()
  await settle(dw)
  geo.prompt = { box: await box(prompt), btn: (await box(prompt.getByRole('button', { name: 'Утвердить' }))).height }
  await page.screenshot({ path: test.info().outputPath('edit-prompt.png') })
  await prompt.getByRole('button', { name: 'Отмена' }).click()

  test.info().annotations.push({ type: 'geometry', description: JSON.stringify(geo) })
  near(geo.refOut as number, REF.inline)
  near(geo.acc as number, REF.inline)
  for (const h of sug) near(h, REF.sug)
  expect(pop.pad).toEqual(['0px', '0px', '0px', '0px'])
  // список не уже поля и 320 (min-width кита); шире — по содержимому: 20 цифр счёта не уходят под тег валюты,
  // как на эталоне при ширине ровно 320 (замер в аннотации, расхождение — в леджер Task 13)
  expect(pop.w, JSON.stringify(geo.sug)).toBeGreaterThanOrEqual(Math.max(field, SUG_MIN_W) - 0.5)
  near(geo.line as number, REF.line)
  near(geo.opt as number, REF.opt)
  expect(Math.abs((geo.editW as number) - grid)).toBeLessThanOrEqual(0.5)
  near(geo.editW as number, LAYOUT.editW)
  near(geo.foot as number, LAYOUT.foot)
  for (const h of rows) near(h, LAYOUT.field)
  const pr = geo.prompt as { box: { width: number }; btn: number }
  near(pr.box.width, REF.promptW)
  near(pr.btn, REF.promptBtn)
})

test('поле 57: сид — изменено и «2 изменения»; кириллица — ошибка и «Сохранить» недоступна; сохранение — маркер, «3 изменения», реестр перезапрошен, «Изменения сохранены»', async ({ page }) => {
  // медленный фейк: Esc во время сохранения (Task 5 M1) — редактор и деталка остаются
  await start(page, 'fx-docs', 'slow=400')
  const dw = await open(page, SEED)
  const cell = dw.locator('[data-field="57"]')
  await expect(cell).toHaveAttribute('data-edited', '')
  await cell.locator('> button[aria-expanded]').click()
  await expect(cell.getByText('2 изменения')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('edit-audit.png') })

  await dw.getByRole('button', { name: 'Редактировать поле 57' }).click()
  const ed = editor57(dw)
  const line1 = ed.getByRole('textbox', { name: 'Строка 1' })
  await line1.fill('ПРИВЕТ')
  await expect(ed.getByText("Строка 1: недопустимые символы (только латиница, цифры и / - ? : ( ) . , ' +)")).toBeVisible()
  await expect(ed.getByRole('button', { name: 'Сохранить' })).toBeDisabled()

  await line1.fill('NEW BANK LONDON')
  await expect(ed.getByRole('button', { name: 'Сохранить' })).toBeEnabled()
  const search = await reqs(page, SEARCH)
  await ed.getByRole('button', { name: 'Сохранить' }).click()
  await page.keyboard.press('Escape')
  await expect(ed).toBeVisible()
  await expect(dialogs(page)).toHaveCount(1)
  // ответ: редактор закрыт, маркер, история «3 изменения», реестр перезапрошен, объявление
  await expect(ed).toHaveCount(0)
  await expect(cell).toHaveAttribute('data-edited', '')
  await expect(cell.locator('> button[aria-expanded]')).toContainText('NEW BANK LONDON')
  await expect(cell.getByText('3 изменения')).toBeVisible()
  await expect.poll(() => reqs(page, SEARCH)).toBe(search + 1)
  await expect.poll(() => said(page)).toContain('Изменения сохранены')
  await expect(dialogs(page)).toHaveCount(1)
})

test('20 исх: Enter сохраняет (строчные → прописные), Esc отменяет без запроса, ↺ возвращает исходное', async ({ page }) => {
  await start(page)
  const dw = await open(page, USD)
  const msgs = dw.locator('[data-k-edit]')
  const pen = dw.getByRole('button', { name: 'Изменить 20 исх' })
  const original = (await dw.getByText(/^OUT\d+$/).first().textContent()) ?? ''
  expect(original).not.toBe('')

  await pen.click()
  await dw.getByRole('textbox', { name: '20 исх' }).fill('abc123')
  await page.keyboard.press('Enter')
  await expect(msgs).toHaveCount(0)
  await expect(dw.getByText('ABC123', { exact: true })).toBeVisible()
  await expect.poll(() => reqs(page, EDIT)).toBe(1)

  await pen.click()
  await dw.getByRole('textbox', { name: '20 исх' }).fill('zzz')
  await page.keyboard.press('Escape')
  await expect(msgs).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
  await expect(dw.getByText('ABC123', { exact: true })).toBeVisible()
  expect(await reqs(page, EDIT)).toBe(1)

  await pen.hover()
  await dw.getByRole('button', { name: 'Вернуть исходное' }).click()
  await expect(dw.getByText(original, { exact: true })).toBeVisible()
  await expect(dw.getByText('ABC123', { exact: true })).toHaveCount(0)
  expect(await reqs(page, EDIT)).toBe(2)
})

test('счёт Кт из подсказки → маршрут помечен «пересчитан»; Esc в списке отменяет правку, деталка открыта; следующий Esc закрывает деталку', async ({ page }) => {
  await start(page)
  await routed(page).locator('[data-k-open]').click()
  await ready(page)
  const dw = dialogs(page).first()
  await expect(dw.getByRole('button', { name: 'Маршрут' })).toBeVisible()
  await expect(dw.getByRole('img', { name: /^Маршрут пересчитан/ })).toHaveCount(0)
  await dw.getByRole('button', { name: 'Изменить счёт Кт' }).click()
  const acc = dw.getByRole('combobox', { name: 'Счёт Кт' })
  const options = page.getByRole('listbox').getByRole('option')
  await expect(options.first()).toBeVisible()
  // счёт, отличный от текущего (текущий — в блоке сообщений, группами цифр)
  const text = (await dw.textContent())!.replace(/\s/g, '')
  const accounts = (await options.allTextContents()).map((t) => t.slice(0, 20))
  const pick = accounts.findIndex((a) => !text.includes(a))
  expect(pick).toBeGreaterThanOrEqual(0)
  await options.nth(pick).click()
  await expect(acc).toHaveCount(0)
  await expect(dw.getByRole('img', { name: /^Маршрут пересчитан после смены счёта Кт/ })).toHaveCount(1)
  await expect.poll(() => reqs(page, EDIT)).toBe(1)

  // Esc в открытом списке — отмена правки счёта, деталка открыта (Review Focus 3)
  await dw.getByRole('button', { name: 'Изменить счёт Кт' }).click()
  await expect(options.first()).toBeVisible()
  await expect(acc).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(acc).toHaveCount(0)
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
  expect(await reqs(page, EDIT)).toBe(1)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(0)
})

test('дата валютирования: Prompt «Утвердить новую дату валютирования?» — «Отмена» оставляет правку с выбранной датой; «Утвердить» — значение warn, галочка утверждено', async ({ page }) => {
  await start(page)
  const dw = await open(page, SEED)
  await dw.getByRole('button', { name: 'Изменить дату валютирования' }).click()
  const input = dw.getByRole('textbox', { name: 'Дата валютирования' })
  await pickDate(dw, '25.09.2026')
  const prompt = dw.getByRole('alertdialog')
  await expect(prompt).toHaveCount(1)
  await expect(prompt).toHaveAccessibleName('Утвердить новую дату валютирования?')
  await expect(prompt).toContainText('23.09.2026')
  await expect(prompt).toContainText('25.09.2026')
  await prompt.getByRole('button', { name: 'Отмена' }).click()
  await expect(prompt).toHaveCount(0)
  await expect(input).toHaveValue('25.09.2026')
  expect(await reqs(page, EDIT)).toBe(0)

  await pickDate(dw, '26.09.2026')
  await expect(prompt).toHaveCount(1)
  await prompt.getByRole('button', { name: 'Утвердить' }).click()
  await expect(input).toHaveCount(0)
  const mark = dw.getByRole('img', { name: /^Изменено: было 23\.09\.2026 · .+ · утверждено/ })
  await expect(mark).toHaveAttribute('data-status', 'confirmed')
  await expect(mark.getByText('✓')).toBeVisible()
  const value = dw.locator('[data-part="hero"]').getByText('26.09.2026', { exact: true })
  await expect(value).toHaveClass(/__warn/)
  expect(await reqs(page, EDIT)).toBe(1)
})

test('грязный черновик: «Закрыть» и Esc — Prompt «Отменить правку?»; «Продолжить правку» — редактор на месте; «Отменить правку» — деталка закрыта', async ({ page }) => {
  await start(page)
  const dw = await open(page, SEED)
  await dw.getByRole('button', { name: 'Редактировать поле 57' }).click()
  const ed = editor57(dw)
  await ed.getByRole('textbox', { name: 'Строка 1' }).fill('DRAFT LINE')
  const ask = dw.getByRole('alertdialog', { name: 'Отменить правку?' })

  // «Закрыть» — вопрос; Esc в Prompt — отказ: редактор и деталка остаются (Review Focus 3)
  await dw.getByRole('button', { name: 'Закрыть' }).click()
  await expect(ask).toBeVisible()
  await expect(ask.getByRole('button', { name: 'Продолжить правку' })).toBeFocused()
  await settle(dw)
  await page.screenshot({ path: test.info().outputPath('edit-discard.png') })
  await page.keyboard.press('Escape')
  await expect(ask).toHaveCount(0)
  await expect(ed).toBeVisible()

  // Esc вне редактора (фокус вернулся на «Закрыть», preflight T12 п. 3) — тот же вопрос; «Продолжить правку» — всё на месте
  await expect(dw.getByRole('button', { name: 'Закрыть' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(ask).toBeVisible()
  await ask.getByRole('button', { name: 'Продолжить правку' }).click()
  await expect(ask).toHaveCount(0)
  await expect(ed.getByRole('textbox', { name: 'Строка 1' })).toHaveValue('DRAFT LINE')
  await expect(dialogs(page)).toHaveCount(1)

  await page.keyboard.press('Escape')
  await ask.getByRole('button', { name: 'Отменить правку' }).click()
  await expect(dialogs(page)).toHaveCount(0)
  expect(await reqs(page, EDIT)).toBe(0)
})

test('?conflict=edit — «Документ изменили — откройте заново», деталь перезапрошена; ?fail=edit — ошибка строкой, повтор после снятия регулятора сохраняет', async ({ page }) => {
  await start(page)
  const dw = await open(page, SEED)
  const id = (await dw.getByRole('button', { name: /^[0-9a-f]{8}-/ }).first().textContent())!.trim()
  const DETAIL = new RegExp(`^GET /grids/fx-docs/documents/${id}$`)
  const details = await reqs(page, DETAIL)

  await setQuery(page, 'slow=0&conflict=edit')
  await dw.getByRole('button', { name: 'Редактировать поле 57' }).click()
  const ed = editor57(dw)
  const line1 = ed.getByRole('textbox', { name: 'Строка 1' })
  await line1.fill('CONFLICT LINE')
  await ed.getByRole('button', { name: 'Сохранить' }).click()
  await expect(ed.getByText('Документ изменили — откройте заново')).toBeVisible()
  await expect(line1).toHaveValue('CONFLICT LINE')
  await expect.poll(() => reqs(page, DETAIL)).toBe(details + 1)
  await expect(dw.locator('[data-part="hero"]')).toBeVisible()

  // 409 у правки даты: длинный текст под полем не выходит за шапку drawer (nowrap, Task 9)
  await ed.getByRole('button', { name: 'Отмена' }).click()
  await dw.getByRole('button', { name: 'Изменить дату валютирования' }).click()
  await pickDate(dw, '25.09.2026')
  await dw.getByRole('alertdialog').getByRole('button', { name: 'Утвердить' }).click()
  const vdErr = dw.locator('[data-part="hero"]').getByText('Документ изменили — откройте заново')
  await expect(vdErr).toBeVisible()
  const err = await box(vdErr)
  const pane = await box(dw)
  test.info().annotations.push({ type: 'geometry', description: `409 даты: текст ${err.x}…${err.x + err.width}, drawer ${pane.x}…${pane.x + pane.width}` })
  expect(err.x + err.width).toBeLessThanOrEqual(pane.x + pane.width)
  await dw.getByRole('button', { name: 'Отмена' }).click()

  await setQuery(page, 'slow=0&fail=edit')
  await dw.getByRole('button', { name: 'Редактировать поле 57' }).click()
  await line1.fill('RETRY LINE')
  await ed.getByRole('button', { name: 'Сохранить' }).click()
  await expect(ed.getByText('Сбой сервера: Регулятор ?fail=edit')).toBeVisible()
  await expect(line1).toHaveValue('RETRY LINE')

  await setQuery(page, 'slow=0')
  await ed.getByRole('button', { name: 'Сохранить' }).click()
  await expect(ed).toHaveCount(0)
  await expect(dw.locator('[data-field="57"] > button[aria-expanded]')).toContainText('RETRY LINE')
  await expect.poll(() => said(page)).toContain('Изменения сохранены')
})

test('рубль: карандашей нет', async ({ page }) => {
  await start(page, 'rub-docs')
  const dw = await open(page, 1)
  await expect(dw.getByRole('heading', { name: 'Отправитель / Получатель' })).toBeVisible()
  await expect(dw.getByRole('button', { name: /^(Редактировать поле|Изменить)/ })).toHaveCount(0)
  await expect(dw.locator('[data-k-edit]')).toHaveCount(0)
})
