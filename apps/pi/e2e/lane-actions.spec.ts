import { expect, test, type Locator, type Page } from '@playwright/test'

// Срез 2d в настоящем браузере (спека 2d §4, §5): «вторая рука» (утвердить/отклонить чужую правку) и действия лейна —
// скачать, печать во вкладке, F5 — «Обновить», ссылка ?doc=. Фейк живёт в странице: запросы — по событию k-fake-request.

test.use({ viewport: { width: 1600, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
    // запросы фейка (app/fake/params.ts), объявления живой области журналом, F5 — отменено ли умолчание браузера
    // (headless Chromium по F5 из CDP страницу не перезагружает: перехват видно только по defaultPrevented)
    const w = window as unknown as { __reqs: string[]; __said: string[]; __f5: boolean[] }
    w.__reqs = []
    w.__said = []
    w.__f5 = []
    window.addEventListener('k-fake-request', (e) => {
      const d = (e as CustomEvent<{ method: string; url: string }>).detail
      w.__reqs.push(`${d.method} ${d.url}`)
    })
    // фаза всплытия у window — после обработчика React (корень приложения): видно решение деталки
    window.addEventListener('keydown', (e) => { if (e.key === 'F5') w.__f5.push(e.defaultPrevented) })
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[role="status"][aria-live]')) {
        const t = el.textContent ?? ''
        if (t && w.__said[w.__said.length - 1] !== t) w.__said.push(t)
      }
    }).observe(document, { subtree: true, childList: true, characterData: true })
  })
})

const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })
const openBtn = (page: Page, n: number) => page.locator('tbody[data-key]').nth(n - 1).locator('[data-k-open]')
const ready = async (page: Page) => {
  const dw = dialogs(page).first()
  await dw.locator('[data-part="hero"]').waitFor()
  await dw.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined))
  return dw
}
/** Экран без открытых деталок (автооткрытие первой записи, В-Д4, закрываем Esc). */
async function start(page: Page, query = 'slow=0') {
  await page.goto(`/?${query}#/fx-docs`)
  await page.locator('tbody[data-key]').first().waitFor()
  while (await dialogs(page).count() > 0) await page.keyboard.press('Escape')
}
async function open(page: Page, n: number): Promise<Locator> {
  await openBtn(page, n).click()
  return ready(page)
}
/** Документ по ссылке ?doc= (сиды фейка не обязаны стоять первыми в реестре). */
async function openDoc(page: Page, id: string, query = 'slow=0') {
  await page.goto(`/?${query}#/fx-docs?doc=${id}`)
  const dw = await ready(page)
  await expect(dw.getByRole('button', { name: id })).toBeVisible()
  return dw
}
const idOf = async (dw: Locator) => (await dw.getByRole('button', { name: /^[0-9a-f]{8}-/ }).first().textContent())!.trim()

/** Сид чужой ожидающей правки поля 57 — вторая запись реестра (Иванова М. П.); счёта Кт — 0f3c0014 (Кузнецов Д. А.). */
const SEED_57 = { n: 2, id: '0f3c0001-7b1d-4c8e-9f0a-286655677016' }
const SEED_KT = { id: '0f3c0014-7b1d-4c8e-9f0a-508698803372', was: '4070284071999236522', now: '40817840100050017762' }

const reqs = (page: Page, re: RegExp) => page.evaluate((src) => (window as unknown as { __reqs: string[] }).__reqs.filter((r) => new RegExp(src).test(r)).length, re.source)
const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice())
const f5 = (page: Page) => page.evaluate(() => (window as unknown as { __f5: boolean[] }).__f5.slice())
const DECIDE = /^POST \/grids\/fx-docs\/documents\/[^/]+\/edits\/[^/]+\/(confirm|reject)$/
const digits = (s: string | null) => (s ?? '').replace(/\D/g, '')

/** Контраст текста элемента к его фактическому фону (WCAG 2.x): фон — первый непрозрачный предок, полупрозрачные смешаны. */
const contrastOf = (loc: Locator) => loc.evaluate((el) => {
  const rgba = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number) as [number, number, number, number?]
  const layers: [number, number, number, number][] = []
  for (let n: Element | null = el; n; n = n.parentElement) {
    const [r, g, b, a = 1] = rgba(getComputedStyle(n).backgroundColor)
    if (a > 0) layers.push([r, g, b, a])
    if (a >= 1) break
  }
  let bg: [number, number, number] = [255, 255, 255]
  for (const [r, g, b, a] of layers.reverse()) bg = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)]
  const [fr, fg, fb, fa = 1] = rgba(getComputedStyle(el).color)
  const fg3: [number, number, number] = [fr * fa + bg[0] * (1 - fa), fg * fa + bg[1] * (1 - fa), fb * fa + bg[2] * (1 - fa)]
  const lum = ([r, g, b]: [number, number, number]) => {
    const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
  }
  const [hi, lo] = [lum(fg3), lum(bg)].sort((a, b) => b - a) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
})

test('утвердить чужую правку поля 57: Prompt «Утвердить правку?», в полёте фокус на Prompt и Esc деталку не закрывает; бейдж «утверждено», «Утвердил(а) Вы, …», кнопок решения нет', async ({ page }) => {
  // медленный фейк — видно состояние «в полёте»
  await start(page, 'slow=600')
  const dw = await open(page, SEED_57.n)
  expect(await idOf(dw)).toBe(SEED_57.id)
  const cell = dw.locator('[data-field="57"]')
  await cell.locator('> button[aria-expanded]').click()
  await expect(cell.getByText('ожидает утверждения')).toBeVisible()
  await cell.getByRole('button', { name: 'Утвердить', exact: true }).click()

  const prompt = dw.getByRole('alertdialog', { name: 'Утвердить правку?' })
  await expect(prompt).toBeVisible()
  // тело — что и кем изменено: автор чужой правки и её время
  await expect(prompt).toContainText('Иванова М. П.')
  await expect(prompt).toContainText('23.09.2026 10:42')
  await prompt.getByRole('button', { name: 'Утвердить' }).click()
  // busy: кнопки недоступны, фокус — на коробке Prompt (внутри drawer), Esc не закрывает ни Prompt, ни деталку (Task 2, minor)
  await expect(prompt.getByRole('button', { name: 'Утвердить' })).toBeDisabled()
  expect(await page.evaluate(() => document.activeElement?.closest('[data-k-prompt]') != null)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(1)

  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Правка утверждена')
  expect(await reqs(page, DECIDE)).toBe(1)
  await expect(cell.getByText('утверждено', { exact: true })).toBeVisible()
  await expect(cell.getByRole('button', { name: /^(Утвердить|Отклонить)$/ })).toHaveCount(0)
  await cell.getByRole('button', { name: 'История' }).click()
  const last = cell.getByRole('list', { name: /^История изменений/ }).getByRole('listitem').last()
  await expect(last).toContainText('Иванова М. П.')
  await expect(last.locator('[data-k-tip]')).toHaveAttribute('data-k-tip', /^Утвердил\(а\) Вы, \d{2}\.\d{2}\.\d{4}/)
  await expect(dialogs(page)).toHaveCount(1)
})

test('отклонить правку счёта Кт: «Отклонить» недоступна без причины и при пробелах, 141-й символ обрезан; после — счёт и маршрут как до правки, объявление «Правка отклонена»', async ({ page }) => {
  const dw = await openDoc(page, SEED_KT.id)
  const route = dw.getByRole('img', { name: /^Маршрут пересчитан после смены счёта Кт · было: / })
  const before = /было: (.+?) · система/.exec((await route.getAttribute('aria-label'))!)![1]!
  await expect(dw.getByRole('img', { name: new RegExp(`^Было ${SEED_KT.was} · Кузнецов Д\\. А\\.`) })).toBeVisible()

  await dw.getByRole('button', { name: 'Отклонить правку счёта Кт' }).click()
  const prompt = dw.getByRole('alertdialog', { name: 'Отклонить правку?' })
  const ok = prompt.getByRole('button', { name: 'Отклонить' })
  const reason = prompt.getByRole('textbox', { name: 'Причина' })
  await expect(prompt).toContainText('Счёт Кт')
  await expect(prompt).toContainText('Кузнецов Д. А.')
  await expect(prompt).toContainText('0/140')
  await expect(ok).toBeDisabled()
  await reason.fill('   ')
  await expect(ok).toBeDisabled()
  // ввод с клавиатуры: maxLength браузера обрезает 141-й символ, счётчик 140/140 (Review Focus 5)
  await reason.fill('')
  await reason.pressSequentially('x'.repeat(141))
  await expect(reason).toHaveValue('x'.repeat(140))
  await expect(prompt).toContainText('140/140')
  await reason.fill('Счёт не тот')
  await expect(prompt).toContainText('11/140')
  await expect(ok).toBeEnabled()
  // F5 в поле «Причина» — браузеру (Review Focus 4)
  await reason.press('F5')
  expect(await f5(page)).toEqual([false])
  expect(await reqs(page, DECIDE)).toBe(0)
  await ok.click()

  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Правка отклонена')
  expect(await reqs(page, DECIDE)).toBe(1)
  // счёт и маршрут — как до правки; маркеры правки погасли (это была первая правка), кнопок решения нет
  const accounts = dw.locator('[data-part="hero"]').locator('..')
  await expect(accounts).toContainText(new RegExp(`Кт\\s*${SEED_KT.was}`))
  expect(digits(await dw.textContent())).not.toContain(SEED_KT.now)
  await expect(dw.getByRole('img', { name: /^Было / })).toHaveCount(0)
  await expect(route).toHaveCount(0)
  const [, kind, acc, recv] = /^(\S+) (\d+) → (\S+)$/.exec(before)!
  await expect(accounts).toContainText(new RegExp(`Маршрут\\s*${kind}\\s*Счёт\\s*${acc}\\s*→\\s*Receiver\\s*${recv}`))
  await expect(dw.getByRole('button', { name: /правку счёта Кт$/ })).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
})

test('отклонить правку поля 57: бейдж «отклонено» (контраст ≥ 4,5), «Отклонил(а) Вы, …», «Причина: Не тот банк» в истории', async ({ page }) => {
  await start(page)
  const dw = await open(page, SEED_57.n)
  const cell = dw.locator('[data-field="57"]')
  await cell.locator('> button[aria-expanded]').click()
  await expect(cell.locator('> button[aria-expanded]')).toContainText('LONDON B')
  await cell.getByRole('button', { name: 'Отклонить', exact: true }).click()
  const prompt = dw.getByRole('alertdialog', { name: 'Отклонить правку?' })
  await prompt.getByRole('textbox', { name: 'Причина' }).fill('Не тот банк')
  await prompt.getByRole('button', { name: 'Отклонить' }).click()
  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Правка отклонена')

  // значение вернулось к was отклонённой записи (первая, утверждённая правка осталась — маркер «изменено» горит)
  await expect(cell.locator('> button[aria-expanded]')).not.toContainText('LONDON B')
  await expect(cell).toHaveAttribute('data-edited', '')
  const badge = cell.getByText('отклонено', { exact: true })
  await expect(badge).toBeVisible()
  await expect(cell.getByRole('button', { name: /^(Утвердить|Отклонить)$/ })).toHaveCount(0)
  const ratio = await contrastOf(badge)
  test.info().annotations.push({ type: 'contrast', description: `«отклонено»: ${ratio.toFixed(2)}` })
  expect(ratio).toBeGreaterThanOrEqual(4.5)

  await cell.getByRole('button', { name: 'История' }).click()
  const last = cell.getByRole('list', { name: /^История изменений/ }).getByRole('listitem').last()
  await expect(last).toContainText('Причина: Не тот банк')
  await expect(last).toContainText('Полное наименование филиала')
  const tip = last.locator('[data-k-tip]')
  await expect(tip).toHaveAttribute('data-k-tip', /^Отклонил\(а\) Вы, \d{2}\.\d{2}\.\d{4}/)
  const ratioList = await contrastOf(tip.getByText('отклонено', { exact: true }))
  expect(ratioList).toBeGreaterThanOrEqual(4.5)
  await page.screenshot({ path: test.info().outputPath('reject-57.png') })
})

test('скачать: событие download, имя <номер>.txt, содержимое начинается с {1:F01; в полёте кнопка недоступна', async ({ page }) => {
  await start(page, 'slow=400')
  const dw = await open(page, 1)
  const number = /№ (\d+)/.exec((await dw.getAttribute('aria-label'))!)![1]!
  const down = dw.getByRole('button', { name: 'Скачать SWIFT-сообщение' })
  const event = page.waitForEvent('download')
  await down.click()
  await expect(down).toBeDisabled()
  const file = await event
  expect(file.suggestedFilename()).toBe(`${number}.txt`)
  const path = await file.path()
  const { readFileSync } = await import('node:fs')
  expect(readFileSync(path!, 'utf8').startsWith('{1:F01')).toBe(true)
  await expect(down).toBeEnabled()
  expect(await reqs(page, /^GET \/grids\/fx-docs\/documents\/[^/]+\/message$/)).toBe(1)
})

test('печать «Форма SWIFT»: новая вкладка «Формируется…», затем blob application/pdf с %PDF-1.4; деталка на месте', async ({ page, context }) => {
  await start(page, 'slow=600')
  const dw = await open(page, 1)
  const printBtn = dw.getByRole('button', { name: 'Печать' })
  await printBtn.click()
  const popup = context.waitForEvent('page')
  await page.getByRole('menuitem', { name: 'Форма SWIFT' }).click()
  const tab = await popup
  await expect(tab).toHaveTitle('Формируется…')
  // повторная печать, пока первая в полёте, недоступна (Review Focus 3)
  await expect(printBtn).toBeDisabled()
  // headless Chromium не показывает PDF: переход вкладки на blob: заканчивается загрузкой — ловим её адрес
  const shown = await tab.waitForEvent('download')
  const url = shown.url()
  expect(url).toMatch(/^blob:http:\/\/localhost:5186\//)
  // blob создан в странице реестра и живёт, пока жив экран — читаем его оттуда
  const pdf = await page.evaluate(async (u) => {
    const b = await (await fetch(u)).blob()
    return { type: b.type, head: (await b.text()).slice(0, 8) }
  }, url)
  expect(pdf.head).toBe('%PDF-1.4')
  expect(pdf.type).toBe('application/pdf')
  expect(context.pages()).toHaveLength(2)
  await expect(printBtn).toBeEnabled()
  await expect(dialogs(page)).toHaveCount(1)
  await tab.close()
})

test('F5 на кнопке лейна — «Обновить»: деталь перезапрошена, страница не перезагружалась; Shift+F5 и Ctrl+F5 не перехватываются', async ({ page }) => {
  await start(page)
  const dw = await open(page, 1)
  const id = await idOf(dw)
  const DETAIL = new RegExp(`^GET /grids/fx-docs/documents/${id}$`)
  const details = await reqs(page, DETAIL)
  await page.evaluate(() => { (window as unknown as { __mark: number }).__mark = 42 })
  const refresh = dw.getByRole('button', { name: 'Обновить' })
  await refresh.focus()
  await page.keyboard.press('F5')
  await expect.poll(() => reqs(page, DETAIL)).toBe(details + 1)
  expect(await f5(page)).toEqual([true])
  expect(await page.evaluate(() => (window as unknown as { __mark?: number }).__mark)).toBe(42)
  await expect(dialogs(page)).toHaveCount(1)
  await ready(page)

  await refresh.focus()
  await page.keyboard.press('Shift+F5')
  await page.keyboard.press('Control+F5')
  expect(await f5(page)).toEqual([true, false, false])
  expect(await reqs(page, DETAIL)).toBe(details + 1)
})

test('ссылка: «Скопировать ссылку» кладёт в буфер …#/fx-docs?doc=<id>; открытие адреса — в A этот документ, а не первая запись', async ({ page }) => {
  await start(page)
  // не первая запись: автооткрытие первой не должно её вытеснить (Review Focus 1)
  const dw = await open(page, 4)
  const id = await idOf(dw)
  const name = await dw.getAttribute('aria-label')
  await dw.getByRole('button', { name: 'Скопировать ссылку на документ' }).click()
  await expect.poll(() => said(page)).toContain('Ссылка скопирована')
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('?doc=')
  expect(link).toBe(`${new URL(page.url()).origin}/#/fx-docs?doc=${id}`)

  await page.goto('about:blank')
  await page.goto(link)
  await page.locator('tbody[data-key]').first().waitFor()
  const opened = await ready(page)
  await expect(opened).toHaveAttribute('aria-label', name!)
  // дольше задержки автооткрытия: первая запись не заменила документ из ссылки
  await page.waitForTimeout(800)
  await expect(dialogs(page)).toHaveCount(1)
  await expect(dialogs(page).first()).toHaveAttribute('aria-label', name!)
  expect(await page.evaluate(() => document.activeElement?.closest('[data-k-drawer]') != null)).toBe(true)
})

test('буфер недоступен: уведомление с полем только для чтения, ссылка выделена, «Скопируйте ссылку: Ctrl+C»; «Закрыть» убирает его', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('denied')) } })
  })
  await start(page)
  const dw = await open(page, 1)
  const id = await idOf(dw)
  await dw.getByRole('button', { name: 'Скопировать ссылку на документ' }).click()
  const note = dw.locator('[data-part="link-fallback"]')
  await expect(note).toHaveAttribute('role', 'status')
  const field = note.getByRole('textbox', { name: 'Ссылка на документ' })
  await expect(field).toHaveAttribute('readonly', '')
  await expect(field).toHaveValue(new RegExp(`#/fx-docs\\?doc=${id}$`))
  await expect(field).toBeFocused()
  const selected = await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd, el.value.length])
  expect(selected).toEqual([0, selected[2], selected[2]])
  await expect(note).toContainText('Скопируйте ссылку: Ctrl+C')
  await note.getByRole('button', { name: 'Закрыть' }).click()
  await expect(note).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
})
