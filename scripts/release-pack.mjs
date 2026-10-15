// Выпуск пакетов кита тарболами: node scripts/release-pack.mjs [--no-build].
// Собирает три пакета, упаковывает их pnpm pack в release/ (pnpm заменяет "workspace:*" на версию)
// и проверяет каждый тарбол без сети: манифест пригоден для любого клиента (npm, yarn, pnpm),
// все файлы, на которые он указывает, лежат в архиве, исходников в нём нет.
// Готовый .tgz публикуется любым клиентом (npm publish release/<файл>.tgz) или переносится в контур файлом.
// --no-build — упаковать уже собранные dist (так делает pnpm check сразу после pnpm build).
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = join(ROOT, 'release')
const PACKAGES = ['tokens', 'ui', 'effector']
// Условие экспорта для разработки в монорепо: ведёт в src, которого в тарболе нет; потребитель его не включает.
const SOURCE_CONDITION = 'katran-source'
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], shell: process.platform === 'win32' }).toString()

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })
for (const p of PACKAGES) {
  const dir = join(ROOT, 'packages', p)
  if (!process.argv.includes('--no-build')) run('pnpm', ['run', 'build'], dir)
  run('pnpm', ['pack', '--pack-destination', OUT], dir)
}

// Пути, на которые ссылается манифест: main/module/types и все ветки exports, кроме условия для монорепо.
const targets = (value, out = []) => {
  if (typeof value === 'string') out.push(value)
  else if (value && typeof value === 'object') for (const [key, inner] of Object.entries(value)) if (key !== SOURCE_CONDITION) targets(inner, out)
  return out
}

// Шрифты @katran/tokens: 14 файлов woff2 в fonts/, а dist/fonts.js ссылается на каждый из них записью
// new URL('../fonts/…', import.meta.url) — без встроенных data:-адресов (их сборщик потребителя не разрешает,
// они лишь раздувают JS; спека styled §4.5).
const FONT_COUNT = 14
function fonts(pkgDir, fail) {
  const dir = join(pkgDir, 'fonts')
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.woff2')) : []
  if (files.length !== FONT_COUNT) fail(`в fonts/ файлов woff2: ${files.length}, ожидалось ${FONT_COUNT}`)
  const js = existsSync(join(pkgDir, 'dist/fonts.js')) ? readFileSync(join(pkgDir, 'dist/fonts.js'), 'utf8') : ''
  const urls = [...js.matchAll(/new URL\(\s*["']\.\.\/fonts\/([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g)].map((m) => m[1])
  if (urls.length !== FONT_COUNT) fail(`в dist/fonts.js адресов new URL('../fonts/…', import.meta.url): ${urls.length}, ожидалось ${FONT_COUNT}`)
  for (const url of urls) if (!files.includes(url)) fail(`dist/fonts.js ссылается на fonts/${url}, файла в архиве нет`)
  if (js.includes('data:')) fail('dist/fonts.js содержит встроенные data:-адреса — сборка встроила шрифты')
}

/** Все файлы архива относительно корня пакета. */
const filesOf = (dir, prefix = '') => readdirSync(join(dir, prefix), { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? filesOf(dir, join(prefix, d.name)) : [join(prefix, d.name)]))

const errors = []
const tarballs = readdirSync(OUT).filter((f) => f.endsWith('.tgz')).sort()
if (tarballs.length !== PACKAGES.length) errors.push(`ожидалось тарболов: ${PACKAGES.length}, получено: ${tarballs.length}`)
for (const file of tarballs) {
  const tmp = mkdtempSync(join(tmpdir(), 'katran-pack-'))
  try {
    run('tar', ['-xzf', join(OUT, file), '-C', tmp])
    const pkgDir = join(tmp, 'package')
    const manifestText = readFileSync(join(pkgDir, 'package.json'), 'utf8')
    const manifest = JSON.parse(manifestText)
    const fail = (message) => errors.push(`${file}: ${message}`)
    if (manifestText.includes('workspace:')) fail('в манифесте осталось "workspace:" — упаковано не pnpm')
    if (manifest.publishConfig) fail('в манифесте есть publishConfig — его применяет только pnpm, поля входа должны лежать в корне')
    for (const field of ['main', 'types', 'exports']) if (!manifest[field]) fail(`в манифесте нет поля ${field}`)
    for (const path of new Set(targets([manifest.main, manifest.module, manifest.types, manifest.exports]))) {
      if (!existsSync(join(pkgDir, path))) fail(`манифест указывает на ${path}, файла в архиве нет`)
      if (/\.tsx?$/.test(path) && !path.endsWith('.d.ts')) fail(`вход ${path} — исходник TypeScript, потребитель должен получать сборку`)
    }
    if (manifest.name === '@katran/ui' && existsSync(join(pkgDir, 'src'))) fail('в архив попали исходники src')
    // 0.2.0 (спека styled §4.6): стили кита — в JS (styled-components), CSS-файлов в пакете нет
    if (manifest.name === '@katran/ui') for (const css of filesOf(pkgDir).filter((f) => f.endsWith('.css'))) fail(`в архиве файл CSS ${css} — у кита 0.2.0 стилей в CSS нет`)
    if (manifest.name === '@katran/tokens') fonts(pkgDir, fail)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (errors.length) {
  console.error(`Тарболы не прошли проверку:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  process.exit(1)
}
console.log(`release/: ${tarballs.join(', ')} — манифесты и состав проверены`)
