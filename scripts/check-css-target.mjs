// Проверка CSS кита на свойства и синтаксис новее планки браузера метаприложения.
// Планка — поле browserslist корневого package.json (сейчас Chromium 88): хост не транспилирует
// node_modules, поэтому то, что ушло в dist, должно работать там как есть.
//   node scripts/check-css-target.mjs               — шаблоны styled в .ts/.tsx (TEMPLATE_DIRS)
//   node scripts/check-css-target.mjs <файл>...      — заданные файлы: .css целиком, .ts/.tsx — шаблоны
//
// doiuse (база caniuse) ловит вложенность, :has, @layer, @container, lab/lch/oklch и т. п.;
// «частичную поддержку» не считаем ошибкой. Чего нет в caniuse-базе doiuse — ловим регулярками ниже.
//
// Шаблоны styled (спека styled §6) разбирает postcss-styled-syntax — тот же разбор, что у stylelint.
// Проверяется исходный текст шаблона, а не вывод stylis: вендорные префиксы, которые stylis добавляет
// при выполнении, сюда не попадают. Интерполяции ${…} для регулярок заменяются на var(--k-x).
// Вложенность в шаблоне — не ошибка: stylis раскрывает её до плоских правил ещё в JS.
// Ограничение разбора: шаблоны styled.x, styled(X), css и createGlobalStyle; keyframes`…` не разбирается,
// а CSS, собранный строкой и вставленный одной интерполяцией, не виден — поэтому @font-face в KatranFonts
// написан текстом шаблона css.
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import postcss from 'postcss'
import doiuse from 'doiuse'
import * as styledSyntax from 'postcss-styled-syntax'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const TEMPLATE_DIRS = ['packages/ui/src', 'apps/demo/src', 'apps/pi/src', 'examples/federation/remote/src']
const browsers = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).browserslist
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
  { re: /(^|[;{\s])size-adjust\s*:/, what: 'size-adjust в @font-face — Chromium 92' },
]
// Осознанные исключения: свойство в Chromium 88 просто не применяется, вёрстка не ломается.
const ALLOWED = new Map([
  ['accent-color', 'чекбокс в Chromium < 93 — системного цвета вместо --k-val; разметка и размеры те же'],
])
// В шаблонах styled: вложенность раскрывает stylis до попадания в браузер
const TEMPLATE_IGNORED_FEATURES = new Set(['css-nesting'])

/** Все .ts/.tsx в каталогах шаблонов (без node_modules и dist). */
function templateFiles() {
  const out = []
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name === 'dist') continue
      const path = join(dir, e.name)
      if (e.isDirectory()) walk(path)
      else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(path)
    }
  }
  for (const d of TEMPLATE_DIRS) walk(join(ROOT, d))
  return out
}

/** ${…} с учётом вложенных скобок и строк → var(--k-x); переводы строк сохраняются ради номеров строк. */
function replaceInterpolations(text) {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '$' || text[i + 1] !== '{') { out += text[i]; continue }
    let depth = 0
    let j = i + 1
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}' && --depth === 0) break
    }
    out += `var(--k-x)${'\n'.repeat((text.slice(i, j + 1).match(/\n/g) ?? []).length)}`
    i = j
  }
  return out
}

/** Части файла для проверки: { root, text, firstLine } — root для doiuse, text для регулярок. */
function partsOf(file, source) {
  if (!/\.tsx?$/.test(extname(file))) return [{ root: postcss.parse(source, { from: file }), text: source, firstLine: 1, template: false }]
  if (!source.includes('`')) return []
  const doc = styledSyntax.parse(source, { from: file })
  return doc.nodes.map((root) => ({ root, text: replaceInterpolations(root.toString()), firstLine: root.source?.start?.line ?? 1, template: true }))
}

const lineAt = (text, index, firstLine) => firstLine + (text.slice(0, index).match(/\n/g) ?? []).length

const args = process.argv.slice(2)
const files = args.length ? args : templateFiles()
let failed = 0
let templates = 0
let fontFaces = 0
for (const file of files) {
  const name = relative(ROOT, resolve(file))
  const found = []
  for (const part of partsOf(file, readFileSync(file, 'utf8'))) {
    if (part.template) templates++
    part.root.walkAtRules('font-face', () => { fontFaces++ })
    await postcss([doiuse({
      browsers,
      onFeatureUsage: (u) => {
        if (!/not supported by/.test(u.message)) return
        if (part.template && TEMPLATE_IGNORED_FEATURES.has(u.feature)) return
        found.push(`${u.feature} (строка ${u.usage.source?.start?.line})`)
      },
    })]).process(part.root, { from: file, ...(part.template ? { syntax: styledSyntax } : {}) })
    for (const { re, what } of MISSED_BY_DOIUSE) {
      const m = re.exec(part.text)
      if (!m) continue
      const line = lineAt(part.text, m.index + m[0].length - m[0].trimStart().length, part.firstLine)
      const allowed = [...ALLOWED.keys()].find((k) => what.startsWith(k))
      if (allowed) console.log(`${name}: допущено — ${what} (строка ${line}): ${ALLOWED.get(allowed)}`)
      else found.push(`${what} (строка ${line})`)
    }
  }
  for (const f of found) console.error(`${name}: не поддерживается ${browsers.join(', ')} — ${f}`)
  failed += found.length
}
if (!args.length) console.log(`Шаблоны styled: ${templates} в ${files.length} файлах .ts/.tsx, правил @font-face: ${fontFaces}`)
if (failed) process.exit(1)
console.log(`CSS: синтаксиса новее ${browsers.join(', ')} нет`)
