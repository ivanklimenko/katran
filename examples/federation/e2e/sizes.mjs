// Что и сколько remote реально отдаёт странице хоста: перехват запросов к remote при монтировании экрана,
// размеры — raw и gzip -9 по файлам из dist remote. node e2e/sizes.mjs <URL хоста> <origin remote> <папка dist remote>
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join } from 'node:path'

const [HOST, REMOTE, DIST] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage()
const files = []
page.on('response', (r) => { if (r.url().startsWith(REMOTE)) files.push(new URL(r.url()).pathname.slice(1)) })
await page.goto(HOST)
await page.locator('tbody[data-key]').first().waitFor({ timeout: 20_000 })
await page.waitForTimeout(1000)
await browser.close()

const rows = files.map((f) => {
  const buf = readFileSync(join(DIST, f))
  return { file: f, raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length }
})
const kb = (n) => (n / 1024).toFixed(1)
const sum = (pred) => rows.filter(pred).reduce((a, r) => ({ raw: a.raw + r.raw, gzip: a.gzip + r.gzip }), { raw: 0, gzip: 0 })
for (const r of rows) console.log(`${r.file.padEnd(36)} ${kb(r.raw).padStart(8)} KiB  gzip ${kb(r.gzip).padStart(7)} KiB`)
const js = sum((r) => r.file.endsWith('.js')), css = sum((r) => r.file.endsWith('.css')), fonts = sum((r) => /\.woff2?$/.test(r.file))
console.log(`JS:     ${kb(js.raw)} KiB, gzip ${kb(js.gzip)} KiB`)
if (css.raw) console.log(`CSS:    ${kb(css.raw)} KiB, gzip ${kb(css.gzip)} KiB`)
console.log(`шрифты: ${kb(fonts.raw)} KiB (woff2 не сжимается)`)
