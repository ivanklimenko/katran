// Замер скорости реестра apps/pi: база (perf/base) против текущей сборки (perf/head). Перенесён из опыта spike/styled
// (apps/pi/spike/measure.mjs и table.mjs): сценарии, порядок и счётчики те же, четыре режима опыта стали двумя сборками.
// Запуск: pnpm --filter pi perf:base <ref>, затем pnpm --filter pi perf [круги, по умолчанию 8].
// Код выхода 1 — обязательный сценарий head хуже базы больше чем на +15 % и больше чем на 2 мс
// (полное время; для базы короче 100 мс — время скриптов). Сервер сборок слушает только 127.0.0.1 и не выдаёт файлы вне сборки.
import { chromium } from '@playwright/test'
import { createServer } from 'node:http'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve as resolvePath, sep } from 'node:path'

const BUILDS = ['base', 'head']
const SIZES = [50, 200]
const THROTTLES = [1, 4]
const ROUNDS = Number(process.argv[2] ?? 8)
const PORT = 5290
const LIMIT = 0.15
const SHORT_MS = 100
const ABS_MS = 2 // абсолютный допуск: при базе около 0 мс любой положительный head не считается ухудшением
// обязательные сценарии; прокрутка — справочно (кадр упирается в частоту обновления экрана)
const REQUIRED = ['first', 'page', 'select', 'theme']
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' }

for (const build of BUILDS) {
  if (!existsSync(new URL(`./${build}/index.html`, import.meta.url))) {
    console.error(`нет сборки perf/${build}: ${build === 'base' ? 'pnpm --filter pi perf:base <ref>' : 'pnpm --filter pi perf'}`)
    process.exit(2)
  }
}

// каждая сборка — со своего порта (localStorage и кэш не пересекаются)
const servers = await Promise.all(BUILDS.map((build, i) => new Promise((resolve) => {
  const root = new URL(`./${build}/`, import.meta.url).pathname
  const srv = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname
    try {
      const file = resolvePath(join(root, path === '/' ? 'index.html' : decodeURIComponent(path)))
      if (file !== resolvePath(root) && !file.startsWith(resolvePath(root) + sep)) { res.writeHead(403).end(); return }
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file))
    } catch { res.writeHead(404).end() }
  }).listen(PORT + i, '127.0.0.1', () => resolve(srv))
})))
const urlOf = (build, size) => `http://127.0.0.1:${PORT + BUILDS.indexOf(build)}/?slow=0&noauto&docs=500&size=${size}#/fx-docs`

const browser = await chromium.launch()
const metricsOf = async (cdp) => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
const KEYS = ['TaskDuration', 'ScriptDuration', 'RecalcStyleDuration', 'LayoutDuration']
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))))

// действие → ожидание условия → два кадра; возвращает полное время (мс) и прирост процессорных счётчиков (мс)
async function timed(page, cdp, act, done) {
  const before = await metricsOf(cdp)
  const t0 = Date.now()
  await act()
  await done()
  await settle(page)
  const wall = Date.now() - t0
  const after = await metricsOf(cdp)
  return { wall, ...Object.fromEntries(KEYS.map((k) => [k, (after[k] - before[k]) * 1000])) }
}

// Клики — прямо в странице по простому селектору: поиск по роли и доступному имени (getByRole) перебирает все кнопки
// в ячейках и сам добавляет ~1 с на действие при 200 записях.
const click = (page, selector, text) => page.evaluate(([sel, txt]) => {
  const el = [...document.querySelectorAll(sel)].find((e) => !txt || e.textContent.trim() === txt)
  if (!el) throw new Error(`нет ${sel} ${txt ?? ''}`)
  el.click()
}, [selector, text])
const samples = {}
const push = (key, v) => (samples[key] ??= []).push(v)

for (let round = 0; round < ROUNDS; round += 1) {
  // порядок сборок сдвигается с каждым кругом — прогрев и троттлинг машины не достаются одной сборке
  const order = BUILDS.map((_, i) => BUILDS[(i + round) % BUILDS.length])
  for (const throttle of THROTTLES) for (const size of SIZES) for (const build of order) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Performance.enable')
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
    const key = (scenario) => `${scenario}|${size}|x${throttle}|${build}`
    const firstKey = () => page.evaluate(() => document.querySelector('tbody[data-key]')?.getAttribute('data-key'))

    // 1. первый показ: от перехода до N записей на экране
    push(key('first'), await timed(page, cdp, () => page.goto(urlOf(build, size)), () => page.waitForFunction((n) => document.querySelectorAll('tbody[data-key]').length === n, size)))
    if (round === 0 && throttle === 1) push(key('dom'), { nodes: await page.evaluate(() => document.querySelectorAll('tbody[data-key] *').length), styleRules: await page.evaluate(() => Array.from(document.styleSheets).reduce((n, s) => n + s.cssRules.length, 0)) })

    // 2. смена страницы: 1 → 2 → 1
    for (const target of [2, 1]) {
      const was = await firstKey()
      push(key('page'), await timed(page, cdp, () => click(page, `button[aria-label="Страница ${target}"]`), () => page.waitForFunction((k) => { const el = document.querySelector('tbody[data-key]'); return el && el.getAttribute('data-key') !== k }, was)))
    }

    // 3. выделить все на странице и снять (обновление каждой записи без смены данных)
    for (const want of [true, false]) {
      push(key('select'), await timed(page, cdp, () => click(page, 'input[aria-label="Выбрать все на странице"]'), () => page.waitForFunction((w) => document.querySelectorAll('tr[aria-selected="true"]').length > 0 === w, want)))
    }

    // 4. смена темы: тёмная и обратно
    for (const [name, attr] of [['Тёмная', 'dark'], ['Светлая', 'light']]) {
      push(key('theme'), await timed(page, cdp, () => click(page, 'button', name), () => page.waitForFunction((a) => document.querySelector('[data-k-root]')?.getAttribute('data-theme') === a, attr)))
    }

    // 5. прокрутка: 40 шагов по 120 px по кадрам — средний кадр и число длинных (> 25 мс)
    const scroll = await page.evaluate(() => new Promise((resolve) => {
      const scroller = [...document.querySelectorAll('*')].find((el) => el.scrollHeight > el.clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) ?? document.scrollingElement
      const frames = []
      let last = performance.now()
      let i = 0
      const step = (now) => { frames.push(now - last); last = now; scroller.scrollTop += 120; i += 1; if (i < 40) requestAnimationFrame(step); else resolve(frames.slice(1)) }
      requestAnimationFrame(step)
    }))
    push(key('scroll'), { wall: scroll.reduce((a, b) => a + b, 0) / scroll.length, long: scroll.filter((f) => f > 25).length })
    await ctx.close()
  }
  console.error(`круг ${round + 1}/${ROUNDS}`)
}
await browser.close()
servers.forEach((s) => s.close())

// медианы по кругам
const median = (xs) => { const a = [...xs].sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2 }
const result = {}
for (const [key, list] of Object.entries(samples)) {
  result[key] = Object.fromEntries(Object.keys(list[0]).map((f) => [f, Math.round(median(list.map((x) => x[f])) * 10) / 10]))
  result[key].n = list.length
}
writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify({ samples, result }, null, 2))

// таблица: сценарий, размер, троттлинг; база и head; мера сравнения и отклонение
const ref = (build) => { try { return readFileSync(new URL(`./${build}/.ref`, import.meta.url), 'utf8').trim().slice(0, 7) } catch { return 'рабочая копия' } }
console.log(`\nбаза: ${ref('base')}, head: ${ref('head')}; кругов: ${ROUNDS}; медианы, мс\n`)
const cols = ['сценарий', 'записей', 'CPU', 'мера', 'база', 'head', 'Δ', 'итог']
const lines = []
let failed = false
const scenarios = [...new Set(Object.keys(result).map((k) => k.split('|')[0]))]
for (const sc of scenarios) for (const throttle of THROTTLES) for (const size of SIZES) {
  const b = result[`${sc}|${size}|x${throttle}|base`]
  const h = result[`${sc}|${size}|x${throttle}|head`]
  if (!b || !h) continue
  if (sc === 'dom') { lines.push([sc, size, `x${throttle}`, 'узлы/правила', `${b.nodes}/${b.styleRules}`, `${h.nodes}/${h.styleRules}`, '', 'справочно']); continue }
  if (sc === 'scroll') { lines.push([sc, size, `x${throttle}`, 'кадр (длинных)', `${b.wall} (${b.long})`, `${h.wall} (${h.long})`, pct(b.wall, h.wall), 'справочно']); continue }
  // короткое действие: полное время тонет в ожидании кадров — сравнивается время скриптов
  const field = b.wall < SHORT_MS ? 'ScriptDuration' : 'wall'
  const worse = h[field] > b[field] * (1 + LIMIT) && h[field] - b[field] > ABS_MS
  if (REQUIRED.includes(sc) && worse) failed = true
  lines.push([sc, size, `x${throttle}`, field === 'wall' ? 'полное' : 'скрипты', b[field], h[field], pct(b[field], h[field]), worse ? `ХУЖЕ +${LIMIT * 100} %` : 'ок'])
}
function pct(base, head) { if (!base) return '—'; const d = Math.round((head / base - 1) * 100); return `${d >= 0 ? '+' : ''}${d} %` }
const widths = cols.map((c, i) => Math.max(c.length, ...lines.map((l) => String(l[i]).length)))
const row = (cells) => cells.map((c, i) => (i < 4 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join('  ')
console.log(row(cols))
console.log(widths.map((w) => '-'.repeat(w)).join('  '))
for (const l of lines) console.log(row(l))
console.log(failed ? `\nПОРОГ НАРУШЕН: обязательный сценарий хуже базы больше чем на +${LIMIT * 100} % и ${ABS_MS} мс` : `\nпорог соблюдён: обязательные сценарии в пределах +${LIMIT * 100} %`)
process.exit(failed ? 1 : 0)
