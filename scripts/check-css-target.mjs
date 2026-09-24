// Проверка CSS кита на свойства и синтаксис новее планки браузера метаприложения.
// Планка — поле browserslist корневого package.json (сейчас Chromium 88): хост не транспилирует
// node_modules, поэтому то, что ушло в dist, должно работать там как есть.
// node scripts/check-css-target.mjs <файл.css>...
//
// doiuse (база caniuse) ловит вложенность, :has, @layer, @container, lab/lch/oklch и т. п.;
// «частичную поддержку» не считаем ошибкой. Чего нет в caniuse-базе doiuse — ловим регулярками ниже.
import { readFileSync } from 'node:fs'
import postcss from 'postcss'
import doiuse from 'doiuse'

const browsers = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).browserslist
const MISSED_BY_DOIUSE = [
  { re: /color-mix\(/, what: 'color-mix() — Chromium 111' },
  { re: /light-dark\(/, what: 'light-dark() — Chromium 123' },
  { re: /\btext-wrap\s*:/, what: 'text-wrap — Chromium 114' },
  { re: /\b\d*\.?\d+(dvh|svh|lvh|dvw|svw|lvw)\b/, what: 'dvh/svh/lvh — Chromium 108' },
  { re: /@starting-style|@scope\b/, what: '@starting-style/@scope — Chromium 117/118' },
  { re: /\boverflow(-[xy])?\s*:\s*clip\b/, what: 'overflow: clip — Chromium 90' },
  { re: /(^|[;{\s])(translate|rotate|scale)\s*:/, what: 'отдельные translate/rotate/scale — Chromium 104' },
  { re: /@media[^{]*[<>]=?/, what: 'диапазонный синтаксис @media — Chromium 104' },
  { re: /\baccent-color\s*:/, what: 'accent-color — Chromium 93' },
]
// Осознанные исключения: свойство в Chromium 88 просто не применяется, вёрстка не ломается.
const ALLOWED = new Map([
  ['accent-color', 'чекбокс в Chromium < 93 — системного цвета вместо --k-val; разметка и размеры те же'],
])

let failed = 0
for (const file of process.argv.slice(2)) {
  const css = readFileSync(file, 'utf8')
  const found = []
  await postcss([doiuse({ browsers, onFeatureUsage: (u) => { if (/not supported by/.test(u.message)) found.push(`${u.feature} (строка ${u.usage.source?.start?.line})`) } })])
    .process(css, { from: file })
  for (const { re, what } of MISSED_BY_DOIUSE) {
    if (!re.test(css)) continue
    const allowed = [...ALLOWED.keys()].find((k) => what.startsWith(k))
    if (allowed) console.log(`${file}: допущено — ${what}: ${ALLOWED.get(allowed)}`)
    else found.push(what)
  }
  for (const f of found) console.error(`${file}: не поддерживается ${browsers.join(', ')} — ${f}`)
  failed += found.length
}
if (failed) process.exit(1)
console.log(`CSS: синтаксиса новее ${browsers.join(', ')} нет`)
