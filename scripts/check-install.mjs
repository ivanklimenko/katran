// Проверка установки пакетов кита у потребителя: node scripts/check-install.mjs (после pnpm release:pack).
// Ставит три тарбола из release/ через npm в чистый проект вне монорепо и повторяет путь первой интеграции:
// импорт в Node, предсборка зависимостей Vite (на ней падал хост — «Failed to resolve entry for package»),
// production-сборка и проверка типов. Шрифты (спека styled §3.3): проект ставит KatranFonts без импорта CSS шрифтов,
// сборка кладёт 14 файлов woff2 в dist/assets, а в Chromium (Playwright монорепо) страница Vite dev — с предсборкой
// зависимостей — и страница готовой сборки загружают IBM Plex. Нужна сеть (npm ставит react, effector, vite) —
// поэтому не входит в pnpm check; запускается в CI отдельной задачей и вручную перед выпуском.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const RELEASE = join(ROOT, 'release')
const FONT_COUNT = 14
const tarballs = existsSync(RELEASE) ? readdirSync(RELEASE).filter((f) => f.endsWith('.tgz')) : []
if (tarballs.length !== 3) {
  console.error('В release/ нет трёх тарболов — сначала pnpm release:pack')
  process.exit(2)
}
const tarball = (name) => `file:${join(RELEASE, tarballs.find((f) => f.startsWith(`katran-${name}-`)))}`

const dir = mkdtempSync(join(tmpdir(), 'katran-install-'))
const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' })
const write = (path, text) => writeFileSync(join(dir, path), text)

mkdirSync(join(dir, 'src'))
write('package.json', `${JSON.stringify({
  name: 'katran-install-check',
  private: true,
  type: 'module',
  dependencies: {
    '@katran/tokens': tarball('tokens'),
    '@katran/ui': tarball('ui'),
    '@katran/effector': tarball('effector'),
    effector: '^23.4.0',
    'styled-components': '^5.3.11',
    'effector-react': '^23.3.0',
    react: '17.0.2',
    'react-dom': '17.0.2',
  },
  devDependencies: { '@types/react': '^17.0.93', '@types/react-dom': '^17.0.26', typescript: '~5.9.3', vite: '^8.3.0' },
}, null, 2)}\n`)
write('tsconfig.json', `${JSON.stringify({
  compilerOptions: { target: 'ES2020', lib: ['ES2020', 'DOM', 'DOM.Iterable'], module: 'ESNext', moduleResolution: 'bundler', jsx: 'react', strict: true, noEmit: true, skipLibCheck: true, types: [] },
  include: ['src'],
}, null, 2)}\n`)
write('index.html', '<!doctype html><html lang="ru"><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n')
write('src/main.tsx', `import React from 'react'
import ReactDOM from 'react-dom'
import { densityOptions, type Density } from '@katran/tokens'
import { Button, KatranFonts, KatranProvider } from '@katran/ui'
import { createFiltersModel, createGridModel } from '@katran/effector'

const density: Density = densityOptions[0]
console.log(density, typeof createFiltersModel, typeof createGridModel)
ReactDOM.render(<><KatranFonts /><KatranProvider defaultTheme="light"><Button>Проверка</Button></KatranProvider></>, document.getElementById('root'))
`)
write('import.mjs', `const mods = await Promise.all(['@katran/tokens', '@katran/ui', '@katran/effector'].map((m) => import(m)))
for (const m of mods) if (!Object.keys(m).length) throw new Error('пустой модуль')
console.log('импорт в Node: ' + mods.map((m) => Object.keys(m).length).join(' / ') + ' экспортов')
`)

try {
  run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'])
  run('node', ['import.mjs'])
  run('npx', ['vite', 'optimize', '--force'])
  run('npx', ['vite', 'build'])
  const woff2 = readdirSync(join(dir, 'dist/assets')).filter((f) => f.endsWith('.woff2'))
  if (woff2.length !== FONT_COUNT) throw new Error(`в dist/assets файлов woff2: ${woff2.length}, ожидалось ${FONT_COUNT}`)
  console.log(`сборка Vite: ${woff2.length} файлов woff2 в dist/assets`)
  run('npx', ['tsc', '-p', 'tsconfig.json'])
  await checkFonts()
  console.log('Установка тарболов через npm: импорт, предсборка и сборка Vite, типы, шрифты в браузере — в порядке')
} finally {
  rmSync(dir, { recursive: true, force: true })
}

/**
 * Шрифты в браузере: Vite потребителя (его версия из чистого проекта) в dev — с принудительной предсборкой
 * зависимостей, при которой dist/fonts.js кита переезжает в node_modules/.vite, — и готовая сборка через preview.
 * Начертание грузится явно (document.fonts.load) текстом с кириллицей и латиницей: должны загрузиться оба
 * подмножества Sans 600, document.fonts.check — true, отказов сети нет.
 */
async function checkFonts() {
  const { chromium } = await import('@playwright/test')
  const vite = await import(pathToFileURL(join(dir, 'node_modules/vite/dist/node/index.js')).href)
  const browser = await chromium.launch()
  const probe = async (name, url) => {
    const page = await browser.newPage()
    const failed = []
    page.on('requestfailed', (r) => failed.push(r.url()))
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`) })
    try {
      await page.goto(url)
      await page.waitForSelector('[data-k-root] button', { timeout: 15000 })
      const r = await page.evaluate(async () => {
        const faces = await document.fonts.load(`600 12px "IBM Plex Sans"`, 'Проверка Check')
        return { faces: faces.map((f) => `${f.family} ${f.weight} ${f.status}`), check: document.fonts.check(`600 12px "IBM Plex Sans"`, 'Проверка Check') }
      })
      const pass = r.check && r.faces.length === 2 && r.faces.every((f) => f.endsWith('loaded')) && !failed.length
      console.log(`${name}: шрифты ${pass ? 'загружены' : 'НЕ загружены'} — check ${r.check}, начертания: ${r.faces.join('; ') || 'нет'}${failed.length ? `; отказы: ${failed.join(', ')}` : ''}`)
      if (!pass) throw new Error(`${name}: шрифты IBM Plex не загружены`)
    } finally {
      await page.close()
    }
  }
  try {
    const dev = await vite.createServer({ root: dir, logLevel: 'error', server: { port: 5291, strictPort: true }, optimizeDeps: { force: true } })
    await dev.listen()
    try { await probe('Vite dev', 'http://localhost:5291/') } finally { await dev.close() }
    const pv = await vite.preview({ root: dir, logLevel: 'error', preview: { port: 5292, strictPort: true } })
    try { await probe('Vite build', 'http://localhost:5292/') } finally { await new Promise((r) => pv.httpServer.close(r)) }
  } finally {
    await browser.close()
  }
}
