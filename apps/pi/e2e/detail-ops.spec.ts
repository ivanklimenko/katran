import { expect, test, type Locator, type Page } from '@playwright/test'

// Срез 2e в настоящем браузере (спека 2e §4, §5): аннулирование командой (сразу, через утверждение, без изменений),
// решения второй руки по запросу, «Курс», «Проверить баланс», переотправка нотификаций, исходное сообщение, «Ручные отклонения»,
// отказы ?fail=…, контраст плашек. Фейк живёт в странице: запросы — по событию k-fake-request (app/fake/params.ts),
// объявления — журналом живой области. Свежий фейк — на каждый тест (перезагрузка страницы), итоги команд — в памяти страницы.

test.use({ viewport: { width: 1600, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] })
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear()
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

type Route = 'fx-docs' | 'rub-docs'
type Doc = { id: string; n: string }
const dialogs = (page: Page) => page.getByRole('dialog', { name: /^Платёжная инструкция/ })
const ready = async (page: Page) => {
  const dw = dialogs(page).first()
  await dw.locator('[data-part="hero"]').waitFor()
  await dw.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined))
  return dw
}
/** Документ по ссылке ?doc= (2d): сиды фейка не обязаны стоять первыми в реестре. */
async function openDoc(page: Page, doc: Doc, query = 'slow=0', route: Route = 'fx-docs') {
  await page.goto(`/?${query}#/${route}?doc=${doc.id}`)
  const dw = await ready(page)
  // номер, а не id в шапке: у рубля шапка показывает uuid документа, а не ключ реестра
  await expect(dw).toHaveAttribute('aria-label', new RegExp(`№ ${doc.n}$`))
  return dw
}
/** Регуляторы фейка читаются из location.search на каждом запросе: меняем адрес без перезагрузки (фейк и его итоги — живы). */
const setQuery = (page: Page, query: string) =>
  page.evaluate((q) => history.replaceState(null, '', `${location.pathname}?${q}${location.hash}`), query)
const reqs = (page: Page, re: RegExp) => page.evaluate((src) => (window as unknown as { __reqs: string[] }).__reqs.filter((r) => new RegExp(src).test(r)).length, re.source)
const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said.slice())
/** Два кадра отрисовки: всё, что модель уже решила, React успел показать. */
const frames = (page: Page) => page.evaluate(() => new Promise<void>((done) => { requestAnimationFrame(() => { requestAnimationFrame(() => { done() }) }) }))
const focusInDrawer = (page: Page) => page.evaluate(() => document.activeElement?.closest('[data-k-drawer]') != null)

/** Контраст текста элемента к его фактическому фону (WCAG 2.x) — тот же помощник, что в lane-actions.spec.ts. */
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

/** Выбрать вкладку: видимую — кликом, из переполнения — через «Ещё вкладки: N» (как detail-tabs.spec.ts). */
async function pickTab(page: Page, dw: Locator, name: string) {
  const tab = dw.getByRole('tab', { name, exact: true })
  if (await tab.count() > 0) await tab.click()
  else {
    await dw.getByRole('button', { name: /^Ещё вкладки: \d+$/ }).click()
    await page.getByRole('menu', { name: 'Вкладки' }).getByRole('menuitem', { name: new RegExp(`^${name}`) }).click()
  }
  await expect(dw.locator('[data-part="tab-skeleton"]')).toHaveCount(0)
  await expect(dw.getByRole('tabpanel')).not.toBeEmpty()
  return dw.getByRole('tabpanel')
}

// Сиды фейка (Task 3): id и номера
const DOC = {
  /** IN_PROGRESS «В работе», 182 971,90 RUB — можно аннулировать, сумма ≤ 1 000 000 */
  inWork: { id: '0f3c0010-7b1d-4c8e-9f0a-442160848062', n: '675566' },
  /** чужой pending (Кузнецов Д. А., canConfirm), IN_PROGRESS; у него же в проводках счёт с ошибкой */
  pending: { id: '0f3c0003-7b1d-4c8e-9f0a-990759702166', n: '650463' },
  /** уже аннулирован (done): запрос Ивановой М. П., утвердила Смирнова Е. В. */
  done: { id: '0f3c0004-7b1d-4c8e-9f0a-345544357551', n: '772890' },
  /** рубль, чужой pending */
  rubPending: { id: 'rub-0001', n: '2903' },
  /** DEFERRED, сумма ≤ 1 000 000 */
  small: { id: '0f3c0009-7b1d-4c8e-9f0a-960920942481', n: '736146' },
  /** ERROR, сумма > 1 000 000 — через утверждение без регулятора */
  big: { id: '0f3c0005-7b1d-4c8e-9f0a-897088053636', n: '164275' },
  /** заблокирован (Кузнецов Д. А.) */
  locked: { id: '0f3c0046-7b1d-4c8e-9f0a-340938471024', n: '21177' },
  /** DONE «Обработан» без блокировки */
  processed: { id: '0f3c0025-7b1d-4c8e-9f0a-313118799589', n: '439022' },
  /** MT199 «В обработке»: вкладка «Задачи» есть (у MT199 нет 32A — «Курса» нет, хотя поле 36 в сиде задано) */
  mt199: { id: '0f3c0000-7b1d-4c8e-9f0a-863882762612', n: '199706' },
  /** MT103 EUR с полем 36 (курс 1,0886): «Курс» с курсом сделки (индекс сида кратен 4) */
  deal: { id: '0f3c0008-7b1d-4c8e-9f0a-104979518335', n: '383537' },
  /** сид правки поля 57 (2d), TO_EXPORT — можно аннулировать; редактор поля — блок под сеткой */
  edit57: { id: '0f3c0001-7b1d-4c8e-9f0a-286655677016', n: '151804' },
  /** нотификации валюты n1–n3 (n3 — text/plain) */
  notif: { id: '0f3c0002-7b1d-4c8e-9f0a-523271542973', n: '811306' },
  /** нотификации рубля (XML) */
  rubNotif: { id: 'rub-0000', n: '2900' },
}
const BAD_ACC = '70601840100000000519'

const ANNUL = /^POST \/grids\/[^/]+\/documents\/[^/]+\/annul$/
const DECIDE = /^POST \/grids\/[^/]+\/documents\/[^/]+\/annul\/(confirm|reject)$/
const RATES = /^GET \/grids\/fx-docs\/documents\/[^/]+\/rates$/
const BALANCES = /^GET \/grids\/[^/]+\/documents\/[^/]+\/balances$/
const RESEND = /^POST \/grids\/[^/]+\/documents\/[^/]+\/notifications\/(?:[^/]+\/)?resend$/
const MESSAGE = /^GET \/grids\/[^/]+\/documents\/[^/]+\/notifications\/[^/]+\/message$/
/** «{кто}, дд.мм.гггг чч:мм» — время без секунд, как в истории правок 2d. */
const AT = '\\d{2}\\.\\d{2}\\.\\d{4} \\d{2}:\\d{2}'

const annulBtn = (dw: Locator) => dw.getByRole('group', { name: 'Действия с документом' }).getByRole('button', { name: 'Аннулировать' })
const lane = (dw: Locator) => dw.locator('[data-part="lane"]')
const banner = (dw: Locator) => dw.locator('[data-part="annul-banner"]')
const bannerText = (dw: Locator) => banner(dw).getByRole('status')
const pencils = (dw: Locator) => dw.getByRole('button', { name: /^(Редактировать поле|Изменить|Вернуть исходное)/ })

/** «Аннулировать» → Prompt «Аннулировать документ?» с причиной → ответ; Prompt закрыт. */
async function annul(dw: Locator, reason: string) {
  await annulBtn(dw).click()
  const prompt = dw.getByRole('alertdialog', { name: 'Аннулировать документ?' })
  await prompt.getByRole('textbox', { name: 'Причина' }).fill(reason)
  await prompt.getByRole('button', { name: 'Аннулировать' }).click()
  await expect(prompt).toHaveCount(0)
}

// --- аннулирование ---

test('?annul=instant: Prompt «Аннулировать документ?» (№ и сумма, «Причина» 0/140, «Аннулировать» недоступна без причины; Esc — только Prompt); итог — плашка «Документ аннулирован», статус «Отказ», кнопка aria-disabled с подсказкой, карандашей нет', async ({ page }) => {
  const dw = await openDoc(page, DOC.inWork, 'slow=0&annul=instant')
  await expect(lane(dw)).toContainText('В работе')
  expect(await pencils(dw).count()).toBeGreaterThan(0)
  const btn = annulBtn(dw)
  await expect(btn).not.toHaveAttribute('aria-disabled')

  // Esc в Prompt закрывает только Prompt: деталь открыта, фокус — на «Аннулировать» (Review Focus 5)
  await btn.click()
  const prompt = dw.getByRole('alertdialog', { name: 'Аннулировать документ?' })
  await expect(prompt).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(prompt).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
  await expect(btn).toBeFocused()

  await btn.click()
  await expect(prompt).toContainText(`№ ${DOC.inWork.n}`)
  await expect(prompt).toContainText('RUB')
  const ok = prompt.getByRole('button', { name: 'Аннулировать' })
  const reason = prompt.getByRole('textbox', { name: 'Причина' })
  // поле «Причина» не сломано: видимо, разумного размера, счётчик «0/140» виден под полем и не налезает на него
  await expect(reason).toBeVisible()
  const counter = prompt.getByText('0/140', { exact: true })
  await expect(counter).toBeVisible()
  const [rb, cb, pb] = [(await reason.boundingBox())!, (await counter.boundingBox())!, (await prompt.boundingBox())!]
  expect(rb.width).toBeGreaterThan(200)
  expect(rb.height).toBeGreaterThanOrEqual(30)
  expect(cb.y).toBeGreaterThanOrEqual(rb.y + rb.height - 1)
  expect(cb.y + cb.height).toBeLessThanOrEqual(pb.y + pb.height)
  await page.screenshot({ path: test.info().outputPath('annul-prompt.png') })
  await expect(ok).toBeDisabled()
  await reason.fill('   ')
  await expect(ok).toBeDisabled()
  await reason.fill('Ошибочный документ')
  await expect(prompt).toContainText('18/140')
  await ok.click()

  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Документ аннулирован')
  expect(await reqs(page, ANNUL)).toBe(1)
  await expect(bannerText(dw)).toHaveText(new RegExp(`^Документ аннулирован · Вы, ${AT} · Причина: Ошибочный документ$`))
  await expect(banner(dw).locator('[data-tone]')).toHaveAttribute('data-tone', 'bad')
  await expect(lane(dw)).toContainText('Отказ')
  await expect(btn).toHaveAttribute('aria-disabled', 'true')
  await expect(btn).toHaveAttribute('data-k-tip', 'Документ аннулирован')
  await expect(pencils(dw)).toHaveCount(0)
  // фокус не потерян в body: остался в drawer
  expect(await focusInDrawer(page)).toBe(true)
  await expect(dialogs(page)).toHaveCount(1)
})

test('?annul=fail: команда принята, документ не изменился — «Команда отправлена — документ пока в статусе «В работе»», статус прежний, плашки нет, кнопка снова доступна', async ({ page }) => {
  const dw = await openDoc(page, DOC.inWork, 'slow=0&annul=fail')
  await annul(dw, 'Ошибочный документ')
  await expect.poll(() => said(page)).toContain('Команда отправлена — документ пока в статусе «В работе»')
  expect(await reqs(page, ANNUL)).toBe(1)
  await expect(lane(dw)).toContainText('В работе')
  await expect(banner(dw)).toHaveCount(0)
  const btn = annulBtn(dw)
  await expect(btn).not.toHaveAttribute('aria-disabled')
  await expect(btn).toHaveAttribute('data-k-tip', 'Аннулировать')
  await expect(dialogs(page)).toHaveCount(1)
})

test('через ожидание: ?annul=pending — плашка warn «ожидает утверждения · Вы, …» без кнопок решения; без регулятора сумма > 1 000 000 — так же', async ({ page }) => {
  let dw = await openDoc(page, DOC.small, 'slow=0&annul=pending')
  await annul(dw, 'Дубликат')
  await expect.poll(() => said(page)).toContain('Запрос на аннулирование отправлен на утверждение')
  await expect(bannerText(dw)).toHaveText(new RegExp(`^Аннулирование ожидает утверждения · Вы, ${AT} · Причина: Дубликат$`))
  await expect(banner(dw).locator('[data-tone]')).toHaveAttribute('data-tone', 'warn')
  await expect(banner(dw).getByRole('button')).toHaveCount(0)
  await expect(lane(dw)).toContainText('Отложенный')
  await expect(annulBtn(dw)).toHaveAttribute('aria-disabled', 'true')
  await expect(annulBtn(dw)).toHaveAttribute('data-k-tip', 'Запрос на аннулирование ожидает утверждения')

  // правило фейка без регулятора: сумма 32A > 1 000 000 — через утверждение
  dw = await openDoc(page, DOC.big)
  await annul(dw, 'Дубликат')
  await expect.poll(() => said(page)).toContain('Запрос на аннулирование отправлен на утверждение')
  await expect(bannerText(dw)).toHaveText(/^Аннулирование ожидает утверждения · Вы, /)
  await expect(lane(dw)).toContainText('Ошибка')
})

test('вторая рука: сидовый запрос Кузнецова Д. А. — «Утвердить» → Prompt «Утвердить аннулирование?» (автор, время, причина) → плашка done, «Аннулирование утверждено», статус «Отказ», фокус в drawer', async ({ page }) => {
  const dw = await openDoc(page, DOC.pending)
  await expect(bannerText(dw)).toHaveText(new RegExp(`^Аннулирование ожидает утверждения · Кузнецов Д\\. А\\., ${AT} · Причина: Дубликат платежа$`))
  await expect(annulBtn(dw)).toHaveAttribute('data-k-tip', 'Запрос на аннулирование ожидает утверждения')
  await banner(dw).getByRole('button', { name: 'Утвердить' }).click()
  const prompt = dw.getByRole('alertdialog', { name: 'Утвердить аннулирование?' })
  await expect(prompt).toContainText('Кузнецов Д. А.')
  await expect(prompt).toContainText('Причина: Дубликат платежа')
  await expect(prompt.getByRole('textbox')).toHaveCount(0)
  await prompt.getByRole('button', { name: 'Утвердить' }).click()

  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Аннулирование утверждено')
  expect(await reqs(page, DECIDE)).toBe(1)
  await expect(bannerText(dw)).toHaveText(new RegExp(`^Документ аннулирован · Вы, ${AT} · Причина: Дубликат платежа$`))
  await expect(banner(dw).locator('[data-tone]')).toHaveAttribute('data-tone', 'bad')
  await expect(lane(dw)).toContainText('Отказ')
  await expect(annulBtn(dw)).toHaveAttribute('data-k-tip', 'Документ аннулирован')
  // кнопки плашки пропали — фокус на заголовке drawer, не в body
  expect(await focusInDrawer(page)).toBe(true)
  await expect(dialogs(page)).toHaveCount(1)
})

test('отклонение сидового запроса с причиной: плашка «Запрос на аннулирование отклонён · Вы, … · {причина}», «Закрыть» прячет; закрыть и открыть деталку — снова видна', async ({ page }) => {
  let dw = await openDoc(page, DOC.pending)
  await banner(dw).getByRole('button', { name: 'Отклонить' }).click()
  const prompt = dw.getByRole('alertdialog', { name: 'Отклонить аннулирование?' })
  const ok = prompt.getByRole('button', { name: 'Отклонить' })
  await expect(prompt).toContainText('0/140')
  await expect(ok).toBeDisabled()
  await prompt.getByRole('textbox', { name: 'Причина' }).fill('Платёж нужен')
  await ok.click()

  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Аннулирование отклонено')
  const text = new RegExp(`^Запрос на аннулирование отклонён · Вы, ${AT} · Платёж нужен$`)
  await expect(bannerText(dw)).toHaveText(text)
  await expect(banner(dw).locator('[data-tone]')).toHaveAttribute('data-tone', 'neutral')
  // отклонённый запрос — документ снова можно аннулировать, статус прежний
  await expect(lane(dw)).toContainText('В работе')
  await expect(annulBtn(dw)).not.toHaveAttribute('aria-disabled')
  await banner(dw).getByRole('button', { name: 'Закрыть' }).click()
  await expect(banner(dw)).toHaveCount(0)
  expect(await focusInDrawer(page)).toBe(true)

  // закрыть деталку и открыть снова из реестра (без перезагрузки: итог отклонения — в памяти фейка страницы)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(0)
  await page.locator('tbody[data-key]', { hasText: DOC.pending.n }).first().locator('[data-k-open]').click()
  dw = await ready(page)
  await expect(dw.getByRole('button', { name: DOC.pending.id, exact: true })).toBeVisible()
  await expect(bannerText(dw)).toHaveText(text)
})

test('недоступная «Аннулировать»: DONE — «Аннулирование недоступно для документа в статусе «Обработан»»; заблокирован — «Документ заблокирован: Кузнецов Д. А.»; уже аннулирован — «Документ аннулирован» и плашка bad', async ({ page }) => {
  let dw = await openDoc(page, DOC.processed)
  await expect(annulBtn(dw)).toHaveAttribute('aria-disabled', 'true')
  await expect(annulBtn(dw)).toHaveAttribute('data-k-tip', 'Аннулирование недоступно для документа в статусе «Обработан»')
  // клик по недоступной — без Prompt и без запроса
  await annulBtn(dw).click({ force: true })
  await frames(page)
  await expect(dw.getByRole('alertdialog')).toHaveCount(0)
  await expect(banner(dw)).toHaveCount(0)

  dw = await openDoc(page, DOC.locked)
  await expect(annulBtn(dw)).toHaveAttribute('aria-disabled', 'true')
  await expect(annulBtn(dw)).toHaveAttribute('data-k-tip', 'Документ заблокирован: Кузнецов Д. А.')

  dw = await openDoc(page, DOC.done)
  await expect(annulBtn(dw)).toHaveAttribute('data-k-tip', 'Документ аннулирован')
  await expect(bannerText(dw)).toHaveText(new RegExp(`^Документ аннулирован · Смирнова Е\\. В\\., ${AT} · Причина: Ошибочный документ$`))
  expect(await reqs(page, ANNUL)).toBe(0)
})

test('блокировка: открыт редактор — «Аннулировать» недоступна с подсказкой «Завершите текущую операцию с документом»; редактор закрыт — снова доступна', async ({ page }) => {
  // редактор поля 57 (блок под сеткой): клик по недоступной кнопке Prompt не открывает, редактор остаётся
  let dw = await openDoc(page, DOC.edit57)
  let btn = annulBtn(dw)
  await expect(btn).not.toHaveAttribute('aria-disabled')
  await dw.getByRole('button', { name: 'Редактировать поле 57' }).click()
  const editor = dw.getByRole('region', { name: /^Поле 57 · .+ — правка$/ })
  await expect(editor).toBeVisible()
  await expect(btn).toHaveAttribute('aria-disabled', 'true')
  await expect(btn).toHaveAttribute('data-k-tip', 'Завершите текущую операцию с документом')
  await btn.click({ force: true })
  await frames(page)
  await expect(dw.getByRole('alertdialog')).toHaveCount(0)
  await expect(editor).toBeVisible()
  await editor.getByRole('button', { name: 'Отмена' }).click()
  await expect(editor).toHaveCount(0)
  await expect(btn).not.toHaveAttribute('aria-disabled')

  // правка 20 исх на месте: та же подсказка; Esc закрывает правку, не деталку — кнопка снова доступна
  dw = await openDoc(page, DOC.inWork)
  btn = annulBtn(dw)
  await dw.getByRole('button', { name: 'Изменить 20 исх' }).click()
  await expect(dw.getByRole('textbox', { name: '20 исх' })).toBeFocused()
  await expect(btn).toHaveAttribute('aria-disabled', 'true')
  await expect(btn).toHaveAttribute('data-k-tip', 'Завершите текущую операцию с документом')
  await page.keyboard.press('Escape')
  await expect(dw.getByRole('textbox', { name: '20 исх' })).toHaveCount(0)
  await expect(btn).not.toHaveAttribute('aria-disabled')
  await expect(dialogs(page)).toHaveCount(1)
})

// --- справочные запросы ---

test('«Курс»: три строки (ЦБ, рублёвый эквивалент, сделка по полю 36 — 1,0886), Esc закрывает поповер, деталь открыта, фокус на «Курс»; повторное открытие — из кэша', async ({ page }) => {
  const dw = await openDoc(page, DOC.deal)
  const link = dw.getByRole('button', { name: 'Курс', exact: true })
  await link.click()
  const pop = page.getByRole('dialog', { name: 'Курс', exact: true })
  const lines = pop.locator('p')
  await expect(lines).toHaveCount(3)
  await expect(lines.nth(0)).toHaveText(/^Курс ЦБ на \d{2}\.\d{2}\.\d{4} — [\d\s,]+ RUB за 1 EUR$/)
  await expect(lines.nth(1)).toHaveText(/^Рублёвый эквивалент — [\d\s,]+ RUB$/)
  await expect(lines.nth(2)).toHaveText(/^Курс сделки [A-Z]{3}→[A-Z]{3} — 1,0886 · списано [\d\s,]+ [A-Z]{3}$/)
  expect(await reqs(page, RATES)).toBe(1)
  await page.keyboard.press('Escape')
  await expect(pop).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
  await expect(link).toBeFocused()
  await link.click()
  await expect(lines).toHaveCount(3)
  expect(await reqs(page, RATES)).toBe(1)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(1)
})

for (const [route, doc] of [['fx-docs', DOC.pending], ['rub-docs', DOC.rubPending]] as const) {
  test(`«Проверить баланс» (${route}): таблица «Счёт · Валюта · Остаток · Доступно», «по состоянию на», «Обновить» — новый запрос; Esc — только поповер, фокус на ссылке`, async ({ page }) => {
    const dw = await openDoc(page, doc, 'slow=0', route)
    const link = dw.getByRole('button', { name: 'Проверить баланс' })
    const toggles = () => dw.locator('button[aria-expanded]').evaluateAll((els) => els.filter((e) => e.textContent !== 'Проверить баланс').map((e) => e.getAttribute('aria-expanded')))
    const expanded = await toggles()
    await link.click()
    const pop = page.getByRole('dialog', { name: 'Проверить баланс' })
    const table = pop.getByRole('table')
    await expect(table.getByRole('columnheader')).toHaveText(['Счёт', 'Валюта', 'Остаток', 'Доступно'])
    expect(await table.locator('tbody tr').count()).toBeGreaterThan(0)
    if (route === 'fx-docs') {
      // строка счёта с ошибкой — текст на всю ширину строки
      const bad = table.getByRole('row', { name: new RegExp(BAD_ACC) })
      await expect(bad.getByRole('cell')).toHaveText(['Счёт не найден в АБС'])
      await expect(bad.getByRole('cell')).toHaveAttribute('colspan', '3')
    }
    await expect(pop).toContainText(/по состоянию на \d{2}\.\d{2}\.\d{4}/)
    // клик по ссылке блок не сворачивает и не разворачивает: все aria-expanded drawer, кроме самой ссылки, прежние
    expect(await toggles()).toEqual(expanded)
    expect(await reqs(page, BALANCES)).toBe(1)
    await pop.getByRole('button', { name: 'Обновить' }).click()
    await expect.poll(() => reqs(page, BALANCES)).toBe(2)
    await expect(table).toBeVisible()
    await expect(pop.getByRole('button', { name: 'Обновить' })).not.toHaveAttribute('aria-busy')
    await page.keyboard.press('Escape')
    await expect(pop).toHaveCount(0)
    await expect(dialogs(page)).toHaveCount(1)
    await expect(link).toBeFocused()
  })
}

test('Tab из поповеров «Курс» (без остановок) и «Проверить баланс» (с «Обновить»): поповер закрыт, фокус в деталке сразу за ссылкой (Shift+Tab — на ссылке), деталь открыта; Esc — уже деталке', async ({ page }) => {
  const dw = await openDoc(page, DOC.deal)
  const inDrawer = () => dw.evaluate((el) => el.contains(document.activeElement))
  const rates = dw.getByRole('button', { name: 'Курс', exact: true })
  await rates.click()
  const ratesPop = page.getByRole('dialog', { name: 'Курс', exact: true })
  await expect(ratesPop.locator('p')).toHaveCount(3)
  // фокус — на теле поповера (кнопок нет): Tab с него — за край
  await page.keyboard.press('Tab')
  await expect(ratesPop).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
  expect(await inDrawer()).toBe(true)
  await page.keyboard.press('Shift+Tab')
  await expect(rates).toBeFocused()
  // «Проверить баланс»: Tab с тела — к «Обновить», Tab с «Обновить» (последней) — за край; Shift+Tab с «Обновить» — тоже
  const bal = dw.getByRole('button', { name: 'Проверить баланс' })
  const balPop = page.getByRole('dialog', { name: 'Проверить баланс' })
  for (const back of [false, true]) {
    await bal.click()
    await expect(balPop.getByRole('table')).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(balPop.getByRole('button', { name: 'Обновить' })).toBeFocused()
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab')
    await expect(balPop).toHaveCount(0)
    await expect(dialogs(page)).toHaveCount(1)
    expect(await inDrawer()).toBe(true)
    await page.keyboard.press(back ? 'Tab' : 'Shift+Tab')
    await expect(bal).toBeFocused()
  }
  // поповера не осталось — Esc закрывает деталь, как без поповера (дефект: открытый поповер с фокусом за страницей)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: /Курс|Проверить баланс/ })).toHaveCount(0)
})

// --- нотификации ---

const rowsOf = (panel: Locator) => panel.getByRole('button', { name: /^Исходное сообщение, отправка \d+$/ })

test('переотправка всех: «Переотправить все» → «Переотправить все нотификации?» → новые строки, «Нотификация переотправлена»', async ({ page }) => {
  const dw = await openDoc(page, DOC.notif)
  const panel = await pickTab(page, dw, 'Нотификации')
  const before = await rowsOf(panel).count()
  expect(before).toBeGreaterThan(1)
  await panel.getByRole('button', { name: 'Переотправить все' }).click()
  const prompt = page.getByRole('alertdialog', { name: 'Переотправить все нотификации?' })
  await expect(prompt).toContainText('Будет создана новая попытка отправки')
  await prompt.getByRole('button', { name: 'Переотправить' }).click()
  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Нотификация переотправлена')
  await expect.poll(() => rowsOf(panel).count()).toBeGreaterThan(before)
  expect(await reqs(page, RESEND)).toBe(1)
  await expect(dialogs(page)).toHaveCount(1)
})

// другой документ, а не вторая переотправка того же: окно 409 фейка — 2 с (RESEND_WINDOW_MS), без пауз в тесте
test('переотправка одной (рубль): «Переотправить» в строке 2 → «Переотправить нотификацию № 2?» → строк на одну больше, фокус в drawer', async ({ page }) => {
  const dw = await openDoc(page, DOC.rubNotif, 'slow=0', 'rub-docs')
  const panel = await pickTab(page, dw, 'Нотификации')
  const before = await rowsOf(panel).count()
  const one = panel.getByRole('button', { name: 'Переотправить, отправка 2' })
  await one.click()
  const prompt = page.getByRole('alertdialog', { name: 'Переотправить нотификацию № 2?' })
  await expect(prompt).toContainText('Будет создана новая попытка отправки')
  await prompt.getByRole('button', { name: 'Переотправить' }).click()
  await expect(prompt).toHaveCount(0)
  await expect(rowsOf(panel)).toHaveCount(before + 1)
  await expect.poll(() => said(page)).toContain('Нотификация переотправлена')
  expect(await reqs(page, RESEND)).toBe(1)
  await expect(one).toBeFocused()
  await expect(dialogs(page)).toHaveCount(1)
})

test('исходное сообщение: окно с подсветкой JSON (CodeView), n3 — простой текст; Esc закрывает окно, деталь открыта, фокус на ссылке строки', async ({ page }) => {
  const dw = await openDoc(page, DOC.notif)
  const panel = await pickTab(page, dw, 'Нотификации')
  const link = panel.getByRole('button', { name: 'Исходное сообщение, отправка 1' })
  await link.click()
  const win = page.getByRole('dialog', { name: 'Исходное сообщение · отправка 1' })
  const code = win.getByRole('region', { name: 'Тело сообщения' })
  await expect(code).toHaveAttribute('data-lang', 'json')
  await expect(code).toContainText('"docId"')
  // подсветка: токены — отдельные span с видом в data-tok
  expect(await code.locator('span[data-tok]').count()).toBeGreaterThan(0)
  expect(await reqs(page, MESSAGE)).toBe(1)
  await page.screenshot({ path: test.info().outputPath('message-json.png') })
  await page.keyboard.press('Escape')
  await expect(win).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
  await expect(link).toBeFocused()

  // n3 — text/plain: без подсветки; «Закрыть» — то же
  const link3 = panel.getByRole('button', { name: 'Исходное сообщение, отправка 3' })
  await link3.click()
  const win3 = page.getByRole('dialog', { name: 'Исходное сообщение · отправка 3' })
  const code3 = win3.getByRole('region', { name: 'Тело сообщения' })
  await expect(code3).toHaveAttribute('data-lang', 'text')
  await expect(code3).toContainText('Нотификация n3')
  await win3.getByRole('button', { name: 'Закрыть' }).click()
  await expect(win3).toHaveCount(0)
  await expect(link3).toBeFocused()
  await expect(dialogs(page)).toHaveCount(1)
})

test('исходное сообщение рубля — XML с подсветкой', async ({ page }) => {
  const dw = await openDoc(page, DOC.rubNotif, 'slow=0', 'rub-docs')
  const panel = await pickTab(page, dw, 'Нотификации')
  await panel.getByRole('button', { name: 'Исходное сообщение, отправка 1' }).click()
  const code = page.getByRole('dialog', { name: 'Исходное сообщение · отправка 1' }).getByRole('region', { name: 'Тело сообщения' })
  await expect(code).toHaveAttribute('data-lang', 'xml')
  await expect(code).toContainText('Notification')
  expect(await code.locator('span[data-tok]').count()).toBeGreaterThan(0)
  await page.keyboard.press('Escape')
  await expect(dialogs(page)).toHaveCount(1)
})

test('окно «Исходное сообщение» не выше слоя: при высоте окна браузера 500 px окно и кнопки футера в пределах вьюпорта, тело прокручивается', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 500 })
  const dw = await openDoc(page, DOC.notif)
  const panel = await pickTab(page, dw, 'Нотификации')
  await panel.getByRole('button', { name: 'Исходное сообщение, отправка 1' }).click()
  const win = page.getByRole('dialog', { name: 'Исходное сообщение · отправка 1' })
  await expect(win.getByRole('region', { name: 'Тело сообщения' })).toBeVisible()
  await win.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)).then(() => undefined))
  const box = (await win.boundingBox())!
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height).toBeLessThanOrEqual(500)
  for (const name of ['Скопировать', 'Закрыть']) {
    const b = (await win.getByRole('button', { name }).boundingBox())!
    expect(b.y + b.height, name).toBeLessThanOrEqual(500)
  }
  await page.screenshot({ path: test.info().outputPath('message-500.png') })
  // сообщения сида короткие: при 500 px тело помещается; при 260 px — окно по-прежнему в пределах вьюпорта, тело прокручивается
  await page.setViewportSize({ width: 1600, height: 260 })
  await frames(page)
  const small = (await win.boundingBox())!
  expect(small.y).toBeGreaterThanOrEqual(0)
  expect(small.y + small.height).toBeLessThanOrEqual(260)
  for (const name of ['Скопировать', 'Закрыть']) {
    const b = (await win.getByRole('button', { name }).boundingBox())!
    expect(b.y + b.height, name).toBeLessThanOrEqual(260)
  }
  await page.screenshot({ path: test.info().outputPath('message-260.png') })
  const scroll = await win.evaluate((el) => {
    const all = [el, ...el.querySelectorAll('*')] as HTMLElement[]
    const s = all.find((n) => n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY))
    return s ? { sh: s.scrollHeight, ch: s.clientHeight } : null
  })
  expect(scroll).not.toBeNull()
  expect(scroll!.sh).toBeGreaterThan(scroll!.ch)
})

test('«Ручные отклонения»: без ссылки хоста — aria-disabled с подсказкой; ?hostlinks=1 — новая вкладка …#/manual-deviations?doc=<id>, деталка на месте', async ({ page, context }) => {
  let dw = await openDoc(page, DOC.mt199)
  let panel = await pickTab(page, dw, 'Задачи')
  const off = panel.getByRole('button', { name: 'Перейти в блок «Ручные отклонения»' })
  await expect(off).toHaveAttribute('aria-disabled', 'true')
  await expect(off).toHaveAttribute('data-k-tip', 'Переход не настроен для этого стенда')
  await off.click({ force: true })
  await frames(page)
  expect(context.pages()).toHaveLength(1)

  dw = await openDoc(page, DOC.mt199, 'slow=0&hostlinks=1')
  panel = await pickTab(page, dw, 'Задачи')
  const link = panel.getByRole('link', { name: 'Перейти в блок «Ручные отклонения»' })
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(link).toHaveAttribute('rel', 'noopener')
  const popup = context.waitForEvent('page')
  await link.click()
  const tab = await popup
  await tab.waitForLoadState('domcontentloaded')
  expect(tab.url()).toContain(`manual-deviations?doc=${DOC.mt199.id}`)
  await expect(dialogs(page)).toHaveCount(1)
  await tab.close()
})

// --- отказы ---

test('?fail=annul: текст ошибки в Prompt, Prompt открыт; повтор после снятия регулятора — аннулирован', async ({ page }) => {
  const dw = await openDoc(page, DOC.inWork, 'slow=0&fail=annul')
  await annulBtn(dw).click()
  const prompt = dw.getByRole('alertdialog', { name: 'Аннулировать документ?' })
  await prompt.getByRole('textbox', { name: 'Причина' }).fill('Ошибочный документ')
  const ok = prompt.getByRole('button', { name: 'Аннулировать' })
  await ok.click()
  await expect(prompt).toContainText('Регулятор ?fail=annul')
  await expect(ok).toBeEnabled()
  await expect(dialogs(page)).toHaveCount(1)
  await setQuery(page, 'slow=0')
  await ok.click()
  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Документ аннулирован')
  expect(await reqs(page, ANNUL)).toBe(2)
})

test('?fail=annul на решении: «Утвердить» — текст ошибки в Prompt, повтор доступен', async ({ page }) => {
  const dw = await openDoc(page, DOC.pending, 'slow=0&fail=annul')
  await banner(dw).getByRole('button', { name: 'Утвердить' }).click()
  const prompt = dw.getByRole('alertdialog', { name: 'Утвердить аннулирование?' })
  const ok = prompt.getByRole('button', { name: 'Утвердить' })
  await ok.click()
  await expect(prompt).toContainText('Регулятор ?fail=annul')
  await expect(ok).toBeEnabled()
  await setQuery(page, 'slow=0')
  await ok.click()
  await expect(prompt).toHaveCount(0)
  await expect.poll(() => said(page)).toContain('Аннулирование утверждено')
})

for (const [kind, label] of [['rates', 'Курс'], ['balances', 'Проверить баланс']] as const) {
  test(`?fail=${kind}: в поповере «${label}» текст ошибки и «Повторить»; повтор после снятия регулятора — данные`, async ({ page }) => {
    const dw = await openDoc(page, kind === 'rates' ? DOC.deal : DOC.pending, `slow=0&fail=${kind}`)
    await dw.getByRole('button', { name: label, exact: true }).click()
    const pop = page.getByRole('dialog', { name: label, exact: true })
    await expect(pop.getByRole('alert')).toHaveText(`Регулятор ?fail=${kind}`)
    const retry = pop.getByRole('button', { name: 'Повторить' })
    await expect(retry).toBeVisible()
    await setQuery(page, 'slow=0')
    await retry.click()
    await expect(pop.getByRole('alert')).toHaveCount(0)
    await expect(kind === 'rates' ? pop.locator('p').first() : pop.getByRole('table')).toBeVisible()
    // «Повторить» пропал — фокус в поповере (его содержимом), не в body
    expect(await pop.evaluate((el) => el.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Escape')
    await expect(dialogs(page)).toHaveCount(1)
  })
}

test('?fail=balances на «Обновить»: старая таблица видна, под ней ошибка и «Повторить»', async ({ page }) => {
  const dw = await openDoc(page, DOC.pending)
  await dw.getByRole('button', { name: 'Проверить баланс' }).click()
  const pop = page.getByRole('dialog', { name: 'Проверить баланс' })
  await expect(pop.getByRole('table')).toBeVisible()
  await setQuery(page, 'slow=0&fail=balances')
  await pop.getByRole('button', { name: 'Обновить' }).click()
  await expect(pop.getByRole('alert')).toHaveText('Регулятор ?fail=balances')
  await expect(pop.getByRole('table')).toBeVisible()
  await setQuery(page, 'slow=0')
  await pop.getByRole('button', { name: 'Повторить' }).click()
  await expect(pop.getByRole('alert')).toHaveCount(0)
  await expect(pop.getByRole('table')).toBeVisible()
})

test('?fail=resend: объявление текста ошибки, строк не прибавилось, кнопки снова доступны; повтор после снятия регулятора — новая строка', async ({ page }) => {
  const dw = await openDoc(page, DOC.notif, 'slow=0&fail=resend')
  const panel = await pickTab(page, dw, 'Нотификации')
  const before = await rowsOf(panel).count()
  const one = panel.getByRole('button', { name: 'Переотправить, отправка 1' })
  await one.click()
  await page.getByRole('alertdialog', { name: 'Переотправить нотификацию № 1?' }).getByRole('button', { name: 'Переотправить' }).click()
  await expect.poll(() => said(page)).toContain('Регулятор ?fail=resend')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(one).not.toHaveAttribute('aria-disabled')
  await expect(panel.getByRole('button', { name: 'Переотправить все' })).not.toHaveAttribute('aria-disabled')
  await expect(rowsOf(panel)).toHaveCount(before)
  await setQuery(page, 'slow=0')
  await one.click()
  await page.getByRole('alertdialog', { name: 'Переотправить нотификацию № 1?' }).getByRole('button', { name: 'Переотправить' }).click()
  await expect(rowsOf(panel)).toHaveCount(before + 1)
  await expect.poll(() => said(page)).toContain('Нотификация переотправлена')
})

test('?fail=notifmsg: в окне сообщения текст ошибки и «Повторить»; повтор после снятия регулятора — тело', async ({ page }) => {
  const dw = await openDoc(page, DOC.notif, 'slow=0&fail=notifmsg')
  const panel = await pickTab(page, dw, 'Нотификации')
  await panel.getByRole('button', { name: 'Исходное сообщение, отправка 1' }).click()
  const win = page.getByRole('dialog', { name: 'Исходное сообщение · отправка 1' })
  await expect(win.getByRole('alert')).toHaveText('Регулятор ?fail=notifmsg')
  await expect(win.getByRole('button', { name: 'Скопировать' })).toBeDisabled()
  await setQuery(page, 'slow=0')
  await win.getByRole('button', { name: 'Повторить' }).click()
  await expect(win.getByRole('region', { name: 'Тело сообщения' })).toBeVisible()
  await expect(win.getByRole('alert')).toHaveCount(0)
  // фокус не ушёл из окна: Esc закрывает окно, а не деталку
  await page.keyboard.press('Escape')
  await expect(win).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(1)
})

// --- слои и контраст ---

test('слои: в B открыт поповер «Проверить баланс», фокус — на «Исходное сообщение» в A (не Tab с края поповера) и Enter: окно поверх, поповер не остаётся над подложкой окна', async ({ page }) => {
  // A — документ с нотификациями (вкладка «Нотификации»), B — документ с проводками (поповер в «Общих данных»)
  await pickTab(page, await openDoc(page, DOC.notif), 'Нотификации')
  // после открытия B первым в DOM станет B — A по имени
  const a = page.getByRole('dialog', { name: new RegExp(`№ ${DOC.notif.n}$`) })
  await page.locator('tbody[data-key]', { hasText: DOC.pending.n }).first().locator('[data-k-open]').dblclick()
  await expect(dialogs(page)).toHaveCount(2)
  const b = dialogs(page).nth(0)
  await expect(b).toHaveAttribute('aria-label', new RegExp(`№ ${DOC.pending.n}$`))
  await b.locator('[data-part="hero"]').waitFor()
  await b.getByRole('button', { name: 'Проверить баланс' }).click()
  const pop = page.getByRole('dialog', { name: 'Проверить баланс' })
  await expect(pop.getByRole('table')).toBeVisible()
  // фокус — на ссылку строки 1 вкладки A, минуя край поповера (Tab с края теперь закрывает поповер — exitOnEdgeTab, финальная
  // волна 2e; фокус, ушедший иначе — программно, виртуальным курсором читалки, — панель не закрывает: поповер не модальный)
  const target = a.getByRole('button', { name: 'Исходное сообщение, отправка 1' })
  await target.focus()
  await expect(target).toBeFocused()
  await expect(pop).toBeVisible()
  await page.keyboard.press('Enter')
  const win = page.getByRole('dialog', { name: 'Исходное сообщение · отправка 1' })
  await expect(win.getByRole('region', { name: 'Тело сообщения' })).toBeVisible()
  // фокус ушёл в окно поверх — поповер закрыт, над подложкой окна его нет (найдено этим тестом: был слоем --k-z-menu над окном)
  await expect(pop).toHaveCount(0)
  expect(await win.evaluate((el) => el.contains(document.activeElement))).toBe(true)
  await win.evaluate((el) => Promise.all(el.getAnimations().map((x) => x.finished)).then(() => undefined))
  await page.screenshot({ path: test.info().outputPath('layers.png') })
  // Esc — только окно: обе деталки на месте, фокус на ссылке строки в A
  await page.keyboard.press('Escape')
  await expect(win).toHaveCount(0)
  await expect(dialogs(page)).toHaveCount(2)
  await expect(target).toBeFocused()
})

test('контраст текста плашек warn, bad и neutral ≥ 4,5', async ({ page }) => {
  const ratios: Record<string, number> = {}
  let dw = await openDoc(page, DOC.pending)
  ratios.warn = await contrastOf(bannerText(dw))
  await page.screenshot({ path: test.info().outputPath('banner-warn.png') })
  dw = await openDoc(page, DOC.done)
  ratios.bad = await contrastOf(bannerText(dw))
  await page.screenshot({ path: test.info().outputPath('banner-bad.png') })
  dw = await openDoc(page, DOC.pending)
  await banner(dw).getByRole('button', { name: 'Отклонить' }).click()
  const prompt = dw.getByRole('alertdialog', { name: 'Отклонить аннулирование?' })
  await prompt.getByRole('textbox', { name: 'Причина' }).fill('Платёж нужен')
  await prompt.getByRole('button', { name: 'Отклонить' }).click()
  await expect(banner(dw).locator('[data-tone]')).toHaveAttribute('data-tone', 'neutral')
  ratios.neutral = await contrastOf(bannerText(dw))
  await page.screenshot({ path: test.info().outputPath('banner-neutral.png') })
  test.info().annotations.push({ type: 'contrast', description: Object.entries(ratios).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join(', ') })
  for (const [tone, r] of Object.entries(ratios)) expect(r, tone).toBeGreaterThanOrEqual(4.5)
})
