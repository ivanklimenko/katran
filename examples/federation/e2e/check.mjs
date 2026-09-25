// Проверка встраивания remote в хост в настоящем Chromium (Playwright).
// Запуск: node e2e/check.mjs [URL хоста] — по умолчанию http://localhost:5200/.
// Печатает JSON с результатами и завершается с кодом 1, если хоть одна проверка не прошла.
import { chromium } from 'playwright'

const HOST = process.argv[2] ?? 'http://localhost:5200/'
const results = []
const ok = (name, pass, details) => results.push({ name, pass: !!pass, ...(details === undefined ? {} : { details }) })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
// Подставной хук React DevTools: react-dom 17 регистрирует в нём свой рендерер —
// так видно, сколько копий react-dom на странице и какой они версии.
await context.addInitScript(() => {
  localStorage.clear()
  const renderers = new Map()
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers, supportsFiber: true, isDisabled: false,
    inject(r) { const id = renderers.size + 1; renderers.set(id, r); return id },
    onCommitFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
  }
})
const page = await context.newPage()
page.setDefaultTimeout(8000)
/** Шаг проверки: исключение не обрывает прогон, а записывается как непройденная проверка. */
const step = async (name, fn) => { try { await fn() } catch (e) { ok(name, false, String(e.message).split('\n')[0]) } }
const console_ = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console_.push(`${m.type()}: ${m.text()}`) })
page.on('pageerror', (e) => console_.push(`pageerror: ${e.message}`))
const failed = []
page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url()}`))
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) })

await page.goto(HOST)
const hostError = page.locator('[data-host-error]')
const firstRecord = page.locator('tbody[data-key]').first()
await Promise.race([firstRecord.waitFor({ timeout: 20_000 }), hostError.waitFor({ timeout: 20_000 })]).catch(() => {})
if (await hostError.count()) {
  ok('экран смонтирован в хосте', false, await hostError.innerText())
  await finish()
}
ok('экран смонтирован в хосте', await page.locator('[data-host-slot] [data-k-root] table[role=grid]').count() === 1)

// --- один React, один effector ---
await step('рантайм: React/effector', async () => {
  const rt = await page.evaluate(() => {
    const s = window.__spike
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
    const el = s.remoteJsx.jsx('i', {})
    return {
      renderers: [...hook.renderers.values()].map((r) => `${r.rendererPackageName}@${r.version}`),
      hostReact: s.hostReact.version,
      remoteReact: s.remoteReact.version,
      sameCreateElement: s.hostReact.createElement === s.remoteReact.createElement,
      sameUseState: s.hostReact.useState === s.remoteReact.useState,
      jsxElementType: String(el.$$typeof),
      jsxIsReact17Element: el.$$typeof === Symbol.for('react.element'),
      sameEffector: s.hostEffector.createStore === s.remoteEffector.createStore,
      hostEffectorVersion: s.hostEffector.version,
      remoteEffectorVersion: s.remoteEffector.version,
    }
  })
  ok('один рендерер react-dom 17.0.2', rt.renderers.length === 1 && rt.renderers[0] === 'react-dom@17.0.2', rt.renderers)
  ok('React remote = React хоста (17.0.2, тот же модуль)', rt.sameCreateElement && rt.sameUseState && rt.remoteReact === '17.0.2', rt)
  ok('jsx-runtime remote создаёт элементы React 17', rt.jsxIsReact17Element, rt.jsxElementType)
  results.push({ name: 'effector remote = effector хоста', info: { same: rt.sameEffector, host: rt.hostEffectorVersion, remote: rt.remoteEffectorVersion } })
})

// --- единицы хоста в remote ---
await step('единицы хоста', async () => {
  await page.locator('[data-host-visit]').click()
  const visitsInRemote = await page.locator('[data-remote-visits]').getAttribute('data-remote-visits')
  await page.getByRole('button', { name: 'Событие хоста из remote' }).click()
  const hostBtn = await page.locator('[data-host-visit]').innerText()
  ok('стор хоста читается в remote (useUnit remote)', visitsInRemote === '1', { visitsInRemote })
  ok('событие хоста вызывается из remote', /\(2\)/.test(hostBtn), { hostBtn })
})

// --- геометрия и плотность ---
await step('геометрия', async () => {
  const h = async (sel) => (await page.locator(sel).first().boundingBox()).height
  await page.getByRole('button', { name: '100 %' }).click()
  const record = await h('tbody[data-key]')
  const head = await h('table[role=grid] thead')
  ok('запись 68 px при 100 %', Math.abs(record - 68) < 0.5, { record, head })
  await page.getByRole('button', { name: '125 %' }).click()
  const big = await h('tbody[data-key]')
  ok('плотность 125 % → запись ×1.25', Math.abs(big - record * 1.25) <= 2, { big })
  await page.getByRole('button', { name: '100 %' }).click()
})

// --- стили хоста не протекают в кит ---
await step('стили хоста → кит', async () => {
  const kitStyle = await page.evaluate(() => {
    const root = document.querySelector('[data-k-root]')
    const btn = root.querySelector('button')
    const td = root.querySelector('tbody[data-key] td')
    const cs = (e) => getComputedStyle(e)
    return {
      rootFont: cs(root).fontFamily.split(',')[0], rootFontSize: cs(root).fontSize, rootLineHeight: cs(root).lineHeight,
      buttonTextTransform: cs(btn).textTransform, buttonLetterSpacing: cs(btn).letterSpacing, buttonFont: cs(btn).fontFamily.split(',')[0],
      tdBorderTop: cs(td).borderTopWidth + ' ' + cs(td).borderTopStyle, tdBoxSizing: cs(td).boxSizing,
      fontsLoaded: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family} ${f.weight}`),
      fontsError: [...document.fonts].filter((f) => f.status === 'error').map((f) => `${f.family} ${f.weight}`),
    }
  })
  results.push({ name: 'вычисленные стили кита внутри хоста', info: kitStyle })
  ok('шрифты IBM Plex загружены (нет ошибок загрузки)', kitStyle.fontsError.length === 0 && kitStyle.fontsLoaded.some((f) => f.includes('IBM Plex Sans')), { loaded: kitStyle.fontsLoaded.length, errors: kitStyle.fontsError })
})

// --- стили кита не протекают в хост ---
await step('стили кита → хост', async () => {
  const hostLeak = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement)
    const body = getComputedStyle(document.body)
    return { htmlFontSize: cs.fontSize, bodyFont: body.fontFamily, bodyBg: body.backgroundColor, rootVars: cs.getPropertyValue('--k-val').trim() }
  })
  await page.locator('[data-host-cell]').focus()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Shift+Tab')
  const hostCell = await page.locator('[data-host-cell]').evaluate((e) => ({ focused: document.activeElement === e, outline: getComputedStyle(e).outlineStyle + ' ' + getComputedStyle(e).outlineColor }))
  results.push({ name: 'корень документа хоста после монтирования', info: hostLeak })
  ok('фокус ячейки хоста не перекрашен CSS кита (td[tabindex]:focus-visible)', !hostCell.outline.includes('58, 110, 165'), hostCell)
  ok('html/body хоста не тронуты', hostLeak.htmlFontSize === '10px' || hostLeak.htmlFontSize === '16px', hostLeak)
})

// --- лейн ---
await step('лейн', async () => {
  const total = async () => (await page.locator('table[role=grid]').getAttribute('aria-rowcount'))
  const before = await total()
  await page.getByRole('group', { name: 'Статусы' }).getByRole('button', { name: /Ошибка/ }).click()
  await page.waitForFunction((b) => document.querySelector('table[role=grid]').getAttribute('aria-rowcount') !== b && !document.querySelector('table[role=grid]').getAttribute('aria-busy'), before)
  const labels = await page.locator('tbody[data-key] [role=img][aria-label]').evaluateAll((es) => [...new Set(es.map((e) => e.getAttribute('aria-label')))])
  ok('лейн «Ошибка» фильтрует записи', labels.length === 1, { labels, before, after: await total() })
})

// --- панель фильтров: чип применённого условия ---
await step('панель фильтров', async () => {
  await page.getByRole('button', { name: /Фильтры/ }).click()
  await page.getByRole('textbox', { name: 'Приказодатель' }).fill('Ромашка')
  await page.getByRole('button', { name: 'Применить' }).click()
  const chips = await page.getByRole('list', { name: 'Применённые условия' }).innerText().catch(() => '')
  ok('панель фильтров применяет условие', /Ромашка/.test(chips) && /Ошибка/.test(chips), chips.replace(/\s+/g, ' '))
  await page.getByRole('button', { name: 'Сбросить' }).click()
  await page.waitForFunction(() => !document.querySelector('table[role=grid]').getAttribute('aria-busy'))
})

// --- сортировка: меню ключей составной колонки (поповер) ---
await step('сортировка/поповер', async () => {
  const bodyChildren = await page.evaluate(() => document.body.children.length)
  await page.getByRole('columnheader', { name: /ID/ }).getByRole('button').first().click()
  const menu = page.getByRole('menu')
  await menu.waitFor()
  const menuPortal = await menu.evaluate((m) => ({ inProvider: !!m.closest('[data-k-root]'), inHostSlot: !!m.closest('[data-host-slot]'), bodyChildren: document.body.children.length }))
  ok('поповер (меню сортировки) — в портале внутри KatranProvider, не в body хоста', menuPortal.inProvider && menuPortal.bodyChildren === bodyChildren, menuPortal)
  await menu.getByRole('menuitemcheckbox', { name: /Номер документа/ }).click()
  await page.waitForFunction(() => document.querySelector('table[role=grid] [aria-sort]:not([aria-sort="none"])'))
  await page.waitForFunction(() => !document.querySelector('table[role=grid]').getAttribute('aria-busy') && !document.querySelector('table[role=grid][data-dim="true"]'))
  const sortState = await page.locator('table[role=grid] [aria-sort]:not([aria-sort="none"])').first().getAttribute('aria-sort')
  // номер документа — первое значение колонки ID (у записи в первой строке: служебная ячейка, статус, ID)
  const nums = await page.locator('tbody[data-key]').evaluateAll((bs) => bs.slice(0, 5).map((b) => Number(b.querySelector('tr > td:nth-child(3) [data-k-tip]')?.getAttribute('data-k-tip'))))
  ok('сортировка по номеру документа', sortState !== null && nums.every((n, i) => i === 0 || (sortState === 'descending' ? n <= nums[i - 1] : n >= nums[i - 1])), { sortState, nums })
})

// --- выделение и полоса массовых действий ---
await step('выделение', async () => {
  await page.getByRole('checkbox', { name: 'Выбрать запись 1', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Выбрать запись 2', exact: true }).check()
  const bar = await page.locator('[data-k-root] [role=region]').allInnerTexts()
  ok('выделение → BulkBar', bar.some((t) => /2/.test(t)), bar.map((t) => t.replace(/\s+/g, ' ')))
})

// --- тултип ---
await step('тултип', async () => {
  const bodyChildren = await page.evaluate(() => document.body.children.length)
  // LinkValue с значением: тултип без условия truncated, кнопка не disabled
  const link = page.locator('tbody[data-key] button[data-k-tip]:not([disabled]):not([data-k-tip-if])').first()
  await link.hover()
  await page.waitForTimeout(900)
  const tip = await page.evaluate(() => {
    const t = document.querySelector('[role=tooltip]')
    return t ? { text: t.textContent, inProvider: !!t.closest('[data-k-root]'), bodyChildren: document.body.children.length } : null
  })
  ok('тултип показан в корне KatranProvider', tip && tip.inProvider && tip.bodyChildren === bodyChildren, tip)
})

// --- модель фильтров remote после монтирования: combine-стор обновляется ---
// Ловит вторую копию effector (подписки useUnit из одной копии на сторы из другой ломали $dirty).
await step('модель фильтров', async () => {
  const dirty = await page.evaluate(() => {
    const f = window.__spike.remoteModels.filters
    f.edit({ field: 'f59name', op: 'CONTAINS', value: 'Кедр' })
    const v = f.$dirty.getState()
    f.revert()
    return v
  })
  ok('модель фильтров: $dirty после edit (граф effector один)', dirty === true, dirty)
})

// --- размонтирование и повторное монтирование (уход со страницы хоста и возврат) ---
await step('размонтирование', async () => {
  const before = await page.evaluate(() => document.body.querySelectorAll('*').length)
  await page.locator('[data-host-toggle]').click()
  await page.locator('[data-k-root]').waitFor({ state: 'detached' })
  const leftovers = await page.evaluate(() => ({ kitNodes: document.querySelectorAll('[data-k-root], [role=tooltip], [class*="k-"]').length }))
  await page.locator('[data-host-toggle]').click()
  await page.locator('tbody[data-key]').first().waitFor()
  const after = await page.evaluate(() => document.body.querySelectorAll('*').length)
  ok('экран размонтируется без остатков и монтируется снова', leftovers.kitNodes === 0, { leftovers, nodesBefore: before, nodesAfter: after })
})

// --- тёмная тема ОС: экран остаётся светлым, как хост (тема задана явно) ---
await step('тёмная тема ОС', async () => {
  await page.emulateMedia({ colorScheme: 'dark' })
  const bg = await page.locator('[data-k-root]').evaluate((e) => getComputedStyle(e).backgroundColor)
  await page.emulateMedia({ colorScheme: 'light' })
  ok('при тёмной теме ОС экран светлый (defaultTheme="light")', bg === 'rgb(255, 255, 255)', bg)
})

await finish()

async function finish() {
  results.push({ name: 'консоль', info: console_ })
  results.push({ name: 'отказы сети', info: failed })
  ok('консоль: 0 ошибок и 0 предупреждений', console_.length === 0, console_.length)
  await browser.close()
  console.log(JSON.stringify(results, null, 2))
  const bad = results.filter((r) => r.pass === false)
  console.log(`\n${results.filter((r) => r.pass).length} пройдено, ${bad.length} не пройдено: ${bad.map((b) => b.name).join('; ')}`)
  process.exit(bad.length ? 1 : 0)
}
