// Проверка установки пакетов кита у потребителя: node scripts/check-install.mjs (после pnpm release:pack).
// Ставит три тарбола из release/ через npm в чистый проект вне монорепо и повторяет путь первой интеграции:
// импорт в Node, предсборка зависимостей Vite (на ней падал хост — «Failed to resolve entry for package»),
// production-сборка и проверка типов. Нужна сеть (npm ставит react, effector, vite) — поэтому не входит в pnpm check;
// запускается в CI отдельной задачей и вручную перед выпуском.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RELEASE = fileURLToPath(new URL('../release', import.meta.url))
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
write('src/css.d.ts', "declare module '*.css'\n")
write('src/main.tsx', `import React from 'react'
import ReactDOM from 'react-dom'
import '@katran/tokens/fonts.css'
import '@katran/ui/styles.css'
import { densityOptions, type Density } from '@katran/tokens'
import { Button, KatranProvider } from '@katran/ui'
import { createFiltersModel, createGridModel } from '@katran/effector'

const density: Density = densityOptions[0]
console.log(density, typeof createFiltersModel, typeof createGridModel)
ReactDOM.render(<KatranProvider defaultTheme="light"><Button>Проверка</Button></KatranProvider>, document.getElementById('root'))
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
  run('npx', ['tsc', '-p', 'tsconfig.json'])
  console.log('Установка тарболов через npm: импорт, предсборка и сборка Vite, типы — в порядке')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
