# Katran — срез 1, план 1 из 3: фундамент и примитивы реестра

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять монорепо katran с пакетом токенов (генерация из одного источника, проверка контраста, шрифты), пакетом `@katran/ui` с провайдером и всеми примитивами, которые понадобятся гриду, и демо-приложением на GitHub Pages со страницей токенов и страницей на каждый компонент.

**Architecture:** pnpm-монорепо из `packages/tokens`, `packages/ui`, `packages/effector` (в этом плане — только заготовка) и `apps/demo`. Токены описаны в `tokens.src.ts`, из него генерируются `tokens.css` и `tokens.ts`; все размерные токены умножены на `--k-density`. Компоненты — чистый React + CSS Modules с детерминированными именами `k-Name__part`, никакого effector. Тултип — один плавающий элемент на документ, управляемый делегированием событий из провайдера.

**Tech Stack:** Node 24, pnpm 10 (через corepack), TypeScript ~5.9, Vite 8 (library mode), vitest 5 + jsdom + Testing Library + jest-axe, eslint 10 (flat) + typescript-eslint + eslint-plugin-import-x + eslint-plugin-jsx-a11y, stylelint 17, `@floating-ui/dom`, `@fontsource/ibm-plex-{sans,mono}`.

**Spec:** `docs/superpowers/specs/2026-09-23-katran-design.md` — разделы 3 (пакеты), 4 (токены), 5.1 (инвентарь среза 1), 9 (качество), 10 (демо).

**Что этот план НЕ делает** (следующие планы): `DataGrid`, `createGridModel`/`createFiltersModel`, `StatusLane`, `FilterPanel`, `BulkBar`, боевой экран реестра, Playwright-замеры. Переполнение `Tabs` в «••• N» — в плане деталки (там много типов MT); здесь табов 3–4. `ThemeSwitch`/`DensitySwitch` — план 2 (ruling 22: в срезе 1 единственный потребитель — демо).

## Global Constraints

- Peer-зависимости: `react >=18`, `react-dom >=18` (спека 3.4). Разработка на React 19.
- Рантайм-зависимости `ui`: только `@katran/tokens` и `@floating-ui/dom` (спека 3.2).
- `ui` не импортирует `effector`; `effector` не импортирует DOM и компоненты `ui` — проверяется `import-x/no-restricted-paths` (спека 3.2).
- Компонентный CSS: никаких голых `px` кроме `border*`, `outline*`, `box-shadow`, `letter-spacing`; никаких hex — только `var(--k-…)` (спека 2.3, 4.3). Проверяется stylelint.
- Имена CSS-классов: `k-<Component>__<part>` (спека 3.3).
- Каждый интерактивный элемент — настоящая `<button>`/`<input>` с доступным именем; `jsx-a11y` в линте, `axe` в тестах (спека 2.4, 9).
- Шрифты — из `@fontsource`, никаких внешних URL (спека 3.4).
- Язык интерфейса и комментариев — русский. Коммиты — на русском. **Без трейлеров `Co-Authored-By` и подписей «Generated with»** — код пойдёт в закрытый контур, явных следов инструментов в истории быть не должно (указание владельца).
- Токены: генерированные файлы коммитятся, CI проверяет `pnpm gen && git diff --exit-code` (спека 4.1).
- Контраст (замерено 2026-09-23 по палитре эталона): `ink`, `ink2` ≥ 4.5 на всех поверхностях; `muted`, `val`, `ok`, `bad`, `warn`, `opt` ≥ 4.5 на `paper`; `muted` ≥ 4.0 на остальных поверхностях; `faint` ≥ 3.0 везде (служебный токен, не для читаемого текста). Пороги — в `contrast.rules.ts`, задача 3.

---

## Карта файлов

```
katran/
  package.json  pnpm-workspace.yaml  .npmrc  tsconfig.base.json  eslint.config.js  stylelint.config.js
  .gitignore  .editorconfig  README.md  CHANGELOG.md
  .github/workflows/ci.yml  .github/workflows/pages.yml
  packages/tokens/
    package.json  tsconfig.json  vitest.config.ts
    src/tokens.src.ts          — единственный источник правды
    src/generate.ts            — renderCss / renderTs (чистые функции)
    src/generate.test.ts
    src/contrast.ts            — luminance / ratio
    src/contrast.rules.ts      — пары и пороги
    src/contrast.test.ts
    scripts/gen.ts             — пишет tokens.css и tokens.ts
    src/tokens.css  src/tokens.ts   — генерируются, коммитятся
    src/fonts.css              — @font-face через @fontsource
    src/index.ts
  packages/ui/
    package.json  tsconfig.json  vite.config.ts  vitest.config.ts  vitest.setup.ts
    src/index.ts
    src/provider/KatranProvider.tsx  .module.css  .test.tsx  index.ts
    src/provider/useKatran.ts
    src/provider/LiveRegion.tsx      — aria-live для «Скопировано»
    src/tooltip/TooltipLayer.tsx  .module.css  .test.tsx  Tooltip.tsx  index.ts
    src/button/Button.tsx  IconButton.tsx  .module.css  .test.tsx  index.ts
    src/input/Input.tsx  Checkbox.tsx  Select.tsx  .module.css  .test.tsx  index.ts
    src/format/date.ts  amount.ts  account.ts  clipboard.ts  *.test.ts  index.ts
    src/value/CopyValue.tsx  LinkValue.tsx  AccountValue.tsx  FieldTag.tsx  StatusDot.tsx  Tag.tsx  Counter.tsx  .module.css  .test.tsx  index.ts
    src/overlay/Popover.tsx  Menu.tsx  .module.css  .test.tsx  index.ts
    src/state/Skeleton.tsx  ProgressBar.tsx  EmptyState.tsx  ErrorState.tsx  useLoadingGate.ts  .module.css  .test.tsx  index.ts
    src/pagination/Pagination.tsx  .module.css  .test.tsx  index.ts
    src/tabs/Tabs.tsx  TabPanel.tsx  Tabs.module.css  Tabs.test.tsx  index.ts
  packages/effector/
    package.json  tsconfig.json  src/index.ts   — заготовка, содержимое в плане 2
  apps/demo/
    package.json  tsconfig.json  vite.config.ts  index.html
    src/main.tsx  App.tsx  router.ts  Shell.tsx  Shell.module.css
    src/pages/TokensPage.tsx  ButtonsPage.tsx  InputsPage.tsx  ValuesPage.tsx  OverlaysPage.tsx  StatesPage.tsx  PaginationPage.tsx  TabsPage.tsx
```

---

### Task 1: Скелет монорепо и CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `README.md`, `CHANGELOG.md`, `.github/workflows/ci.yml`
- Create: `packages/effector/package.json`, `packages/effector/tsconfig.json`, `packages/effector/src/index.ts` (заготовка)

**Interfaces:**
- Produces: скрипты `pnpm gen`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check` (всё вместе); базовый `tsconfig.base.json` с `strict`, `jsx: react-jsx`, `moduleResolution: bundler`.

- [ ] **Step 1: Включить pnpm 10 через corepack**

Run:
```bash
cd /Users/shaman/_CODE/VTB/katran && corepack enable && corepack use pnpm@10 && pnpm -v
```
Expected: печатает `10.x.y`, в `package.json` появляется поле `packageManager`.

- [ ] **Step 2: Корневые файлы**

`package.json` (поле `packageManager` уже вписал corepack — не затирать, дополнить):
```json
{
  "name": "katran",
  "private": true,
  "version": "0.1.0",
  "description": "Дизайн-система katran: React + effector",
  "scripts": {
    "gen": "pnpm --filter @katran/tokens gen",
    "gen:check": "pnpm gen && git diff --exit-code -- packages/tokens/src/tokens.css packages/tokens/src/tokens.ts",
    "lint": "eslint . && stylelint \"packages/ui/src/**/*.css\" \"apps/demo/src/**/*.css\"",
    "test": "pnpm -r --if-present test",
    "build": "pnpm -r --if-present build",
    "check": "pnpm gen:check && pnpm lint && pnpm test && pnpm build"
  },
  "devDependencies": {},
  "engines": { "node": ">=20" }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
  - apps/*
```

`.npmrc`:
```
shared-workspace-lockfile=true
strict-peer-dependencies=false
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "types": []
  }
}
```

`.gitignore` (уже есть в репо — проверить, что содержимое такое):
```
node_modules
dist
coverage
.DS_Store
*.log
.vite
# локальный инструментарий — не часть репозитория
.claude/
```

`.editorconfig`:
```
root = true
[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

`README.md`:
```markdown
# katran

Дизайн-система для интерфейсов проекта: React + effector. Спецификация — `docs/superpowers/specs/2026-09-23-katran-design.md`.

Пакеты: `@katran/tokens` (токены, шрифты), `@katran/ui` (компоненты), `@katran/effector` (модели). Демо — `apps/demo`.

    corepack enable && pnpm install
    pnpm check        # генерация токенов, линт, тесты, сборка
    pnpm --filter demo dev
```

`CHANGELOG.md`:
```markdown
# Changelog

## 0.1.0 — в работе

- Срез 1, план 1: токены, провайдер, примитивы реестра, демо.
```

- [ ] **Step 3: Заготовка `packages/effector`**

`packages/effector/package.json`:
```json
{
  "name": "@katran/effector",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "peerDependencies": { "effector": ">=23", "effector-react": ">=23", "react": ">=18" }
}
```
`packages/effector/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```
`packages/effector/src/index.ts`:
```ts
// Модели появятся в плане 2 (createGridModel, createFiltersModel).
export {}
```

- [ ] **Step 4: Общие dev-зависимости в корень**

Run:
```bash
cd /Users/shaman/_CODE/VTB/katran && pnpm add -Dw typescript@~5.9 eslint@^10 typescript-eslint@^8 eslint-plugin-import-x@^4 eslint-plugin-jsx-a11y@^6 eslint-plugin-react-hooks@^7 stylelint@^17 stylelint-config-standard@^40 tsx@^4 globals
```
Expected: `pnpm-lock.yaml` создан, ошибок нет.

- [ ] **Step 5: eslint и stylelint конфиги**

`eslint.config.js`:
```js
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.css', 'packages/tokens/src/tokens.ts'] },
  ...tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'jsx-a11y': jsxA11y, 'react-hooks': reactHooks },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Граница слоёв (спека 3.2): ui не знает об effector, effector — о DOM/ui
      'import-x/no-restricted-paths': ['error', {
        zones: [
          { target: './packages/ui/src', from: './packages/effector', message: 'ui не импортирует effector' },
          { target: './packages/effector/src', from: './packages/ui/src', except: ['./index.ts'], message: 'effector импортирует из ui только типы через пакет' },
        ],
      }],
      'no-restricted-imports': ['error', { paths: [
        { name: 'effector', message: 'effector разрешён только в packages/effector' },
        { name: 'effector-react', message: 'effector-react разрешён только в packages/effector' },
      ] }],
    },
  },
  {
    files: ['packages/effector/src/**/*.ts', 'apps/demo/src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
```

`stylelint.config.js`:
```js
/** Спека 4.3: размеры только токенами. px допустим лишь там, где плотность не применяется. */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'selector-class-pattern': ['^k-[A-Z][A-Za-z]*(__[a-z][A-Za-z0-9]*)?(--[a-z][A-Za-z0-9]*)?$', {
      message: 'Класс должен быть вида k-Component__part или k-Component--mod',
    }],
    'unit-disallowed-list': [['px', 'rem', 'em'], {
      ignoreProperties: {
        px: ['/^border/', '/^outline/', 'box-shadow', 'letter-spacing', 'text-decoration-thickness', 'text-underline-offset'],
      },
      message: 'Размер должен приходить из токена var(--k-…)',
    }],
    'color-no-hex': true,
    'color-named': 'never',
    'declaration-property-value-disallowed-list': { '/.*/': ['/rgba?\\(/', '/hsla?\\(/'] },
    'custom-property-pattern': '^k-[a-z0-9-]+$',
    'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses: ['global'] }],
  },
}
```

- [ ] **Step 6: CI**

`.github/workflows/ci.yml`:
```yaml
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
```

- [ ] **Step 7: Проверить, что скрипты живы**

Run: `cd /Users/shaman/_CODE/VTB/katran && pnpm install && pnpm lint && pnpm test && pnpm build`
Expected: линт проходит на пустом дереве (кроме `packages/effector/src/index.ts` — без ошибок), `test`/`build` печатают «No projects matched» или просто ничего не делают — ошибок нет.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Скелет монорепо: pnpm, eslint с границей слоёв, stylelint с запретом px, CI"
```

---

### Task 2: `@katran/tokens` — источник и генератор

**Files:**
- Create: `packages/tokens/package.json`, `packages/tokens/tsconfig.json`, `packages/tokens/vitest.config.ts`
- Create: `packages/tokens/src/tokens.src.ts`, `packages/tokens/src/generate.ts`, `packages/tokens/src/generate.test.ts`, `packages/tokens/scripts/gen.ts`, `packages/tokens/src/index.ts`
- Generated: `packages/tokens/src/tokens.css`, `packages/tokens/src/tokens.ts`

**Interfaces:**
- Produces: `TokenSource` (тип источника), `renderCss(src): string`, `renderTs(src): string`; CSS-переменные `--k-<group>-<name>`; TS-объекты `colors.light`, `colors.dark`, `sizes`, `fonts`, `z`, `durations`; `Density = 1 | 1.1 | 1.25`.
- Соглашение имён CSS: цвета `--k-<name>` (`--k-val`, `--k-st-flow`), размеры `--k-fs-1`, `--k-sp-2`, `--k-h-ctl-m`, `--k-r-s`, слои `--k-z-menu`, длительности `--k-t-fast`, шрифты `--k-sans`, `--k-mono`, тень `--k-shadow`.

- [ ] **Step 1: Пакет**

`packages/tokens/package.json`:
```json
{
  "name": "@katran/tokens",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./tokens.css": "./src/tokens.css",
    "./fonts.css": "./src/fonts.css"
  },
  "files": ["src"],
  "scripts": {
    "gen": "tsx scripts/gen.ts",
    "test": "vitest run",
    "build": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": { "vitest": "^5" }
}
```
`packages/tokens/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["node"] }, "include": ["src", "scripts"] }
```
`packages/tokens/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['src/**/*.test.ts'] } })
```
Run: `cd /Users/shaman/_CODE/VTB/katran && pnpm --filter @katran/tokens add -D vitest@^5 @types/node`

- [ ] **Step 2: Источник токенов**

`packages/tokens/src/tokens.src.ts` — палитра из эталона (спека 4.2), размеры (4.3–4.4):
```ts
/** Единственный источник правды. Правится только этот файл; tokens.css и tokens.ts генерируются. */

export type ColorSet = Record<string, string>

export const colorsLight: ColorSet = {
  // поверхности
  ground: '#EEF1F6', paper: '#FFFFFF', sunk: '#F5F7FB', hover: '#F2F6FA', chip: '#EEF0F4',
  // текст
  ink: '#141A29', ink2: '#3A4357', muted: '#6B7488', faint: '#7C8496',
  // линии
  line: '#DCE1EA', line2: '#EAEEF4',
  // акцент — XP-синий, цвет значений
  val: '#3A6EA5', 'val-soft': '#E9EFF7',
  // семантика
  ok: '#17844B', 'ok-soft': '#E3F5EA',
  bad: '#C2372E', 'bad-soft': '#FCE6E4',
  warn: '#A8620B', 'warn-soft': '#FDF1DD', 'warn-row': '#FFF9EE',
  opt: '#B0247A', 'opt-soft': '#FBE8F3',
  fold: '#D0342C',
  // статусы: в движении · внимание · успех · нейтрально
  'st-flow': '#3A6EA5', 'st-flowl': '#6B98C6', 'st-flowd': '#2B5384',
  'st-bad': '#C2372E', 'st-badd': '#8C2B23', 'st-warn': '#A8620B',
  'st-ok': '#17844B', 'st-okl': '#4E9E77', 'st-grey': '#8A93A6',
}

export const colorsDark: ColorSet = {
  ground: '#0E121A', paper: '#161B26', sunk: '#1B2130', hover: '#1B2331', chip: '#232A39',
  ink: '#E6E9F1', ink2: '#C3C9D6', muted: '#949DB0', faint: '#8A93A6',
  line: '#2A3243', line2: '#222938',
  val: '#8FB8E0', 'val-soft': '#1E2B3E',
  ok: '#52CC8A', 'ok-soft': '#173526',
  bad: '#FF7A70', 'bad-soft': '#3D1B19',
  warn: '#F0B44E', 'warn-soft': '#3A2B12', 'warn-row': '#2A2216',
  opt: '#F07CC0', 'opt-soft': '#3A1830',
  fold: '#FF6B61',
  'st-flow': '#7FA9D8', 'st-flowl': '#A9C4E4', 'st-flowd': '#5B8CC4',
  'st-bad': '#FF7A70', 'st-badd': '#E0655C', 'st-warn': '#F0B44E',
  'st-ok': '#52CC8A', 'st-okl': '#8ADCB0', 'st-grey': '#A7B0C2',
}

/** Тени задаются целиком: в них есть rgba, генератор их не трогает. */
export const shadows = {
  light: '0 1px 2px rgba(20,26,41,.06), 0 8px 28px rgba(20,26,41,.08)',
  dark: '0 1px 2px rgba(0,0,0,.3), 0 8px 28px rgba(0,0,0,.35)',
}

/** Размеры в px при плотности 1. Генератор оборачивает каждый в calc(N px * var(--k-density)). */
export const sizes: Record<string, number> = {
  'fs-1': 12.5, 'fs-2': 11, 'fs-3': 10.5, 'fs-h1': 20,
  'lh-1': 17, 'lh-2': 14, 'lh-3': 13,
  'sp-1': 4, 'sp-2': 8, 'sp-3': 12, 'sp-4': 16, 'sp-5': 20, 'sp-6': 24, 'sp-7': 32, 'sp-8': 40,
  'h-ctl-s': 24, 'h-ctl-m': 28, 'h-ctl-l': 32,
  'h-field': 23,
  'r-s': 4, 'r-m': 6,
  'icon-s': 14, 'icon-m': 16,
}

export const fonts = {
  sans: '"IBM Plex Sans", -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
}

export const z = { sticky: 10, drawer: 100, menu: 200, tooltip: 300 }

export const durations = { fast: 120, base: 200, 'sk-show': 200, 'sk-min': 400 }

export const densities = [1, 1.1, 1.25] as const
export type Density = (typeof densities)[number]

export const source = { colorsLight, colorsDark, shadows, sizes, fonts, z, durations, densities }
export type TokenSource = typeof source
```

- [ ] **Step 3: Тест генератора (падает)**

`packages/tokens/src/generate.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { renderCss, renderTs } from './generate'
import { source } from './tokens.src'

describe('renderCss', () => {
  const css = renderCss(source)

  it('светлая тема в :root, цвета с префиксом --k-', () => {
    expect(css).toMatch(/:root\s*{[^}]*--k-val:\s*#3A6EA5/)
    expect(css).toMatch(/:root\s*{[^}]*--k-st-flow:\s*#3A6EA5/)
  })

  it('тёмная тема — по атрибуту и по системной настройке без явной светлой', () => {
    expect(css).toMatch(/\[data-theme="dark"\]\s*{[^}]*--k-val:\s*#8FB8E0/)
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\)\s*{\s*:root:not\(\[data-theme="light"\]\)\s*{[^}]*--k-val:\s*#8FB8E0/)
  })

  it('размеры умножены на плотность', () => {
    expect(css).toContain('--k-fs-1: calc(12.5px * var(--k-density))')
    expect(css).toContain('--k-h-ctl-m: calc(28px * var(--k-density))')
  })

  it('плотность по умолчанию 1, шрифты, слои, длительности, тень', () => {
    expect(css).toMatch(/:root\s*{[^}]*--k-density:\s*1;/)
    expect(css).toContain('--k-sans: "IBM Plex Sans"')
    expect(css).toContain('--k-z-menu: 200')
    expect(css).toContain('--k-t-fast: 120ms')
    expect(css).toMatch(/:root\s*{[^}]*--k-shadow: 0 1px 2px rgba\(20,26,41,\.06\)/)
  })
})

describe('renderTs', () => {
  const ts = renderTs(source)
  it('экспортирует цвета обеих тем и размеры', () => {
    expect(ts).toContain("export const colors = {")
    expect(ts).toContain("'st-flow': '#3A6EA5'")
    expect(ts).toContain("'st-flow': '#7FA9D8'")
    expect(ts).toContain("'fs-1': 12.5")
  })
  it('помечен как сгенерированный', () => {
    expect(ts.startsWith('// Сгенерировано из tokens.src.ts')).toBe(true)
  })
})
```

Run: `pnpm --filter @katran/tokens test`
Expected: FAIL — `./generate` не найден.

- [ ] **Step 4: Генератор**

`packages/tokens/src/generate.ts`:
```ts
import type { ColorSet, TokenSource } from './tokens.src'

const colorLines = (c: ColorSet, indent: string) =>
  Object.entries(c).map(([k, v]) => `${indent}--k-${k}: ${v};`).join('\n')

export function renderCss(src: TokenSource): string {
  const { colorsLight, colorsDark, shadows, sizes, fonts, z, durations } = src
  const sizeLines = Object.entries(sizes)
    .map(([k, v]) => `  --k-${k}: calc(${v}px * var(--k-density));`).join('\n')
  const fontLines = Object.entries(fonts).map(([k, v]) => `  --k-${k}: ${v};`).join('\n')
  const zLines = Object.entries(z).map(([k, v]) => `  --k-z-${k}: ${v};`).join('\n')
  const tLines = Object.entries(durations).map(([k, v]) => `  --k-t-${k}: ${v}ms;`).join('\n')
  const dark = `${colorLines(colorsDark, '    ')}\n    --k-shadow: ${shadows.dark};`

  return `/* Сгенерировано из tokens.src.ts — не править руками. pnpm gen */
:root {
  --k-density: 1;
${colorLines(colorsLight, '  ')}
  --k-shadow: ${shadows.light};
${sizeLines}
${fontLines}
${zLines}
${tLines}
}
[data-theme="dark"] {
${dark.replace(/^ {4}/gm, '  ')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
${dark}
  }
}
`
}

const obj = (o: Record<string, string | number>, indent = '  ') =>
  Object.entries(o).map(([k, v]) => `${indent}'${k}': ${typeof v === 'number' ? v : `'${v}'`},`).join('\n')

export function renderTs(src: TokenSource): string {
  return `// Сгенерировано из tokens.src.ts — не править руками. pnpm gen
export const colors = {
  light: {
${obj(src.colorsLight, '    ')}
  },
  dark: {
${obj(src.colorsDark, '    ')}
  },
} as const

export const sizes = {
${obj(src.sizes)}
} as const

export const fonts = {
${obj(src.fonts)}
} as const

export const z = {
${obj(src.z)}
} as const

export const durations = {
${obj(src.durations)}
} as const

export const densities = [${src.densities.join(', ')}] as const
export type Density = (typeof densities)[number]
export type ColorName = keyof typeof colors.light
export type SizeName = keyof typeof sizes
`
}
```

- [ ] **Step 5: Тест проходит**

Run: `pnpm --filter @katran/tokens test`
Expected: PASS, 6 тестов.

- [ ] **Step 6: Скрипт генерации и индекс**

`packages/tokens/scripts/gen.ts`:
```ts
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderCss, renderTs } from '../src/generate'
import { source } from '../src/tokens.src'

const out = (name: string) => resolve(import.meta.dirname, '../src', name)
writeFileSync(out('tokens.css'), renderCss(source))
writeFileSync(out('tokens.ts'), renderTs(source))
console.log('tokens.css и tokens.ts обновлены')
```

`packages/tokens/src/index.ts`:
```ts
export * from './tokens'
export { densities as densityOptions } from './tokens.src'
export type { Density } from './tokens.src'
```

Run: `pnpm gen && head -5 packages/tokens/src/tokens.css && pnpm gen:check`
Expected: файлы созданы; `gen:check` завершается с кодом 0 после `git add` (ниже).

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "Токены: источник, генератор tokens.css и tokens.ts, плотность в размерах"
```

---

### Task 3: Проверка контраста палитры

**Files:**
- Create: `packages/tokens/src/contrast.ts`, `packages/tokens/src/contrast.rules.ts`, `packages/tokens/src/contrast.test.ts`

**Interfaces:**
- Produces: `contrastRatio(fgHex, bgHex): number`, `rules: ContrastRule[]` где `ContrastRule = { fg: string; bg: string[]; min: number; note: string }`; `checkPalette(colors, rules): Violation[]`.

- [ ] **Step 1: Тест (падает)**

`packages/tokens/src/contrast.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { checkPalette, contrastRatio } from './contrast'
import { rules } from './contrast.rules'
import { colorsDark, colorsLight } from './tokens.src'

describe('contrastRatio', () => {
  it('чёрный на белом = 21, белый на белом = 1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1)
  })
  it('faint на paper — 3.75 (замер 2026-09-23)', () => {
    expect(contrastRatio(colorsLight.faint!, colorsLight.paper!)).toBeCloseTo(3.75, 1)
  })
})

describe('палитра соответствует правилам', () => {
  it('светлая', () => {
    expect(checkPalette(colorsLight, rules)).toEqual([])
  })
  it('тёмная', () => {
    expect(checkPalette(colorsDark, rules)).toEqual([])
  })
  it('нарушение обнаруживается', () => {
    const broken = { ...colorsLight, ink: '#CCCCCC' }
    const v = checkPalette(broken, rules)
    expect(v.length).toBeGreaterThan(0)
    expect(v[0]).toMatchObject({ fg: 'ink', bg: 'paper' })
  })
})
```

Run: `pnpm --filter @katran/tokens test`
Expected: FAIL — модули не найдены.

- [ ] **Step 2: Реализация**

`packages/tokens/src/contrast.ts`:
```ts
import type { ColorSet } from './tokens.src'

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

export function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{2}/g)
  if (!m || m.length < 3) throw new Error(`Не hex-цвет: ${hex}`)
  const [r, g, b] = m.map((x) => channel(parseInt(x, 16) / 255)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fg: string, bg: string): number {
  const a = luminance(fg), b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

export type ContrastRule = { fg: string; bg: string[]; min: number; note: string }
export type Violation = { fg: string; bg: string; ratio: number; min: number; note: string }

export function checkPalette(colors: ColorSet, rules: ContrastRule[]): Violation[] {
  const out: Violation[] = []
  for (const r of rules) for (const bg of r.bg) {
    const f = colors[r.fg], b = colors[bg]
    if (!f || !b) throw new Error(`Нет токена ${!f ? r.fg : bg}`)
    const ratio = contrastRatio(f, b)
    if (ratio < r.min) out.push({ fg: r.fg, bg, ratio: +ratio.toFixed(2), min: r.min, note: r.note })
  }
  return out
}
```

`packages/tokens/src/contrast.rules.ts`:
```ts
import type { ContrastRule } from './contrast'

const surfaces = ['paper', 'sunk', 'ground', 'hover', 'chip', 'val-soft']
const others = ['sunk', 'ground', 'hover', 'chip', 'val-soft']

/** Пороги зафиксированы по замеру эталона 2026-09-23 (спека, Global Constraints плана 1). */
export const rules: ContrastRule[] = [
  { fg: 'ink', bg: surfaces, min: 4.5, note: 'основной текст' },
  { fg: 'ink2', bg: surfaces, min: 4.5, note: 'названия полей' },
  { fg: 'muted', bg: ['paper'], min: 4.5, note: 'подписи на бумаге' },
  { fg: 'muted', bg: others, min: 4.0, note: 'подписи на подложках — крупный текст' },
  { fg: 'val', bg: ['paper', 'val-soft'], min: 4.5, note: 'значения' },
  { fg: 'ok', bg: ['paper', 'ok-soft'], min: 4.5, note: 'успех' },
  { fg: 'bad', bg: ['paper', 'bad-soft'], min: 4.5, note: 'ошибка' },
  { fg: 'warn', bg: ['paper', 'warn-soft'], min: 4.5, note: 'внимание' },
  { fg: 'opt', bg: ['paper', 'opt-soft'], min: 4.5, note: 'теги полей' },
  { fg: 'faint', bg: surfaces, min: 3.0, note: 'служебный токен, не для читаемого текста' },
  { fg: 'paper', bg: ['val'], min: 4.5, note: 'текст на primary-кнопке' },
]
```

- [ ] **Step 3: Тест проходит**

Run: `pnpm --filter @katran/tokens test`
Expected: PASS. Если тёмная палитра нарушает пару `*-soft` — записать фактическое число в отчёт задачи и поднять вопрос владельцу, порог не снижать молча.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Проверка контраста палитры в тестах токенов"
```

---

### Task 4: Шрифты в пакете токенов

**Files:**
- Create: `packages/tokens/src/fonts.css`

**Interfaces:**
- Produces: импорт `@katran/tokens/fonts.css` подключает IBM Plex Sans 400/500/600/700 и IBM Plex Mono 400/500/600 с кириллицей, без внешних URL.

- [ ] **Step 1: Зависимости**

Run: `pnpm --filter @katran/tokens add @fontsource/ibm-plex-sans@^5 @fontsource/ibm-plex-mono@^5`

- [ ] **Step 2: `fonts.css`**

```css
/* Шрифты вшиты через @fontsource — в банковской сети внешних ресурсов нет (спека 3.4). */
@import '@fontsource/ibm-plex-sans/cyrillic-400.css';
@import '@fontsource/ibm-plex-sans/cyrillic-500.css';
@import '@fontsource/ibm-plex-sans/cyrillic-600.css';
@import '@fontsource/ibm-plex-sans/cyrillic-700.css';
@import '@fontsource/ibm-plex-sans/latin-400.css';
@import '@fontsource/ibm-plex-sans/latin-500.css';
@import '@fontsource/ibm-plex-sans/latin-600.css';
@import '@fontsource/ibm-plex-sans/latin-700.css';
@import '@fontsource/ibm-plex-mono/cyrillic-400.css';
@import '@fontsource/ibm-plex-mono/cyrillic-500.css';
@import '@fontsource/ibm-plex-mono/cyrillic-600.css';
@import '@fontsource/ibm-plex-mono/latin-400.css';
@import '@fontsource/ibm-plex-mono/latin-500.css';
@import '@fontsource/ibm-plex-mono/latin-600.css';
```

- [ ] **Step 3: Проверить, что файлы существуют**

Run: `ls packages/tokens/node_modules/@fontsource/ibm-plex-sans/cyrillic-400.css packages/tokens/node_modules/@fontsource/ibm-plex-mono/latin-600.css`
Expected: оба пути напечатаны. (Реальная проверка загрузки — в демо, задача 14.)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Шрифты IBM Plex через @fontsource, без внешних URL"
```

---

### Task 5: Пакет `@katran/ui`: сборка, тест-инфра, `KatranProvider`

**Files:**
- Create: `packages/ui/package.json`, `packages/ui/tsconfig.json`, `packages/ui/vite.config.ts`, `packages/ui/vitest.config.ts`, `packages/ui/vitest.setup.ts`, `packages/ui/src/index.ts`, `packages/ui/src/css-modules.d.ts`
- Create: `packages/ui/src/provider/KatranProvider.tsx`, `KatranProvider.module.css`, `KatranProvider.test.tsx`, `useKatran.ts`, `LiveRegion.tsx`, `index.ts`

**Interfaces:**
- Produces: `<KatranProvider theme? density? defaultTheme? defaultDensity? storageKey?>`; `useKatran(): { theme, density, setTheme, setDensity, announce(text) }`; `Theme = 'light' | 'dark' | 'system'`; `Density` из токенов. Корневой `div.k-Provider__root` несёт `data-theme` (кроме `system`) и `style="--k-density: N"`. Внутри — `LiveRegion` (`role="status"`, визуально скрыт) для объявлений скринридеру; тултип-слой добавится в задаче 9.
- Тест-инфра: `vitest.setup.ts` подключает `@testing-library/jest-dom/vitest` и `jest-axe` (`expect.extend(toHaveNoViolations)`); хелпер `renderK(ui)` оборачивает в провайдер.

- [ ] **Step 1: Пакет и зависимости**

`packages/ui/package.json`:
```json
{
  "name": "@katran/ui",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts", "./styles.css": "./dist/ui.css" },
  "files": ["src", "dist"],
  "sideEffects": ["**/*.css"],
  "scripts": { "test": "vitest run", "build": "vite build && tsc -p tsconfig.json --noEmit" },
  "dependencies": { "@katran/tokens": "workspace:*", "@floating-ui/dom": "^1.8" },
  "peerDependencies": { "react": ">=18", "react-dom": ">=18" }
}
```
Run:
```bash
pnpm --filter @katran/ui add -D react@^19 react-dom@^19 @types/react@^19 @types/react-dom@^19 vite@^8 @vitejs/plugin-react@^6 vite-plugin-dts@^5 vitest@^5 jsdom@^30 @testing-library/react@^16 @testing-library/jest-dom@^7 @testing-library/user-event@^14 jest-axe@^11 @types/jest-axe
```

`packages/ui/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "types": ["vitest/globals", "@testing-library/jest-dom"] }, "include": ["src", "vitest.setup.ts"] }
```
`packages/ui/src/css-modules.d.ts`:
```ts
declare module '*.module.css' { const classes: Record<string, string>; export default classes }
```

- [ ] **Step 2: Vite и vitest**

`packages/ui/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [react(), dts({ include: ['src'], exclude: ['**/*.test.*'] })],
  // Детерминированные имена классов: k-Component__part (спека 3.3). Хеша нет намеренно.
  css: { modules: { generateScopedName: 'k-[name]__[local]', localsConvention: 'camelCaseOnly' } },
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'ui' },
    cssFileName: 'ui',
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', '@katran/tokens'] },
    sourcemap: true,
  },
})
```
Имя модуля `[name]` — это имя файла без `.module.css`; поэтому файл стилей провайдера называется `Provider.module.css`, а не `KatranProvider.module.css` — иначе класс получится `k-KatranProvider__root`. Переименовать: в карте файлов и ниже используется `Provider.module.css`.

`packages/ui/vitest.config.ts`:
```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'], css: { modules: { classNameStrategy: 'non-scoped' } } },
}))
```
`classNameStrategy: 'non-scoped'` — в тестах классы остаются как написаны (`root`), проверки по классам в тестах не делаем, только по ролям.

`packages/ui/vitest.setup.ts`:
```ts
import '@testing-library/jest-dom/vitest'
import { toHaveNoViolations } from 'jest-axe'
import { expect } from 'vitest'
expect.extend(toHaveNoViolations)
```

- [ ] **Step 3: Тест провайдера (падает)**

`packages/ui/src/provider/KatranProvider.test.tsx`:
```tsx
import { act, render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { KatranProvider } from './KatranProvider'
import { useKatran } from './useKatran'

function Probe() {
  const k = useKatran()
  return (
    <div>
      <span data-testid="t">{k.theme}</span>
      <span data-testid="d">{k.density}</span>
      <button onClick={() => k.setTheme('dark')}>тёмная</button>
      <button onClick={() => k.setDensity(1.25)}>крупнее</button>
      <button onClick={() => k.announce('Скопировано')}>объявить</button>
    </div>
  )
}

describe('KatranProvider', () => {
  beforeEach(() => localStorage.clear())

  it('по умолчанию system и плотность 1; корень несёт переменную плотности', () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    expect(screen.getByTestId('t')).toHaveTextContent('system')
    expect(screen.getByTestId('d')).toHaveTextContent('1')
    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue('--k-density')).toBe('1')
    expect(root).not.toHaveAttribute('data-theme')
  })

  it('setTheme / setDensity меняют атрибуты и сохраняются по storageKey', () => {
    const { container } = render(<KatranProvider storageKey="t"><Probe /></KatranProvider>)
    act(() => screen.getByText('тёмная').click())
    act(() => screen.getByText('крупнее').click())
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('data-theme', 'dark')
    expect(root.style.getPropertyValue('--k-density')).toBe('1.25')
    expect(localStorage.getItem('t:theme')).toBe('dark')
    expect(localStorage.getItem('t:density')).toBe('1.25')
  })

  it('читает сохранённое при монтировании', () => {
    localStorage.setItem('t:density', '1.1')
    render(<KatranProvider storageKey="t"><Probe /></KatranProvider>)
    expect(screen.getByTestId('d')).toHaveTextContent('1.1')
  })

  it('управляемый режим: props важнее внутреннего состояния', () => {
    const { container } = render(<KatranProvider theme="light" density={1.1}><Probe /></KatranProvider>)
    act(() => screen.getByText('тёмная').click())
    expect(container.firstElementChild).toHaveAttribute('data-theme', 'light')
  })

  it('announce пишет в живую область', () => {
    render(<KatranProvider><Probe /></KatranProvider>)
    act(() => screen.getByText('объявить').click())
    expect(screen.getByRole('status')).toHaveTextContent('Скопировано')
  })

  it('без нарушений axe', async () => {
    const { container } = render(<KatranProvider><Probe /></KatranProvider>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test`
Expected: FAIL — модули не найдены.

- [ ] **Step 4: Реализация провайдера**

`packages/ui/src/provider/useKatran.ts`:
```ts
import { createContext, useContext } from 'react'
import type { Density } from '@katran/tokens'

export type Theme = 'light' | 'dark' | 'system'
export type KatranContextValue = {
  theme: Theme
  density: Density
  setTheme: (t: Theme) => void
  setDensity: (d: Density) => void
  /** Сообщение для скринридера (role=status). */
  announce: (text: string) => void
}

export const KatranContext = createContext<KatranContextValue | null>(null)

export function useKatran(): KatranContextValue {
  const v = useContext(KatranContext)
  if (!v) throw new Error('useKatran: компонент должен быть внутри <KatranProvider>')
  return v
}
```

`packages/ui/src/provider/LiveRegion.tsx`:
```tsx
import { forwardRef, useImperativeHandle, useState } from 'react'
import s from './Provider.module.css'

export type LiveRegionHandle = { announce: (text: string) => void }

/** Одна живая область на провайдер. Текст перезаписывается — скринридер читает последнее. */
export const LiveRegion = forwardRef<LiveRegionHandle>(function LiveRegion(_, ref) {
  const [text, setText] = useState('')
  useImperativeHandle(ref, () => ({
    announce: (t) => { setText(''); requestAnimationFrame(() => setText(t)) },
  }), [])
  return <div role="status" aria-live="polite" className={s.live}>{text}</div>
})
```

`packages/ui/src/provider/KatranProvider.tsx`:
```tsx
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { densityOptions, type Density } from '@katran/tokens'
import { KatranContext, type Theme } from './useKatran'
import { LiveRegion, type LiveRegionHandle } from './LiveRegion'
import s from './Provider.module.css'

export type KatranProviderProps = {
  children: ReactNode
  /** Управляемые значения. Если заданы — внутреннее состояние не используется. */
  theme?: Theme
  density?: Density
  defaultTheme?: Theme
  defaultDensity?: Density
  /** Ключ localStorage; без него ничего не сохраняется. */
  storageKey?: string
}

const isDensity = (v: unknown): v is Density => densityOptions.includes(v as Density)
const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system'

function read<T>(key: string | undefined, name: string, ok: (v: unknown) => v is T): T | undefined {
  if (!key) return undefined
  try {
    const raw = localStorage.getItem(`${key}:${name}`)
    if (raw == null) return undefined
    const v = name === 'density' ? Number(raw) : raw
    return ok(v) ? v : undefined
  } catch { return undefined }
}
function write(key: string | undefined, name: string, v: string | number) {
  if (!key) return
  try { localStorage.setItem(`${key}:${name}`, String(v)) } catch { /* приватный режим — молча */ }
}

/** Плотность по умолчанию: 1.25 на широких мониторах (эталон: 2K при 100 % мелко). */
function autoDensity(): Density {
  return typeof screen !== 'undefined' && screen.width >= 2200 ? 1.25 : 1
}

export function KatranProvider(p: KatranProviderProps) {
  const [themeS, setThemeS] = useState<Theme>(() => read(p.storageKey, 'theme', isTheme) ?? p.defaultTheme ?? 'system')
  const [densityS, setDensityS] = useState<Density>(() => read(p.storageKey, 'density', isDensity) ?? p.defaultDensity ?? autoDensity())
  const theme = p.theme ?? themeS
  const density = p.density ?? densityS
  const live = useRef<LiveRegionHandle>(null)

  const setTheme = useCallback((t: Theme) => { setThemeS(t); write(p.storageKey, 'theme', t) }, [p.storageKey])
  const setDensity = useCallback((d: Density) => { setDensityS(d); write(p.storageKey, 'density', d) }, [p.storageKey])
  const announce = useCallback((t: string) => live.current?.announce(t), [])

  useEffect(() => {
    if (p.theme && p.theme !== themeS) setThemeS(p.theme)
  }, [p.theme, themeS])

  const value = useMemo(() => ({ theme, density, setTheme, setDensity, announce }), [theme, density, setTheme, setDensity, announce])

  return (
    <KatranContext.Provider value={value}>
      <div
        className={s.root}
        data-theme={theme === 'system' ? undefined : theme}
        style={{ '--k-density': String(density) } as React.CSSProperties}
      >
        {p.children}
        <LiveRegion ref={live} />
      </div>
    </KatranContext.Provider>
  )
}
```

`packages/ui/src/provider/Provider.module.css`:
```css
.root {
  font-family: var(--k-sans);
  font-size: var(--k-fs-1);
  line-height: var(--k-lh-1);
  color: var(--k-ink);
  background: var(--k-paper);
  min-height: 100%;
}

.live {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```
Файл называется `Provider.module.css`, чтобы имя класса вышло `k-Provider__root`.

`packages/ui/src/provider/index.ts`:
```ts
export { KatranProvider, type KatranProviderProps } from './KatranProvider'
export { useKatran, type Theme, type KatranContextValue } from './useKatran'
```
`packages/ui/src/index.ts`:
```ts
import '@katran/tokens/tokens.css'
export * from './provider'
```

- [ ] **Step 5: Тест проходит**

Run: `pnpm --filter @katran/ui test`
Expected: PASS, 6 тестов. Если `announce` в jsdom не успевает за `requestAnimationFrame` — в тесте обернуть клик в `await act(async () => { ...; await new Promise(r => requestAnimationFrame(r)) })`.

- [ ] **Step 6: Сборка и линт**

Run: `pnpm --filter @katran/ui build && ls packages/ui/dist && pnpm lint`
Expected: `dist/ui.js`, `dist/ui.css`, `dist/index.d.ts`; линт чистый. `dist/ui.css` содержит `.k-Provider__root`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "Пакет ui: сборка Vite lib, vitest с axe, KatranProvider с темой, плотностью и живой областью"
```

---

### Task 6: `Button`, `IconButton`

**Files:**
- Create: `packages/ui/src/button/Button.tsx`, `IconButton.tsx`, `Button.module.css`, `Button.test.tsx`, `index.ts`
- Create: `packages/ui/src/test/renderK.tsx`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `<Button variant='primary'|'ghost' size='s'|'m'|'l' pressed? …ButtonHTMLAttributes>`; `<IconButton label: string size pressed? …>` — `label` обязателен и уходит в `aria-label`; `pressed` → `aria-pressed`. `renderK(ui)` — рендер внутри `KatranProvider` для тестов.
- Из эталона: primary — фон `val`, текст `paper`; ghost — фон `paper`, рамка `line`, текст `ink2`, при наведении рамка и текст `val`; нажатая (`aria-pressed=true`) — фон `val-soft`, текст `val`; фокус — `outline: 2px solid var(--k-val)` со смещением 1px.

- [ ] **Step 1: Хелпер тестов**

`packages/ui/src/test/renderK.tsx`:
```tsx
import { render, type RenderOptions } from '@testing-library/react'
import type { ReactElement } from 'react'
import { KatranProvider } from '../provider'

export const renderK = (ui: ReactElement, o?: RenderOptions) =>
  render(ui, { wrapper: ({ children }) => <KatranProvider>{children}</KatranProvider>, ...o })
```

- [ ] **Step 2: Тест (падает)**

`packages/ui/src/button/Button.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Button } from './Button'
import { IconButton } from './IconButton'

describe('Button', () => {
  it('кнопка с именем, type=button по умолчанию, клик', async () => {
    const onClick = vi.fn()
    renderK(<Button onClick={onClick}>Применить</Button>)
    const b = screen.getByRole('button', { name: 'Применить' })
    expect(b).toHaveAttribute('type', 'button')
    await userEvent.click(b)
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('pressed → aria-pressed', () => {
    renderK(<Button pressed>Скелетоны</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })
  it('disabled не кликается', async () => {
    const onClick = vi.fn()
    renderK(<Button disabled onClick={onClick}>Нет</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('IconButton', () => {
  it('имя из label, иконка скрыта от скринридера', () => {
    renderK(<IconButton label="Открыть деталку"><svg data-testid="i" /></IconButton>)
    expect(screen.getByRole('button', { name: 'Открыть деталку' })).toBeInTheDocument()
    expect(screen.getByTestId('i').parentElement).toHaveAttribute('aria-hidden', 'true')
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<><Button>Ок</Button><IconButton label="Меню"><svg /></IconButton></>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test button`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`packages/ui/src/button/Button.tsx`:
```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import s from './Button.module.css'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost'
  size?: 's' | 'm' | 'l'
  /** Переключатель: aria-pressed. */
  pressed?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'ghost', size = 'm', pressed, className, type = 'button', ...rest }, ref,
) {
  const cls = [s.button, s[variant], s[`size${size.toUpperCase()}`], className].filter(Boolean).join(' ')
  return <button ref={ref} type={type} className={cls} aria-pressed={pressed} {...rest} />
})
```

`packages/ui/src/button/IconButton.tsx`:
```tsx
import { forwardRef, type ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'
import s from './Button.module.css'

export type IconButtonProps = Omit<ButtonProps, 'children' | 'variant'> & {
  /** Доступное имя — обязательно: у иконки текста нет. */
  label: string
  children: ReactNode
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className, ...rest }, ref,
) {
  return (
    <Button ref={ref} variant="ghost" aria-label={label} className={[s.icon, className].filter(Boolean).join(' ')} {...rest}>
      <span aria-hidden="true" className={s.glyph}>{children}</span>
    </Button>
  )
})
```

`packages/ui/src/button/Button.module.css`:
```css
.button {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-1);
  padding: 0 var(--k-sp-3);
  border: 1px solid transparent;
  border-radius: var(--k-r-m);
  font: 500 var(--k-fs-1) / 1 var(--k-sans);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--k-t-fast), border-color var(--k-t-fast), color var(--k-t-fast);
}
.button:disabled { opacity: 0.5; cursor: default; }
.button:focus-visible { outline: 2px solid var(--k-val); outline-offset: 1px; }

.sizeS { height: var(--k-h-ctl-s); font-size: var(--k-fs-2); padding: 0 var(--k-sp-2); }
.sizeM { height: var(--k-h-ctl-m); }
.sizeL { height: var(--k-h-ctl-l); }

.primary { background: var(--k-val); border-color: var(--k-val); color: var(--k-paper); }
.primary:hover:not(:disabled) { filter: brightness(0.95); }

.ghost { background: var(--k-paper); border-color: var(--k-line); color: var(--k-ink2); }
.ghost:hover:not(:disabled) { border-color: var(--k-val); color: var(--k-val); }
.ghost[aria-pressed="true"] { background: var(--k-val-soft); border-color: var(--k-val); color: var(--k-val); }

.icon { padding: 0; aspect-ratio: 1; justify-content: center; }
.glyph { display: inline-grid; place-items: center; }
.glyph > svg { width: var(--k-icon-s); height: var(--k-icon-s); }
```

`packages/ui/src/button/index.ts`:
```ts
export { Button, type ButtonProps } from './Button'
export { IconButton, type IconButtonProps } from './IconButton'
```
В `packages/ui/src/index.ts` добавить `export * from './button'`.

- [ ] **Step 4: Тест проходит, линт чистый**

Run: `pnpm --filter @katran/ui test button && pnpm lint`
Expected: PASS, 5 тестов; stylelint без замечаний (в CSS нет голых px кроме `border`/`outline`).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Button и IconButton: варианты primary/ghost, размеры, aria-pressed, обязательное имя иконки"
```

---

### Task 7: `Input`, `Checkbox`, `Select`

**Files:**
- Create: `packages/ui/src/input/Input.tsx`, `Checkbox.tsx`, `Select.tsx`, `Input.module.css`, `Input.test.tsx`, `index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces: `<Input size='s'|'m'|'l' invalid? prefix? …InputHTMLAttributes>` (нативный `<input>`, `invalid` → `aria-invalid`, рамка `bad`); `<Checkbox label? indeterminate? …>` (нативный чекбокс, `indeterminate` через ref; `label` — видимая подпись, иначе нужен `aria-label` от вызывающего); `<Select options: {value,label,disabled?}[] size placeholder? …SelectHTMLAttributes>` (нативный `<select>`).
- Стиль из эталона: высота `h-ctl-*`, рамка `line`, радиус `r-m`, фон `paper`, фокус — рамка `val` + `outline`.

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/input/Input.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Checkbox } from './Checkbox'
import { Input } from './Input'
import { Select } from './Select'

describe('Input', () => {
  it('ввод и aria-invalid', async () => {
    const onChange = vi.fn()
    renderK(<Input aria-label="Номер" invalid onChange={onChange} />)
    const i = screen.getByRole('textbox', { name: 'Номер' })
    expect(i).toHaveAttribute('aria-invalid', 'true')
    await userEvent.type(i, 'ab')
    expect(onChange).toHaveBeenCalledTimes(2)
  })
})

describe('Checkbox', () => {
  it('подпись даёт имя; indeterminate выставляется на элемент', () => {
    renderK(<Checkbox label="Выбрать все" indeterminate />)
    const c = screen.getByRole('checkbox', { name: 'Выбрать все' }) as HTMLInputElement
    expect(c.indeterminate).toBe(true)
  })
  it('переключается', async () => {
    const onChange = vi.fn()
    renderK(<Checkbox label="Один" onChange={onChange} />)
    await userEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledOnce()
  })
})

describe('Select', () => {
  it('опции и выбор', async () => {
    const onChange = vi.fn()
    renderK(<Select aria-label="Тип" options={[{ value: 'MT103', label: 'MT103' }, { value: 'MT202', label: 'MT202' }]} onChange={onChange} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Тип' }), 'MT202')
    expect(onChange).toHaveBeenCalledOnce()
    expect(screen.getByRole('option', { name: 'MT202' })).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<>
      <Input aria-label="a" /><Checkbox label="b" /><Select aria-label="c" options={[{ value: '1', label: '1' }]} />
    </>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test input`
Expected: FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/input/Input.tsx`:
```tsx
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import s from './Input.module.css'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> & {
  size?: 's' | 'm' | 'l'
  invalid?: boolean
  /** Иконка или текст слева от поля (например, лупа поиска). */
  prefix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'm', invalid, prefix, className, ...rest }, ref,
) {
  return (
    <span className={[s.field, s[`size${size.toUpperCase()}`], invalid ? s.invalid : '', className].filter(Boolean).join(' ')}>
      {prefix && <span aria-hidden="true" className={s.prefix}>{prefix}</span>}
      <input ref={ref} className={s.input} aria-invalid={invalid || undefined} {...rest} />
    </span>
  )
})
```

`packages/ui/src/input/Checkbox.tsx`:
```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes } from 'react'
import s from './Input.module.css'

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string
  /** Третье состояние (часть записей выбрана). Только визуальное; checked остаётся как есть. */
  indeterminate?: boolean
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className, ...rest }, ref,
) {
  const inner = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inner.current as HTMLInputElement)
  useEffect(() => { if (inner.current) inner.current.indeterminate = indeterminate }, [indeterminate])
  const input = <input ref={inner} type="checkbox" className={s.checkbox} {...rest} />
  if (!label) return input
  return <label className={[s.check, className].filter(Boolean).join(' ')}>{input}<span>{label}</span></label>
})
```

`packages/ui/src/input/Select.tsx`:
```tsx
import { forwardRef, type SelectHTMLAttributes } from 'react'
import s from './Input.module.css'

export type SelectOption = { value: string; label: string; disabled?: boolean }
export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> & {
  options: SelectOption[]
  size?: 's' | 'm' | 'l'
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, size = 'm', placeholder, className, ...rest }, ref,
) {
  return (
    <span className={[s.field, s[`size${size.toUpperCase()}`], className].filter(Boolean).join(' ')}>
      <select ref={ref} className={s.select} {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </span>
  )
})
```

`packages/ui/src/input/Input.module.css`:
```css
.field {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-1);
  padding: 0 var(--k-sp-2);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-m);
  background: var(--k-paper);
  color: var(--k-ink);
  transition: border-color var(--k-t-fast);
}
.field:focus-within { border-color: var(--k-val); outline: 2px solid var(--k-val); outline-offset: 1px; }
.invalid { border-color: var(--k-bad); }
.invalid:focus-within { border-color: var(--k-bad); outline-color: var(--k-bad); }

.sizeS { height: var(--k-h-ctl-s); font-size: var(--k-fs-2); }
.sizeM { height: var(--k-h-ctl-m); font-size: var(--k-fs-1); }
.sizeL { height: var(--k-h-ctl-l); font-size: var(--k-fs-1); }

.prefix { display: inline-grid; place-items: center; color: var(--k-muted); }
.prefix > svg { width: var(--k-icon-s); height: var(--k-icon-s); }

.input, .select {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  color: inherit;
  height: 100%;
}
.input::placeholder { color: var(--k-faint); }
.select { cursor: pointer; padding-right: var(--k-sp-1); }

.check { display: inline-flex; align-items: center; gap: var(--k-sp-2); cursor: pointer; font-size: var(--k-fs-1); color: var(--k-ink); }
.checkbox { width: var(--k-icon-m); height: var(--k-icon-m); margin: 0; accent-color: var(--k-val); cursor: pointer; }
.checkbox:focus-visible { outline: 2px solid var(--k-val); outline-offset: 1px; }
```

`packages/ui/src/input/index.ts`:
```ts
export { Input, type InputProps } from './Input'
export { Checkbox, type CheckboxProps } from './Checkbox'
export { Select, type SelectProps, type SelectOption } from './Select'
```
В `packages/ui/src/index.ts` добавить `export * from './input'`.

- [ ] **Step 3: Тест проходит, линт**

Run: `pnpm --filter @katran/ui test input && pnpm lint`
Expected: PASS, 5 тестов.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Input, Checkbox с indeterminate, Select на нативных элементах"
```

---

### Task 8: Форматирование и буфер обмена

**Files:**
- Create: `packages/ui/src/format/date.ts`, `date.test.ts`, `amount.ts`, `amount.test.ts`, `account.ts`, `account.test.ts`, `clipboard.ts`, `clipboard.test.ts`, `index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces:
  - `formatDateTimeShort(iso: string): string` → `'22.09 07:33:22'`; `formatDateTimeFull(iso): string` → `'22.09.2026 07:33:22'`; `formatDate(iso): string` → `'22.09.2026'`. Часовой пояс — локальный браузера (бизнес-пояс `Europe/Moscow` приложение обеспечивает на уровне окружения; кит не конвертирует).
  - `formatAmount(n: number, fraction = 2): string` → `'1 234 567,50'` с разделителем групп U+202F (узкий неразрывный пробел) и десятичной запятой.
  - `shortAccount(acc: string): { head: string; ccy: string; tail: string; short: boolean }` — правило эталона: первые 8 знаков, знаки 6–8 (индексы 5..7) — код валюты, последние 3; `short=false`, если длина ≤ 11 (сокращать нечего).
  - `copyText(text: string): Promise<boolean>` — `navigator.clipboard.writeText`, при отказе — `false`.

- [ ] **Step 1: Тесты (падают)**

`packages/ui/src/format/date.test.ts`:
```ts
import { formatDate, formatDateTimeFull, formatDateTimeShort } from './date'

describe('даты', () => {
  const iso = '2026-09-22T07:33:22'
  it('короткая — день.месяц время', () => expect(formatDateTimeShort(iso)).toBe('22.09 07:33:22'))
  it('полная — с годом', () => expect(formatDateTimeFull(iso)).toBe('22.09.2026 07:33:22'))
  it('только дата', () => expect(formatDate(iso)).toBe('22.09.2026'))
  it('невалидная строка — пусто', () => expect(formatDate('нет')).toBe(''))
})
```
`packages/ui/src/format/amount.test.ts`:
```ts
import { formatAmount } from './amount'

describe('formatAmount', () => {
  it('группы узким неразрывным пробелом, запятая', () => {
    expect(formatAmount(1234567.5)).toBe('1 234 567,50')
  })
  it('ноль и отрицательные', () => {
    expect(formatAmount(0)).toBe('0,00')
    expect(formatAmount(-42.1)).toBe('-42,10')
  })
  it('без дробной части', () => expect(formatAmount(1500, 0)).toBe('1 500'))
})
```
`packages/ui/src/format/account.test.ts`:
```ts
import { shortAccount } from './account'

describe('shortAccount', () => {
  it('8 … 3, код валюты — знаки 6–8', () => {
    expect(shortAccount('40702840500000012345')).toEqual({ head: '40702840', ccy: '840', tail: '345', short: true })
  })
  it('короткий счёт не сокращается', () => {
    expect(shortAccount('12345678901')).toEqual({ head: '12345678901', ccy: '678', tail: '', short: false })
  })
})
```
`packages/ui/src/format/clipboard.test.ts`:
```ts
import { copyText } from './clipboard'

describe('copyText', () => {
  it('пишет через navigator.clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    expect(await copyText('abc')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('abc')
  })
  it('при отказе возвращает false', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('нет')) } })
    expect(await copyText('abc')).toBe(false)
  })
})
```
Run: `pnpm --filter @katran/ui test format`
Expected: FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/format/date.ts`:
```ts
const p2 = (n: number) => String(n).padStart(2, '0')
const parse = (iso: string): Date | null => { const d = new Date(iso); return isNaN(d.getTime()) ? null : d }

export function formatDate(iso: string): string {
  const d = parse(iso); if (!d) return ''
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`
}
const time = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`

/** Компактная форма для грида; полная — в тултипе. */
export function formatDateTimeShort(iso: string): string {
  const d = parse(iso); if (!d) return ''
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)} ${time(d)}`
}
export function formatDateTimeFull(iso: string): string {
  const d = parse(iso); if (!d) return ''
  return `${formatDate(iso)} ${time(d)}`
}
```
`packages/ui/src/format/amount.ts`:
```ts
const NNBSP = ' '
/** Сумма: группы разделены узким неразрывным пробелом, десятичная запятая. */
export function formatAmount(n: number, fraction = 2): string {
  const sign = n < 0 ? '-' : ''
  const [int, frac] = Math.abs(n).toFixed(fraction).split('.')
  const grouped = (int ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP)
  return sign + grouped + (frac ? ',' + frac : '')
}
```
`packages/ui/src/format/account.ts`:
```ts
export type ShortAccount = { head: string; ccy: string; tail: string; short: boolean }
/** Счёт в гриде: первые 8 знаков … последние 3; знаки 6–8 — код валюты (эталон). */
export function shortAccount(acc: string): ShortAccount {
  const ccy = acc.slice(5, 8)
  if (acc.length <= 11) return { head: acc, ccy, tail: '', short: false }
  return { head: acc.slice(0, 8), ccy, tail: acc.slice(-3), short: true }
}
```
`packages/ui/src/format/clipboard.ts`:
```ts
export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}
```
`packages/ui/src/format/index.ts`:
```ts
export * from './date'
export * from './amount'
export * from './account'
export * from './clipboard'
```
В `packages/ui/src/index.ts` добавить `export * from './format'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/ui test format`
Expected: PASS, 11 тестов.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Форматирование дат, сумм и счетов по правилам эталона; копирование в буфер"
```

---

### Task 9: `Tooltip` — один плавающий на документ

**Files:**
- Create: `packages/ui/src/tooltip/TooltipLayer.tsx`, `Tooltip.tsx`, `Tooltip.module.css`, `Tooltip.test.tsx`, `index.ts`
- Modify: `packages/ui/src/provider/KatranProvider.tsx` (монтирует `TooltipLayer`), `packages/ui/src/index.ts`

**Interfaces:**
- Механизм: элемент помечается атрибутами `data-k-tip="текст"` и, опционально, `data-k-tip-if="truncated"`. `TooltipLayer` внутри провайдера слушает `pointerover`/`pointerout`/`focusin`/`focusout`/`keydown(Escape)` на корне провайдера, находит ближайший `[data-k-tip]` и показывает единственный элемент `role="tooltip"`, позиционируя его `@floating-ui/dom` (`computePosition` + `offset(6)`, `flip()`, `shift({padding: 8})`). Задержка показа `--k-t-base` (200 мс), скрытие сразу. При показе цели выставляется `aria-describedby` на id тултипа, при скрытии — снимается.
- `data-k-tip-if="truncated"`: показывать только если `el.scrollWidth > el.clientWidth`.
- Produces: `<Tooltip content: string when?: 'always'|'truncated'>{child}</Tooltip>` — клонирует единственного ребёнка, добавляя атрибуты. Компоненты значений (задача 10) ставят атрибуты сами, без обёртки.
- Почему так, а не CSS-тултип у каждой ячейки: внутри `td { overflow: hidden }` CSS-тултип режется — на эталоне это ловилось дважды.

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/tooltip/Tooltip.test.tsx`:
```tsx
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderK } from '../test/renderK'
import { Tooltip } from './Tooltip'

const setWidths = (el: HTMLElement, scroll: number, client: number) => {
  Object.defineProperty(el, 'scrollWidth', { value: scroll, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: client, configurable: true })
}

describe('Tooltip', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('показывается по наведению с задержкой, связан через aria-describedby, скрывается по уходу', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderK(<Tooltip content="Полное значение"><button>Кнопка</button></Tooltip>)
    const b = screen.getByRole('button')
    await user.hover(b)
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => { vi.advanceTimersByTime(250) })
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveTextContent('Полное значение')
    expect(b).toHaveAttribute('aria-describedby', tip.id)
    await user.unhover(b)
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(b).not.toHaveAttribute('aria-describedby')
  })

  it('показывается по фокусу, прячется по Escape', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderK(<Tooltip content="Подсказка"><button>Кнопка</button></Tooltip>)
    await user.tab()
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('when=truncated: только если текст обрезан', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderK(<Tooltip content="Длинное" when="truncated"><span data-testid="v" tabIndex={0}>Длинное</span></Tooltip>)
    const v = screen.getByTestId('v')
    setWidths(v, 100, 100)
    await user.hover(v)
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.unhover(v)
    setWidths(v, 200, 100)
    await user.hover(v)
    act(() => { vi.advanceTimersByTime(250) })
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
  })
})
```
Run: `pnpm --filter @katran/ui test tooltip`
Expected: FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/tooltip/TooltipLayer.tsx`:
```tsx
import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import { durations } from '@katran/tokens'
import s from './Tooltip.module.css'

type Props = { root: RefObject<HTMLElement | null> }

const findTarget = (e: Event): HTMLElement | null =>
  (e.target as Element | null)?.closest?.('[data-k-tip]') ?? null

const wants = (el: HTMLElement) =>
  el.dataset.kTipIf !== 'truncated' || el.scrollWidth > el.clientWidth

/** Единственный тултип на провайдер. Управляется делегированием событий с корня. */
export function TooltipLayer({ root }: Props) {
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<{ el: HTMLElement; text: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const current = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const host = root.current
    if (!host) return

    const hide = () => {
      window.clearTimeout(timer.current)
      current.current?.removeAttribute('aria-describedby')
      current.current = null
      setState(null)
    }
    const show = (el: HTMLElement) => {
      if (current.current === el) return
      hide()
      if (!wants(el)) return
      current.current = el
      timer.current = window.setTimeout(() => {
        el.setAttribute('aria-describedby', id)
        setState({ el, text: el.dataset.kTip ?? '' })
      }, durations.base)
    }
    const onOver = (e: Event) => { const t = findTarget(e); if (t) show(t) }
    const onOut = (e: Event) => {
      const t = findTarget(e)
      if (!t || t !== current.current) return
      const to = (e as PointerEvent).relatedTarget as Node | null
      if (to && t.contains(to)) return
      hide()
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }

    host.addEventListener('pointerover', onOver)
    host.addEventListener('pointerout', onOut)
    host.addEventListener('focusin', onOver)
    host.addEventListener('focusout', onOut)
    host.addEventListener('keydown', onKey)
    return () => {
      hide()
      host.removeEventListener('pointerover', onOver)
      host.removeEventListener('pointerout', onOut)
      host.removeEventListener('focusin', onOver)
      host.removeEventListener('focusout', onOut)
      host.removeEventListener('keydown', onKey)
    }
  }, [root, id])

  useEffect(() => {
    if (!state || !box.current) return
    let alive = true
    computePosition(state.el, box.current, { placement: 'top', middleware: [offset(6), flip(), shift({ padding: 8 })] })
      .then(({ x, y }) => { if (alive && box.current) Object.assign(box.current.style, { left: `${x}px`, top: `${y}px` }) })
    return () => { alive = false }
  }, [state])

  if (!state) return null
  return <div ref={box} id={id} role="tooltip" className={s.tip}>{state.text}</div>
}
```
Позиционирование через `style.left/top` в px — это координаты, не размеры; плотность на них не влияет. Это единственное место, где px допустимы в инлайне.

`packages/ui/src/tooltip/Tooltip.tsx`:
```tsx
import { cloneElement, isValidElement, type ReactElement } from 'react'

export type TooltipProps = {
  content: string
  /** truncated — показывать только если текст ребёнка обрезан. */
  when?: 'always' | 'truncated'
  children: ReactElement<Record<string, unknown>>
}

/** Обёртка над механизмом data-k-tip. Ребёнок один; атрибуты добавляются ему. */
export function Tooltip({ content, when = 'always', children }: TooltipProps) {
  if (!isValidElement(children)) throw new Error('Tooltip: нужен один элемент-ребёнок')
  return cloneElement(children, {
    'data-k-tip': content,
    'data-k-tip-if': when === 'truncated' ? 'truncated' : undefined,
  })
}
```

`packages/ui/src/tooltip/Tooltip.module.css`:
```css
.tip {
  position: fixed;
  z-index: var(--k-z-tooltip);
  max-width: var(--k-tip-max);
  padding: var(--k-sp-1) var(--k-sp-2);
  border-radius: var(--k-r-s);
  background: var(--k-ink);
  color: var(--k-paper);
  font: 400 var(--k-fs-2) / var(--k-lh-2) var(--k-sans);
  box-shadow: var(--k-shadow);
  pointer-events: none;
  white-space: pre-line;
  word-break: break-word;
}
```
Добавить в `tokens.src.ts` размер `'tip-max': 360` и перегенерировать (`pnpm gen`).

`packages/ui/src/tooltip/index.ts`:
```ts
export { Tooltip, type TooltipProps } from './Tooltip'
```

В `KatranProvider.tsx`: завести `const rootRef = useRef<HTMLDivElement>(null)`, повесить `ref={rootRef}` на корневой `div`, и рядом с `<LiveRegion>` добавить `<TooltipLayer root={rootRef} />`. Импорт: `import { TooltipLayer } from '../tooltip/TooltipLayer'`.
В `packages/ui/src/index.ts` добавить `export * from './tooltip'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm gen && pnpm --filter @katran/ui test`
Expected: PASS — все тесты пакета, включая провайдер. В jsdom `computePosition` даёт нули — это нормально, позиция не проверяется.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Tooltip: один плавающий элемент на провайдер, делегирование, показ только при обрезке"
```

---

### Task 10: Значения: `CopyValue`, `LinkValue`, `AccountValue`, `FieldTag`, `StatusDot`, `Tag`, `Counter`

**Files:**
- Create: `packages/ui/src/value/CopyValue.tsx`, `LinkValue.tsx`, `AccountValue.tsx`, `FieldTag.tsx`, `StatusDot.tsx`, `Tag.tsx`, `Counter.tsx`, `Value.module.css`, `Value.test.tsx`, `index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- `<CopyValue value: string display?: ReactNode short?: boolean tone?: 'val'|'ink'|'ink2'|'mono' maxWidth?: number tabIndex?>` — `<button type="button">`, текст `display ?? value`, клик → `copyText(value)` → класс `flash` на 600 мс и `announce('Скопировано')`. Тултип: `data-k-tip={value}`; если `short` — всегда, иначе `data-k-tip-if="truncated"`. `maxWidth` — в px при плотности 1, применяется как `calc(N px * var(--k-density))` инлайном.
- `<LinkValue name: string value?: string>` — кнопка с текстом `name`; при `value` копирует его, тултип `«{value} — копировать»`; без `value` — `disabled`, класс `off`, тултип `«{name}: нет значения»`.
- `<AccountValue value: string>` — `CopyValue` с `display` из `shortAccount`: `head` где `ccy` в `<b>`, затем `…`, затем `tail`; `short` из результата.
- `<FieldTag tag: string title?: string>` — `<span>` цветом `opt`, тултип `title` (например «70 · Детали платежа»).
- `<StatusDot tone: StatusTone size?: 's'|'m' letter?: string label?: string>` — `StatusTone = 'flow'|'flowl'|'flowd'|'bad'|'badd'|'warn'|'ok'|'okl'|'grey'`; `label` → `aria-label` и `role="img"`, иначе `aria-hidden`.
- `<Tag tone?: 'neutral'|'opt'>` — короткий код в рамке (провайдеры ЕРС/VTO/LORO).
- `<Counter value: number active?: boolean>` — пилюля счётчика; `value === 0` → класс `zero` (бледный, рамка `line2`).
- Правила из эталона: значение — отдельный элемент, клик копирует; тултип с полным значением только если обрезано или сокращено; вспышка `ok-soft` вместо тоста.

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/value/Value.test.tsx`:
```tsx
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { AccountValue } from './AccountValue'
import { CopyValue } from './CopyValue'
import { Counter } from './Counter'
import { FieldTag } from './FieldTag'
import { LinkValue } from './LinkValue'
import { StatusDot } from './StatusDot'

const clip = () => { const writeText = vi.fn().mockResolvedValue(undefined); Object.assign(navigator, { clipboard: { writeText } }); return writeText }

describe('CopyValue', () => {
  it('кнопка, копирует значение, объявляет, тултип только при обрезке', async () => {
    const writeText = clip()
    renderK(<CopyValue value="DEUTDEFFXXX" />)
    const b = screen.getByRole('button', { name: 'DEUTDEFFXXX' })
    expect(b).toHaveAttribute('data-k-tip', 'DEUTDEFFXXX')
    expect(b).toHaveAttribute('data-k-tip-if', 'truncated')
    await userEvent.click(b)
    expect(writeText).toHaveBeenCalledWith('DEUTDEFFXXX')
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)) })
    expect(screen.getByRole('status')).toHaveTextContent('Скопировано')
  })
  it('short — тултип всегда; display показывается вместо value', () => {
    renderK(<CopyValue value="полное" display="кор…" short />)
    const b = screen.getByRole('button', { name: 'кор…' })
    expect(b).not.toHaveAttribute('data-k-tip-if')
    expect(b).toHaveAttribute('data-k-tip', 'полное')
  })
})

describe('LinkValue', () => {
  it('с значением — копирует значение, имя как текст', async () => {
    const writeText = clip()
    renderK(<LinkValue name="uuid" value="0f3c-…" />)
    await userEvent.click(screen.getByRole('button', { name: 'uuid' }))
    expect(writeText).toHaveBeenCalledWith('0f3c-…')
  })
  it('без значения — недоступна, тултип объясняет', () => {
    renderK(<LinkValue name="refOut" />)
    const b = screen.getByRole('button', { name: 'refOut' })
    expect(b).toBeDisabled()
    expect(b).toHaveAttribute('data-k-tip', 'refOut: нет значения')
  })
})

describe('AccountValue', () => {
  it('8…3, код валюты выделен, копируется полный', async () => {
    const writeText = clip()
    renderK(<AccountValue value="40702840500000012345" />)
    const b = screen.getByRole('button')
    expect(b).toHaveTextContent('40702840…345')
    expect(b.querySelector('b')).toHaveTextContent('840')
    await userEvent.click(b)
    expect(writeText).toHaveBeenCalledWith('40702840500000012345')
  })
})

describe('StatusDot / FieldTag / Counter', () => {
  it('точка с именем — role=img; без имени скрыта', () => {
    const { container } = renderK(<><StatusDot tone="ok" label="Обработан" /><StatusDot tone="bad" /></>)
    expect(screen.getByRole('img', { name: 'Обработан' })).toBeInTheDocument()
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
  })
  it('тег поля несёт подсказку', () => {
    renderK(<FieldTag tag="70" title="70 · Детали платежа" />)
    expect(screen.getByText('70')).toHaveAttribute('data-k-tip', '70 · Детали платежа')
  })
  it('счётчик ноль помечен', () => {
    const { container } = renderK(<Counter value={0} />)
    expect(container.firstElementChild).toHaveAttribute('data-zero', 'true')
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<>
      <CopyValue value="a" /><LinkValue name="n" value="v" /><AccountValue value="40702840500000012345" />
      <FieldTag tag="70" /><StatusDot tone="ok" label="Ок" /><Counter value={3} />
    </>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test value`
Expected: FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/value/CopyValue.tsx`:
```tsx
import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { copyText } from '../format/clipboard'
import { useKatran } from '../provider/useKatran'
import s from './Value.module.css'

export type CopyValueProps = {
  value: string
  display?: ReactNode
  /** Показано сокращённо → тултип с полным значением всегда. */
  short?: boolean
  tone?: 'val' | 'ink' | 'ink2' | 'mono'
  /** Максимальная ширина в px при плотности 1. */
  maxWidth?: number
  tabIndex?: number
  className?: string
}

export const FLASH_MS = 600

export function CopyValue({ value, display, short, tone = 'val', maxWidth, tabIndex, className }: CopyValueProps) {
  const { announce } = useKatran()
  const [flash, setFlash] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const onClick = async () => {
    if (await copyText(value)) {
      announce('Скопировано')
      setFlash(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setFlash(false), FLASH_MS)
    }
  }
  const style = maxWidth ? ({ maxWidth: `calc(${maxWidth}px * var(--k-density))` } as CSSProperties) : undefined
  return (
    <button
      type="button"
      className={[s.copy, s[tone], flash ? s.flash : '', className].filter(Boolean).join(' ')}
      style={style}
      tabIndex={tabIndex}
      data-k-tip={value}
      data-k-tip-if={short ? undefined : 'truncated'}
      onClick={onClick}
    >
      {display ?? value}
    </button>
  )
}
```

`packages/ui/src/value/LinkValue.tsx`:
```tsx
import { useRef, useState } from 'react'
import { copyText } from '../format/clipboard'
import { useKatran } from '../provider/useKatran'
import { FLASH_MS } from './CopyValue'
import s from './Value.module.css'

export type LinkValueProps = { name: string; value?: string; tabIndex?: number }

/** Длинная непонятная строка (uuid, референс) показывается именем; клик копирует значение. */
export function LinkValue({ name, value, tabIndex }: LinkValueProps) {
  const { announce } = useKatran()
  const [flash, setFlash] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const onClick = async () => {
    if (value && (await copyText(value))) {
      announce('Скопировано')
      setFlash(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setFlash(false), FLASH_MS)
    }
  }
  return (
    <button
      type="button"
      className={[s.link, value ? '' : s.off, flash ? s.flash : ''].filter(Boolean).join(' ')}
      disabled={!value}
      tabIndex={tabIndex}
      data-k-tip={value ? `${value} — копировать` : `${name}: нет значения`}
      onClick={onClick}
    >
      {name}
    </button>
  )
}
```

`packages/ui/src/value/AccountValue.tsx`:
```tsx
import { shortAccount } from '../format/account'
import { CopyValue, type CopyValueProps } from './CopyValue'
import s from './Value.module.css'

export type AccountValueProps = Omit<CopyValueProps, 'display' | 'short' | 'tone'> & { full?: boolean }

/** Счёт: в гриде 8…3 с выделенным кодом валюты; full — целиком (деталка). */
export function AccountValue({ value, full, ...rest }: AccountValueProps) {
  const a = shortAccount(value)
  const head = <>{a.head.slice(0, 5)}<b className={s.ccy}>{a.ccy}</b>{a.head.slice(8)}</>
  const display = full || !a.short ? head : <>{head}…{a.tail}</>
  return <CopyValue value={value} display={display} short={!full && a.short} tone="mono" {...rest} />
}
```

`packages/ui/src/value/FieldTag.tsx`:
```tsx
import s from './Value.module.css'
export type FieldTagProps = { tag: string; title?: string }
/** Номер SWIFT-поля. Операторы знают номера — заголовка нет, объяснение в подсказке. */
export function FieldTag({ tag, title }: FieldTagProps) {
  return <span className={s.ftag} data-k-tip={title}>{tag}</span>
}
```

`packages/ui/src/value/StatusDot.tsx`:
```tsx
import s from './Value.module.css'
export type StatusTone = 'flow' | 'flowl' | 'flowd' | 'bad' | 'badd' | 'warn' | 'ok' | 'okl' | 'grey'
export type StatusDotProps = { tone: StatusTone; size?: 's' | 'm'; letter?: string; label?: string }

export function StatusDot({ tone, size = 'm', letter, label }: StatusDotProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return <span className={[s.dot, s[`dot${size.toUpperCase()}`]].join(' ')} data-tone={tone} {...a11y}>{letter}</span>
}
```

`packages/ui/src/value/Tag.tsx`:
```tsx
import type { ReactNode } from 'react'
import s from './Value.module.css'
export type TagProps = { tone?: 'neutral' | 'opt'; children: ReactNode }
export function Tag({ tone = 'neutral', children }: TagProps) {
  return <span className={s.tag} data-tone={tone}>{children}</span>
}
```

`packages/ui/src/value/Counter.tsx`:
```tsx
import s from './Value.module.css'
export type CounterProps = { value: number; active?: boolean }
export function Counter({ value, active }: CounterProps) {
  return <span className={s.counter} data-zero={value === 0 || undefined} data-active={active || undefined}>{value}</span>
}
```

`packages/ui/src/value/Value.module.css`:
```css
.copy, .link {
  display: inline-block;
  max-width: 100%;
  padding: 0 var(--k-sp-1);
  margin: 0 calc(-1 * var(--k-sp-1));
  border: 0;
  border-radius: var(--k-r-s);
  background: none;
  font: inherit;
  line-height: inherit;
  text-align: left;
  cursor: copy;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
  transition: background var(--k-t-fast);
}
.copy:hover, .link:hover:not(:disabled) { background: var(--k-val-soft); }
.copy:focus-visible, .link:focus-visible { outline: 2px solid var(--k-val); outline-offset: 0; }
.flash, .flash:hover { background: var(--k-ok-soft); color: var(--k-ok); }

.val { color: var(--k-val); }
.ink { color: var(--k-ink); }
.ink2 { color: var(--k-ink2); }
.mono { color: var(--k-val); font-family: var(--k-mono); font-size: var(--k-fs-2); }
.ccy { font-weight: 600; }

.link { font: 500 var(--k-fs-2) / var(--k-lh-2) var(--k-sans); color: var(--k-val); letter-spacing: -0.01em; }
.off { color: var(--k-faint); cursor: default; text-decoration: line-through; text-decoration-color: var(--k-line); }

.ftag { color: var(--k-opt); font: 600 var(--k-fs-3) / 1 var(--k-mono); cursor: help; }

.dot { display: inline-grid; place-items: center; border-radius: 50%; color: var(--k-paper); font: 700 var(--k-fs-3) / 1 var(--k-sans); }
.dotS { width: var(--k-dot-s); height: var(--k-dot-s); }
.dotM { width: var(--k-dot-m); height: var(--k-dot-m); }
.dot[data-tone="flow"] { background: var(--k-st-flow); }
.dot[data-tone="flowl"] { background: var(--k-st-flowl); }
.dot[data-tone="flowd"] { background: var(--k-st-flowd); }
.dot[data-tone="bad"] { background: var(--k-st-bad); }
.dot[data-tone="badd"] { background: var(--k-st-badd); }
.dot[data-tone="warn"] { background: var(--k-st-warn); }
.dot[data-tone="ok"] { background: var(--k-st-ok); }
.dot[data-tone="okl"] { background: var(--k-st-okl); }
.dot[data-tone="grey"] { background: var(--k-st-grey); }

.tag {
  display: inline-block;
  padding: 0 var(--k-sp-1);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
  font: 500 var(--k-fs-3) / var(--k-lh-3) var(--k-mono);
  color: var(--k-ink2);
  white-space: nowrap;
}
.tag[data-tone="opt"] { color: var(--k-opt); border-color: var(--k-opt-soft); background: var(--k-opt-soft); }

.counter {
  display: inline-grid;
  place-items: center;
  min-width: var(--k-counter);
  height: var(--k-counter);
  padding: 0 var(--k-sp-1);
  border-radius: var(--k-counter);
  background: var(--k-chip);
  color: var(--k-ink2);
  font: 600 var(--k-fs-2) / 1 var(--k-sans);
}
.counter[data-active] { background: var(--k-val); color: var(--k-paper); }
.counter[data-zero] { background: none; color: var(--k-faint); border: 1px solid var(--k-line2); }
```
В `tokens.src.ts` добавить размеры `'dot-s': 7, 'dot-m': 14, 'counter': 18` и `pnpm gen`.

`packages/ui/src/value/index.ts`:
```ts
export { CopyValue, type CopyValueProps } from './CopyValue'
export { LinkValue, type LinkValueProps } from './LinkValue'
export { AccountValue, type AccountValueProps } from './AccountValue'
export { FieldTag, type FieldTagProps } from './FieldTag'
export { StatusDot, type StatusDotProps, type StatusTone } from './StatusDot'
export { Tag, type TagProps } from './Tag'
export { Counter, type CounterProps } from './Counter'
```
В `packages/ui/src/index.ts` добавить `export * from './value'`.

- [ ] **Step 3: Тесты проходят, линт**

Run: `pnpm gen && pnpm --filter @katran/ui test value && pnpm lint`
Expected: PASS, 9 тестов. Возможное замечание jsx-a11y на `role="img"` у `span` — правило `jsx-a11y/prefer-tag-over-role` не входит в recommended; если сработает — оставить `role="img"`, это каноничный способ для декоративного индикатора с именем.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Компоненты значений: копирование по клику, счёт 8…3, линк-кнопки, теги полей, точки статусов, счётчики"
```

---

### Task 11: `Popover`, `Menu`

**Files:**
- Create: `packages/ui/src/overlay/Popover.tsx`, `Menu.tsx`, `Overlay.module.css`, `Overlay.test.tsx`, `index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- `<Popover open anchor: RefObject<HTMLElement|null> onClose placement?='bottom-start' label?: string>` — панель `role="dialog"` (или без роли, если `label` не задан — тогда `role="group"`), позиционируется `@floating-ui/dom` (`autoUpdate`, `offset(4)`, `flip()`, `shift()`), закрывается по `Escape` и клику вне (вне панели и вне якоря), при открытии фокус — на первый фокусируемый элемент внутри, при закрытии — возвращается на якорь. Рендер через портал в `document.body`? Нет: **рендер внутри провайдера** (обычный `createPortal` в корень провайдера, чтобы работали токены темы и делегирование тултипа). Провайдер отдаёт `portalRoot` через контекст.
- `<Menu items: MenuItem[] open anchor onClose title?: string>` — на базе `Popover`, `role="menu"`, элементы `role="menuitem"` / `menuitemcheckbox` (если `checked` определён), стрелки ↑↓ ходят по элементам (roving), `Home/End`, `Enter/Space` выбирает и закрывает, `disabled` пропускаются. `MenuItem = { id: string; label: string; onSelect: () => void; checked?: boolean; disabled?: boolean; hint?: string }`; `title` — необязательный заголовок (`«Сортировать «Статус» по»`).
- Используется гридом: меню сортировки составной колонки, меню состава колонок; поповеры фильтров.

- [ ] **Step 1: Контекст портала в провайдере**

В `useKatran.ts` добавить в `KatranContextValue` поле `portalRoot: HTMLElement | null`. В `KatranProvider.tsx` — `const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)` и на корневом `div` `ref={(el) => { rootRef.current = el; setPortalRoot(el) }}`; добавить `portalRoot` в `value` (и в зависимости `useMemo`). Тест провайдера не меняется.

- [ ] **Step 2: Тест (падает)**

`packages/ui/src/overlay/Overlay.test.tsx`:
```tsx
import { useRef, useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Menu, type MenuItem } from './Menu'
import { Popover } from './Popover'

function PopoverHost() {
  const [open, setOpen] = useState(false)
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a} onClick={() => setOpen(true)}>Открыть</button>
      <button>Снаружи</button>
      <Popover open={open} anchor={a} onClose={() => setOpen(false)} label="Панель">
        <input aria-label="Поле" />
      </Popover>
    </>
  )
}

function MenuHost({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a} onClick={() => setOpen(true)}>Меню</button>
      <Menu open={open} anchor={a} onClose={() => setOpen(false)} items={items} title="Сортировать по" />
    </>
  )
}

describe('Popover', () => {
  it('открывается с фокусом внутрь, закрывается по Escape с возвратом фокуса', async () => {
    renderK(<PopoverHost />)
    await userEvent.click(screen.getByText('Открыть'))
    expect(screen.getByRole('dialog', { name: 'Панель' })).toBeInTheDocument()
    expect(screen.getByLabelText('Поле')).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Открыть')).toHaveFocus()
  })
  it('закрывается кликом снаружи', async () => {
    renderK(<PopoverHost />)
    await userEvent.click(screen.getByText('Открыть'))
    await userEvent.click(screen.getByText('Снаружи'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Menu', () => {
  const mk = (): MenuItem[] => [
    { id: 'a', label: 'Статус', onSelect: vi.fn() },
    { id: 'b', label: 'Причина', onSelect: vi.fn(), disabled: true },
    { id: 'c', label: 'Дата', onSelect: vi.fn(), checked: true },
  ]
  it('стрелки пропускают недоступные, Enter выбирает и закрывает', async () => {
    const items = mk()
    renderK(<MenuHost items={items} />)
    await userEvent.click(screen.getByText('Меню'))
    expect(screen.getByRole('menu', { name: 'Сортировать по' })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Статус' })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Дата' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(items[2]!.onSelect).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })
  it('checked → aria-checked', async () => {
    renderK(<MenuHost items={mk()} />)
    await userEvent.click(screen.getByText('Меню'))
    expect(screen.getByRole('menuitemcheckbox', { name: 'Дата' })).toHaveAttribute('aria-checked', 'true')
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<MenuHost items={mk()} />)
    await userEvent.click(screen.getByText('Меню'))
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test overlay`
Expected: FAIL.

- [ ] **Step 3: Реализация**

`packages/ui/src/overlay/Popover.tsx`:
```tsx
import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { autoUpdate, computePosition, flip, offset, shift, type Placement } from '@floating-ui/dom'
import { useKatran } from '../provider/useKatran'
import s from './Overlay.module.css'

export type PopoverProps = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  placement?: Placement
  /** Доступное имя панели. */
  label?: string
  role?: 'dialog' | 'menu'
  children: ReactNode
  className?: string
  /** Не переносить фокус внутрь автоматически (меню делает это само). */
  manualFocus?: boolean
}

const FOCUSABLE = 'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function Popover({ open, anchor, onClose, placement = 'bottom-start', label, role = 'dialog', children, className, manualFocus }: PopoverProps) {
  const { portalRoot } = useKatran()
  const box = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // позиция
  useEffect(() => {
    if (!open || !anchor.current || !box.current) return
    const a = anchor.current, b = box.current
    return autoUpdate(a, b, () => {
      computePosition(a, b, { placement, middleware: [offset(4), flip(), shift({ padding: 8 })] })
        .then(({ x, y }) => Object.assign(b.style, { left: `${x}px`, top: `${y}px` }))
    })
  }, [open, anchor, placement])

  // фокус внутрь, возврат при закрытии
  useEffect(() => {
    if (!open || !box.current) return
    const returnTo = anchor.current
    if (!manualFocus) (box.current.querySelector(FOCUSABLE) as HTMLElement | null)?.focus()
    return () => { returnTo?.focus() }
  }, [open, anchor, manualFocus])

  // Escape и клик вне
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current() } }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (box.current?.contains(t) || anchor.current?.contains(t)) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [open, anchor])

  if (!open || !portalRoot) return null
  return createPortal(
    <div ref={box} role={role} aria-label={label} className={[s.pop, className].filter(Boolean).join(' ')}>{children}</div>,
    portalRoot,
  )
}
```
Замечание про `stopPropagation` на Escape: на эталоне Esc из промта всплывал и закрывал деталку — здесь это учтено сразу.

`packages/ui/src/overlay/Menu.tsx`:
```tsx
import { useEffect, useRef, useState, type RefObject } from 'react'
import { Popover } from './Popover'
import s from './Overlay.module.css'

export type MenuItem = {
  id: string
  label: string
  onSelect: () => void
  checked?: boolean
  disabled?: boolean
  /** Подсказка справа (например, стрелка направления сортировки). */
  hint?: string
}
export type MenuProps = {
  open: boolean
  anchor: RefObject<HTMLElement | null>
  onClose: () => void
  items: MenuItem[]
  title?: string
}

export function Menu({ open, anchor, onClose, items, title }: MenuProps) {
  const enabled = items.map((it, i) => (it.disabled ? -1 : i)).filter((i) => i >= 0)
  const [active, setActive] = useState(enabled[0] ?? -1)
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => { if (open) setActive(enabled[0] ?? -1) }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open && active >= 0) refs.current[active]?.focus() }, [open, active])

  const move = (d: 1 | -1) => {
    const pos = enabled.indexOf(active)
    const next = enabled[(pos + d + enabled.length) % enabled.length]
    if (next !== undefined) setActive(next)
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(enabled[0] ?? -1) }
    else if (e.key === 'End') { e.preventDefault(); setActive(enabled[enabled.length - 1] ?? -1) }
  }
  const pick = (it: MenuItem) => { it.onSelect(); onClose() }

  return (
    <Popover open={open} anchor={anchor} onClose={onClose} role="menu" label={title} manualFocus>
      <div onKeyDown={onKey}>
        {title && <div className={s.menuTitle} aria-hidden="true">{title}</div>}
        {items.map((it, i) => (
          <button
            key={it.id}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            role={it.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
            aria-checked={it.checked === undefined ? undefined : it.checked}
            aria-disabled={it.disabled || undefined}
            disabled={it.disabled}
            tabIndex={i === active ? 0 : -1}
            className={s.item}
            onClick={() => !it.disabled && pick(it)}
          >
            <span>{it.label}</span>
            {it.hint && <span className={s.hint}>{it.hint}</span>}
          </button>
        ))}
      </div>
    </Popover>
  )
}
```

`packages/ui/src/overlay/Overlay.module.css`:
```css
.pop {
  position: fixed;
  z-index: var(--k-z-menu);
  min-width: var(--k-menu-min);
  padding: var(--k-sp-1);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-m);
  background: var(--k-paper);
  color: var(--k-ink);
  box-shadow: var(--k-shadow);
}
.menuTitle { padding: var(--k-sp-1) var(--k-sp-2); font: 500 var(--k-fs-3) / var(--k-lh-3) var(--k-sans); color: var(--k-muted); }
.item {
  display: flex;
  justify-content: space-between;
  gap: var(--k-sp-3);
  width: 100%;
  height: var(--k-h-ctl-m);
  padding: 0 var(--k-sp-2);
  border: 0;
  border-radius: var(--k-r-s);
  background: none;
  font: 400 var(--k-fs-1) / 1 var(--k-sans);
  color: var(--k-ink);
  text-align: left;
  cursor: pointer;
  align-items: center;
}
.item:hover:not(:disabled), .item:focus-visible { background: var(--k-hover); outline: 0; }
.item[aria-checked="true"] { color: var(--k-val); font-weight: 500; }
.item:disabled { color: var(--k-faint); cursor: default; }
.hint { color: var(--k-faint); font-size: var(--k-fs-2); }
```
В `tokens.src.ts` добавить `'menu-min': 180` и `pnpm gen`.

`packages/ui/src/overlay/index.ts`:
```ts
export { Popover, type PopoverProps } from './Popover'
export { Menu, type MenuProps, type MenuItem } from './Menu'
```
В `packages/ui/src/index.ts` добавить `export * from './overlay'`.

- [ ] **Step 4: Тесты проходят**

Run: `pnpm gen && pnpm --filter @katran/ui test && pnpm lint`
Expected: PASS, весь пакет. Если в jsdom `autoUpdate` ругается на `ResizeObserver` — в `vitest.setup.ts` добавить заглушку:
```ts
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Popover и Menu: портал в провайдер, фокус внутрь и обратно, клавиатура, Escape не всплывает"
```

---

### Task 12: Состояния: `Skeleton`, `ProgressBar`, `EmptyState`, `ErrorState`, `useLoadingGate`

**Files:**
- Create: `packages/ui/src/state/Skeleton.tsx`, `ProgressBar.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `useLoadingGate.ts`, `State.module.css`, `State.test.tsx`, `useLoadingGate.test.ts`, `index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- `useLoadingGate(loading: boolean, { show = 200, min = 400 } = {}): boolean` — правило эталона: скелетон показывается, только если загрузка длится дольше `show` мс, и, показавшись, держится не меньше `min` мс (задержки прода 0.3–1 с, мигание недопустимо).
- `<Skeleton.Line width?: string|number lines?: 1|2|3 height?: 's'|'m'>` — плашка в строчном боксе; `width` в `%` или px при плотности 1; `aria-hidden`. `<Skeleton.Block height>`.
- `<ProgressBar indeterminate label>` — тонкая полоса под шапкой при `refreshing`; `role="progressbar"` с `aria-label`.
- `<EmptyState title text? action?: { label; onClick }>`, `<ErrorState title text? retry?: () => void>`.
- Приглушение показанных данных при обновлении — класс-утилита `dim` экспортируется как `dimClass` (строка) для применения гридом.

- [ ] **Step 1: Тест хука (падает)**

`packages/ui/src/state/useLoadingGate.test.ts`:
```ts
import { act, renderHook } from '@testing-library/react'
import { useLoadingGate } from './useLoadingGate'

describe('useLoadingGate', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('короткая загрузка (<200 мс) скелетон не показывает', () => {
    const { result, rerender } = renderHook(({ l }) => useLoadingGate(l), { initialProps: { l: true } })
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(150) })
    rerender({ l: false })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current).toBe(false)
  })

  it('долгая загрузка: показ после 200 мс, держится минимум 400 мс', () => {
    const { result, rerender } = renderHook(({ l }) => useLoadingGate(l), { initialProps: { l: true } })
    act(() => { vi.advanceTimersByTime(200) })
    expect(result.current).toBe(true)
    rerender({ l: false })
    act(() => { vi.advanceTimersByTime(300) })
    expect(result.current).toBe(true)
    act(() => { vi.advanceTimersByTime(100) })
    expect(result.current).toBe(false)
  })
})
```

- [ ] **Step 2: Хук**

`packages/ui/src/state/useLoadingGate.ts`:
```ts
import { useEffect, useRef, useState } from 'react'
import { durations } from '@katran/tokens'

export type LoadingGateOptions = { show?: number; min?: number }

/** Порог показа и минимальная длительность скелетона: не мигать на быстрых ответах. */
export function useLoadingGate(loading: boolean, { show = durations['sk-show'], min = durations['sk-min'] }: LoadingGateOptions = {}): boolean {
  const [visible, setVisible] = useState(false)
  const shownAt = useRef<number | null>(null)

  useEffect(() => {
    let t: number | undefined
    if (loading) {
      if (shownAt.current === null) {
        t = window.setTimeout(() => { shownAt.current = Date.now(); setVisible(true) }, show)
      }
    } else if (shownAt.current !== null) {
      const left = Math.max(0, min - (Date.now() - shownAt.current))
      t = window.setTimeout(() => { shownAt.current = null; setVisible(false) }, left)
    }
    return () => window.clearTimeout(t)
  }, [loading, show, min])

  return visible
}
```
Run: `pnpm --filter @katran/ui test useLoadingGate` → PASS.

- [ ] **Step 3: Тест компонентов (падает)**

`packages/ui/src/state/State.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { ProgressBar } from './ProgressBar'
import { Skeleton } from './Skeleton'

describe('состояния', () => {
  it('скелетон скрыт от скринридера и рисует N строк', () => {
    const { container } = renderK(<Skeleton.Line lines={3} width="60%" />)
    const root = container.firstElementChild!
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root.children).toHaveLength(3)
  })
  it('прогресс с именем', () => {
    renderK(<ProgressBar label="Обновление данных" />)
    expect(screen.getByRole('progressbar', { name: 'Обновление данных' })).toBeInTheDocument()
  })
  it('пустое состояние с действием', async () => {
    const onClick = vi.fn()
    renderK(<EmptyState title="По заданным условиям документов нет" action={{ label: 'Сбросить фильтр', onClick }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Сбросить фильтр' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
  it('ошибка с повтором', async () => {
    const retry = vi.fn()
    renderK(<ErrorState title="Не удалось загрузить" retry={retry} />)
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<>
      <Skeleton.Line /><ProgressBar label="x" /><EmptyState title="Пусто" /><ErrorState title="Ошибка" retry={() => {}} />
    </>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 4: Компоненты**

`packages/ui/src/state/Skeleton.tsx`:
```tsx
import type { CSSProperties } from 'react'
import s from './State.module.css'

type LineProps = { width?: string | number; lines?: 1 | 2 | 3; height?: 's' | 'm' }
const w = (v: string | number | undefined): string | undefined =>
  v === undefined ? undefined : typeof v === 'number' ? `calc(${v}px * var(--k-density))` : v

function Line({ width = '70%', lines = 1, height = 'm' }: LineProps) {
  return (
    <span aria-hidden="true" className={s.lines}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className={[s.line, s[`h${height.toUpperCase()}`]].join(' ')} style={{ width: w(i === lines - 1 ? width : '100%') } as CSSProperties} />
      ))}
    </span>
  )
}
function Block({ height }: { height: number }) {
  return <span aria-hidden="true" className={s.block} style={{ height: w(height) } as CSSProperties} />
}
export const Skeleton = { Line, Block }
/** Класс для приглушения уже показанных данных на время обновления. */
export const dimClass = s.dim
```

`packages/ui/src/state/ProgressBar.tsx`:
```tsx
import s from './State.module.css'
export function ProgressBar({ label }: { label: string }) {
  return <div role="progressbar" aria-label={label} className={s.progress}><span className={s.progressBar} /></div>
}
```

`packages/ui/src/state/EmptyState.tsx`:
```tsx
import { Button } from '../button'
import s from './State.module.css'
export type EmptyStateProps = { title: string; text?: string; action?: { label: string; onClick: () => void } }
export function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className={s.empty}>
      <div className={s.emptyTitle}>{title}</div>
      {text && <div className={s.emptyText}>{text}</div>}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  )
}
```

`packages/ui/src/state/ErrorState.tsx`:
```tsx
import { Button } from '../button'
import s from './State.module.css'
export type ErrorStateProps = { title: string; text?: string; retry?: () => void }
export function ErrorState({ title, text, retry }: ErrorStateProps) {
  return (
    <div role="alert" className={[s.empty, s.error].join(' ')}>
      <div className={s.emptyTitle}>{title}</div>
      {text && <div className={s.emptyText}>{text}</div>}
      {retry && <Button onClick={retry}>Повторить</Button>}
    </div>
  )
}
```

`packages/ui/src/state/State.module.css`:
```css
.lines { display: inline-flex; flex-direction: column; gap: var(--k-sp-1); width: 100%; vertical-align: middle; }
.line, .block { display: block; border-radius: var(--k-r-s); background: var(--k-chip); animation: k-pulse 1.2s ease-in-out infinite; }
.hS { height: var(--k-fs-3); }
.hM { height: var(--k-fs-1); }
.block { width: 100%; }
@keyframes k-pulse { 50% { opacity: 0.55; } }
@media (prefers-reduced-motion: reduce) { .line, .block { animation: none; } }

.dim { opacity: 0.55; transition: opacity var(--k-t-base); pointer-events: none; }

.progress { position: relative; height: var(--k-progress); overflow: hidden; background: var(--k-val-soft); }
.progressBar { position: absolute; inset: 0 auto 0 -40%; width: 40%; background: var(--k-val); animation: k-slide 1.1s linear infinite; }
@keyframes k-slide { to { left: 100%; } }
@media (prefers-reduced-motion: reduce) { .progressBar { animation: none; width: 100%; left: 0; opacity: 0.4; } }

.empty { display: grid; justify-items: center; gap: var(--k-sp-2); padding: var(--k-sp-8) var(--k-sp-4); text-align: center; color: var(--k-muted); }
.emptyTitle { font: 500 var(--k-fs-1) / var(--k-lh-1) var(--k-sans); color: var(--k-ink2); }
.emptyText { font-size: var(--k-fs-2); }
.error .emptyTitle { color: var(--k-bad); }
```
В `tokens.src.ts` добавить `'progress': 3` и `pnpm gen`.

`packages/ui/src/state/index.ts`:
```ts
export { Skeleton, dimClass } from './Skeleton'
export { ProgressBar } from './ProgressBar'
export { EmptyState, type EmptyStateProps } from './EmptyState'
export { ErrorState, type ErrorStateProps } from './ErrorState'
export { useLoadingGate, type LoadingGateOptions } from './useLoadingGate'
```
В `packages/ui/src/index.ts` добавить `export * from './state'`.

- [ ] **Step 5: Тесты проходят**

Run: `pnpm gen && pnpm --filter @katran/ui test state && pnpm lint`
Expected: PASS, 7 тестов.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Состояния загрузки: скелетон с порогом 200/400 мс, прогресс, пустое и ошибка"
```

---

### Task 13: `Pagination`

**Files:**
- Create: `packages/ui/src/pagination/Pagination.tsx`, `Pagination.module.css`, `Pagination.test.tsx`, `index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- `<Pagination page: number pageSize: number total: number onPage: (p: number) => void pageSizes?: number[] onPageSize?: (n) => void>` — страницы с 1 (спека: бек нумерует с 0, фронт показывает `+1`; преобразование делает модель, не компонент). Выводит «1–20 из 87», кнопки «Назад»/«Вперёд», окно номеров: первая, последняя, текущая ±1, пропуски «…». `nav aria-label="Страницы"`, текущая — `aria-current="page"`. При `total === 0` — только «0 из 0», кнопки недоступны.
- `pageWindow(page, pages): (number | '…')[]` — чистая функция, экспортируется для тестов.

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/pagination/Pagination.test.tsx`:
```tsx
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Pagination, pageWindow } from './Pagination'

describe('pageWindow', () => {
  it('мало страниц — все', () => expect(pageWindow(2, 4)).toEqual([1, 2, 3, 4]))
  it('середина — края и соседи с пропусками', () => expect(pageWindow(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]))
  it('у края — без лишнего пропуска', () => expect(pageWindow(2, 10)).toEqual([1, 2, 3, '…', 10]))
})

describe('Pagination', () => {
  it('диапазон, текущая страница, переходы', async () => {
    const onPage = vi.fn()
    renderK(<Pagination page={2} pageSize={20} total={87} onPage={onPage} />)
    expect(screen.getByText('21–40 из 87')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Страница 2' })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(screen.getByRole('button', { name: 'Вперёд' }))
    expect(onPage).toHaveBeenCalledWith(3)
    await userEvent.click(screen.getByRole('button', { name: 'Страница 5' }))
    expect(onPage).toHaveBeenCalledWith(5)
  })
  it('на последней странице Вперёд недоступна; пусто — 0 из 0', () => {
    const { rerender } = renderK(<Pagination page={5} pageSize={20} total={87} onPage={() => {}} />)
    expect(screen.getByRole('button', { name: 'Вперёд' })).toBeDisabled()
    rerender(<Pagination page={1} pageSize={20} total={0} onPage={() => {}} />)
    expect(screen.getByText('0 из 0')).toBeInTheDocument()
  })
  it('размер страницы', async () => {
    const onPageSize = vi.fn()
    renderK(<Pagination page={1} pageSize={20} total={87} onPage={() => {}} pageSizes={[20, 50]} onPageSize={onPageSize} />)
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'На странице' }), '50')
    expect(onPageSize).toHaveBeenCalledWith(50)
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<Pagination page={1} pageSize={20} total={87} onPage={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

- [ ] **Step 2: Реализация**

`packages/ui/src/pagination/Pagination.tsx`:
```tsx
import { Button } from '../button'
import { Select } from '../input'
import s from './Pagination.module.css'

export type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  pageSizes?: number[]
  onPageSize?: (n: number) => void
}

/** Окно номеров: первая, последняя, текущая ±1; пропуски только если скрыто ≥ 2 страниц. */
export function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined) {
      if (p - prev === 2) out.push(prev + 1)
      else if (p - prev > 2) out.push('…')
    }
    out.push(p)
  })
  return out
}

export function Pagination({ page, pageSize, total, onPage, pageSizes, onPageSize }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const range = total === 0 ? '0 из 0' : `${from}–${to} из ${total}`
  return (
    <nav aria-label="Страницы" className={s.nav}>
      <span className={s.range}>{range}</span>
      {pageSizes && onPageSize && (
        <Select size="s" aria-label="На странице" value={String(pageSize)} onChange={(e) => onPageSize(Number(e.target.value))}
          options={pageSizes.map((n) => ({ value: String(n), label: String(n) }))} />
      )}
      <span className={s.pages}>
        <Button size="s" disabled={page <= 1 || total === 0} onClick={() => onPage(page - 1)}>Назад</Button>
        {total > 0 && pageWindow(page, pages).map((p, i) =>
          p === '…'
            ? <span key={`gap${i}`} className={s.gap} aria-hidden="true">…</span>
            : <Button key={p} size="s" pressed={p === page} aria-current={p === page ? 'page' : undefined} aria-label={`Страница ${p}`} onClick={() => onPage(p)}>{p}</Button>,
        )}
        <Button size="s" disabled={page >= pages || total === 0} onClick={() => onPage(page + 1)}>Вперёд</Button>
      </span>
    </nav>
  )
}
```

`packages/ui/src/pagination/Pagination.module.css`:
```css
.nav { display: flex; align-items: center; gap: var(--k-sp-3); padding: var(--k-sp-2) var(--k-sp-5); border-top: 1px solid var(--k-line); font-size: var(--k-fs-2); color: var(--k-muted); }
.range { white-space: nowrap; }
.pages { display: flex; align-items: center; gap: var(--k-sp-1); margin-left: auto; }
.gap { padding: 0 var(--k-sp-1); color: var(--k-faint); }
```

`packages/ui/src/pagination/index.ts`:
```ts
export { Pagination, pageWindow, type PaginationProps } from './Pagination'
```
В `packages/ui/src/index.ts` добавить `export * from './pagination'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/ui test pagination && pnpm lint`
Expected: PASS, 7 тестов. Внимание: `Button` с `pressed` даёт `aria-pressed`, и одновременно `aria-current` — axe это допускает; если нет — убрать `pressed` и стилизовать по `[aria-current]` в `Button.module.css` (`.ghost[aria-current="page"]` тем же правилом, что и `aria-pressed`).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Pagination: диапазон, окно номеров, размер страницы"
```

---

### Task 14: Демо-приложение и GitHub Pages

**Files:**
- Create: `apps/demo/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/router.ts`, `src/Shell.tsx`, `src/Shell.module.css`, `src/pages/TokensPage.tsx`, `ButtonsPage.tsx`, `InputsPage.tsx`, `ValuesPage.tsx`, `OverlaysPage.tsx`, `StatesPage.tsx`, `PaginationPage.tsx`, `src/pages/Page.module.css`
- Create: `.github/workflows/pages.yml`
- Modify: root `package.json` (скрипт `dev`), `.claude/launch.json` в **корне сессии `/Users/shaman/_CODE/VTB`** — добавить запись `katran-demo` (не трогать существующие записи; после работы не нужно восстанавливать — запись постоянная).

**Interfaces:**
- Демо не публикуется как пакет; импортирует `@katran/ui` и `@katran/tokens` по workspace. Маршрутизация — хеш (`#/tokens`, `#/buttons`, …), без сторонних библиотек. `Shell` — левое меню разделов, справа страница; в шапке `ThemeSwitch` (light/dark/system) и `DensitySwitch` (100/110/125 %) — оба живут в демо как обычные кнопки на `useKatran()`, в кит не выносятся до появления второго потребителя.
- Страница токенов: палитра обеих тем плашками с именем, hex и контрастом к `paper`; шкала кеглей; пример плотности (три контрола рядом); тень и радиусы.
- Каждая страница компонента: живые примеры всех вариантов + короткое описание правил (одна-две строки из спеки).

- [ ] **Step 1: Пакет демо**

`apps/demo/package.json`:
```json
{
  "name": "demo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": { "dev": "vite --port 5180 --strictPort", "build": "tsc -p tsconfig.json --noEmit && vite build", "preview": "vite preview --port 5180" },
  "dependencies": { "@katran/tokens": "workspace:*", "@katran/ui": "workspace:*", "react": "^19", "react-dom": "^19" },
  "devDependencies": { "@types/react": "^19", "@types/react-dom": "^19", "@vitejs/plugin-react": "^6", "vite": "^8" }
}
```
`apps/demo/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "noEmit": true }, "include": ["src", "../../packages/ui/src/css-modules.d.ts"] }
```
`apps/demo/vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Pages отдаёт сайт из /katran/
  base: process.env.PAGES_BASE ?? '/',
  css: { modules: { generateScopedName: 'k-[name]__[local]', localsConvention: 'camelCaseOnly' } },
})
```
`apps/demo/index.html`:
```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>katran — дизайн-система</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
Run: `pnpm install` (подтянет workspace-ссылки). В корневой `package.json` добавить скрипт `"dev": "pnpm --filter demo dev"`.

- [ ] **Step 2: Оболочка и роутер**

`apps/demo/src/router.ts`:
```ts
import { useEffect, useState } from 'react'

export type Route = 'tokens' | 'buttons' | 'inputs' | 'values' | 'overlays' | 'states' | 'pagination'
export const routes: { id: Route; title: string }[] = [
  { id: 'tokens', title: 'Токены' },
  { id: 'buttons', title: 'Кнопки' },
  { id: 'inputs', title: 'Поля ввода' },
  { id: 'values', title: 'Значения' },
  { id: 'overlays', title: 'Меню и поповеры' },
  { id: 'states', title: 'Состояния' },
  { id: 'pagination', title: 'Пагинация' },
]
const parse = (): Route => {
  const h = location.hash.replace(/^#\/?/, '') as Route
  return routes.some((r) => r.id === h) ? h : 'tokens'
}
export function useRoute(): Route {
  const [r, setR] = useState<Route>(parse)
  useEffect(() => {
    const on = () => setR(parse())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}
```

`apps/demo/src/Shell.tsx`:
```tsx
import type { ReactNode } from 'react'
import { Button, useKatran, type Theme } from '@katran/ui'
import { densityOptions, type Density } from '@katran/tokens'
import { routes, type Route } from './router'
import s from './Shell.module.css'

const themes: { id: Theme; title: string }[] = [{ id: 'light', title: 'Светлая' }, { id: 'dark', title: 'Тёмная' }, { id: 'system', title: 'Системная' }]

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const k = useKatran()
  return (
    <div className={s.shell}>
      <aside className={s.side}>
        <div className={s.brand}>katran</div>
        <nav aria-label="Разделы">
          {routes.map((r) => (
            <a key={r.id} href={`#/${r.id}`} className={s.link} aria-current={r.id === route ? 'page' : undefined}>{r.title}</a>
          ))}
        </nav>
      </aside>
      <div className={s.main}>
        <header className={s.head}>
          <div className={s.group} role="group" aria-label="Тема">
            {themes.map((t) => <Button key={t.id} size="s" pressed={k.theme === t.id} onClick={() => k.setTheme(t.id)}>{t.title}</Button>)}
          </div>
          <div className={s.group} role="group" aria-label="Плотность">
            {densityOptions.map((d: Density) => <Button key={d} size="s" pressed={k.density === d} onClick={() => k.setDensity(d)}>{Math.round(d * 100)} %</Button>)}
          </div>
        </header>
        <main className={s.content}>{children}</main>
      </div>
    </div>
  )
}
```

`apps/demo/src/Shell.module.css`:
```css
.shell { display: grid; grid-template-columns: var(--k-side) 1fr; min-height: 100vh; background: var(--k-ground); }
.side { padding: var(--k-sp-4); border-right: 1px solid var(--k-line); background: var(--k-paper); }
.brand { font: 700 var(--k-fs-h1) / 1 var(--k-sans); letter-spacing: -0.01em; margin-bottom: var(--k-sp-4); }
.link { display: block; padding: var(--k-sp-1) var(--k-sp-2); border-radius: var(--k-r-s); color: var(--k-ink2); text-decoration: none; }
.link:hover { background: var(--k-hover); }
.link[aria-current="page"] { color: var(--k-val); background: var(--k-val-soft); }
.main { display: flex; flex-direction: column; min-width: 0; }
.head { display: flex; gap: var(--k-sp-4); padding: var(--k-sp-2) var(--k-sp-5); border-bottom: 1px solid var(--k-line); background: var(--k-paper); }
.group { display: inline-flex; gap: var(--k-sp-1); }
.content { padding: var(--k-sp-5); }
```
В `tokens.src.ts` добавить `'side': 200` — и это последний размер, который добавляет этот план; `pnpm gen`.

`apps/demo/src/App.tsx`:
```tsx
import { KatranProvider } from '@katran/ui'
import { Shell } from './Shell'
import { useRoute } from './router'
import { TokensPage } from './pages/TokensPage'
import { ButtonsPage } from './pages/ButtonsPage'
import { InputsPage } from './pages/InputsPage'
import { ValuesPage } from './pages/ValuesPage'
import { OverlaysPage } from './pages/OverlaysPage'
import { StatesPage } from './pages/StatesPage'
import { PaginationPage } from './pages/PaginationPage'

const pages = { tokens: TokensPage, buttons: ButtonsPage, inputs: InputsPage, values: ValuesPage, overlays: OverlaysPage, states: StatesPage, pagination: PaginationPage }

export function App() {
  const route = useRoute()
  const Page = pages[route]
  return (
    <KatranProvider storageKey="katran-demo">
      <Shell route={route}><Page /></Shell>
    </KatranProvider>
  )
}
```
`apps/demo/src/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client'
import '@katran/tokens/fonts.css'
import { App } from './App'

createRoot(document.getElementById('root')!).render(<App />)
```
Глобальный сброс: в `index.html` в `<head>` добавить `<style>html,body,#root{margin:0;height:100%}</style>` — единственный инлайн-стиль демо.

- [ ] **Step 3: Страницы**

`apps/demo/src/pages/Page.module.css`:
```css
.h1 { font: 700 var(--k-fs-h1) / 1.2 var(--k-sans); margin: 0 0 var(--k-sp-2); }
.note { color: var(--k-muted); margin: 0 0 var(--k-sp-5); max-width: var(--k-note-max); }
.h2 { font: 600 var(--k-fs-1) / 1.2 var(--k-sans); margin: var(--k-sp-5) 0 var(--k-sp-2); color: var(--k-ink2); }
.row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--k-sp-2); padding: var(--k-sp-3); border: 1px solid var(--k-line); border-radius: var(--k-r-m); background: var(--k-paper); }
.swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--k-swatch), 1fr)); gap: var(--k-sp-2); }
.swatch { border: 1px solid var(--k-line); border-radius: var(--k-r-m); overflow: hidden; background: var(--k-paper); }
.swatchColor { height: var(--k-sp-8); }
.swatchMeta { padding: var(--k-sp-1) var(--k-sp-2); font: 400 var(--k-fs-3) / var(--k-lh-3) var(--k-mono); color: var(--k-ink2); }
.type { display: grid; gap: var(--k-sp-1); }
```
Добавить в `tokens.src.ts`: `'note-max': 640, 'swatch': 150` (исключение из «последнего размера» выше — эти два нужны только демо, поэтому допустимо; итого в этом плане добавлены `tip-max, dot-s, dot-m, counter, menu-min, progress, side, note-max, swatch`). `pnpm gen`.

`apps/demo/src/pages/TokensPage.tsx`:
```tsx
import { colors, sizes } from '@katran/tokens'
import { Button, Input } from '@katran/ui'
import s from './Page.module.css'

// Контраст к paper считается прямо здесь, чтобы страница не зависела от внутренностей пакета токенов
const lum = (hex: string) => {
  const [r, g, b] = hex.replace('#', '').match(/.{2}/g)!.map((x) => parseInt(x, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return ((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2) }

export function TokensPage() {
  return (
    <>
      <h1 className={s.h1}>Токены</h1>
      <p className={s.note}>Единственный источник — <code>tokens.src.ts</code>. Размеры умножены на плотность: переключите её в шапке — все контролы ниже изменятся, координаты останутся честными.</p>

      {(['light', 'dark'] as const).map((theme) => (
        <section key={theme} data-theme={theme}>
          <h2 className={s.h2}>Палитра — {theme === 'light' ? 'светлая' : 'тёмная'} (контраст к paper)</h2>
          <div className={s.swatches}>
            {Object.entries(colors[theme]).map(([name, hex]) => (
              <div key={name} className={s.swatch}>
                <div className={s.swatchColor} style={{ background: hex }} />
                <div className={s.swatchMeta}>--k-{name}<br />{hex} · {ratio(hex, colors[theme].paper)}</div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <h2 className={s.h2}>Кегли</h2>
      <div className={[s.row, s.type].join(' ')}>
        {(['fs-h1', 'fs-1', 'fs-2', 'fs-3'] as const).map((k) => (
          <div key={k} style={{ fontSize: `var(--k-${k})` }}>--k-{k} · {sizes[k]} px · Платёжная инструкция MT202</div>
        ))}
      </div>

      <h2 className={s.h2}>Плотность</h2>
      <div className={s.row}>
        <Button size="s">24</Button><Button>28</Button><Button size="l">32</Button>
        <Input size="m" placeholder="Поле 28" />
      </div>
    </>
  )
}
```

`apps/demo/src/pages/ButtonsPage.tsx`:
```tsx
import { Button, IconButton } from '@katran/ui'
import s from './Page.module.css'

const Gear = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5 13 13M3 13l1.5-1.5M11.5 4.5 13 3" /></svg>

export function ButtonsPage() {
  return (
    <>
      <h1 className={s.h1}>Кнопки</h1>
      <p className={s.note}>Primary — одно главное действие на экран. Ghost — всё остальное. IconButton требует имя: у иконки текста нет.</p>
      <h2 className={s.h2}>Варианты и размеры</h2>
      <div className={s.row}>
        <Button variant="primary">Применить</Button><Button>Сбросить</Button><Button disabled>Недоступно</Button>
        <Button size="s">Малая</Button><Button size="l">Большая</Button>
      </div>
      <h2 className={s.h2}>Переключатель</h2>
      <div className={s.row}><Button pressed>Скелетоны</Button><Button>График</Button></div>
      <h2 className={s.h2}>Иконки</h2>
      <div className={s.row}><IconButton label="Настройки"><Gear /></IconButton><IconButton label="Настройки" size="s"><Gear /></IconButton><IconButton label="Настройки" pressed><Gear /></IconButton></div>
    </>
  )
}
```

`apps/demo/src/pages/InputsPage.tsx`:
```tsx
import { useState } from 'react'
import { Checkbox, Input, Select } from '@katran/ui'
import s from './Page.module.css'

export function InputsPage() {
  const [ind, setInd] = useState(true)
  return (
    <>
      <h1 className={s.h1}>Поля ввода</h1>
      <p className={s.note}>Нативные элементы под токенами: клавиатура, автозаполнение и скринридеры работают без усилий.</p>
      <h2 className={s.h2}>Input</h2>
      <div className={s.row}>
        <Input aria-label="Поиск" placeholder="Поиск по реестру" prefix={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5" /></svg>} />
        <Input aria-label="Номер" defaultValue="A1B2C3" invalid />
        <Input aria-label="Малое" size="s" placeholder="s" /><Input aria-label="Большое" size="l" placeholder="l" />
      </div>
      <h2 className={s.h2}>Checkbox</h2>
      <div className={s.row}>
        <Checkbox label="Выбрать все" indeterminate={ind} onChange={() => setInd(false)} />
        <Checkbox label="Отложенные" defaultChecked /><Checkbox label="Недоступно" disabled />
      </div>
      <h2 className={s.h2}>Select</h2>
      <div className={s.row}>
        <Select aria-label="Тип сообщения" placeholder="Тип" options={['MT103', 'MT202', 'MT202COV', 'MT199'].map((v) => ({ value: v, label: v }))} />
        <Select aria-label="Размер" size="s" options={[20, 50].map((v) => ({ value: String(v), label: String(v) }))} />
      </div>
    </>
  )
}
```

`apps/demo/src/pages/ValuesPage.tsx`:
```tsx
import { AccountValue, CopyValue, Counter, FieldTag, LinkValue, StatusDot, Tag, type StatusTone } from '@katran/ui'
import s from './Page.module.css'

const tones: StatusTone[] = ['flow', 'flowl', 'flowd', 'bad', 'badd', 'warn', 'ok', 'okl', 'grey']

export function ValuesPage() {
  return (
    <>
      <h1 className={s.h1}>Значения</h1>
      <p className={s.note}>Каждое значение — отдельный элемент: клик копирует, тултип с полным значением только если обрезано или показано сокращённо. Наведите на длинное значение справа.</p>
      <h2 className={s.h2}>CopyValue</h2>
      <div className={s.row}>
        <CopyValue value="DEUTDEFFXXX" /><CopyValue value="Общество с ограниченной ответственностью «Северный ветер»" maxWidth={180} />
        <CopyValue value="12,5" tone="ink" /><CopyValue value="2026-09-22T07:33:22" display="22.09 07:33:22" short />
      </div>
      <h2 className={s.h2}>LinkValue и AccountValue</h2>
      <div className={s.row}>
        <LinkValue name="uuid" value="0f3c9a2e-7b1d-4c8e-9f0a-1b2c3d4e5f60" /><LinkValue name="refIn" value="REF20260922001" /><LinkValue name="refOut" />
        <AccountValue value="40702840500000012345" /><AccountValue value="40702840500000012345" full />
      </div>
      <h2 className={s.h2}>FieldTag, Tag, Counter, StatusDot</h2>
      <div className={s.row}>
        <FieldTag tag="70" title="70 · Детали платежа" /><FieldTag tag="50K" title="50K · Приказодатель (счёт + имя)" />
        <Tag>ЕРС</Tag><Tag>LORO</Tag><Tag tone="opt">COV</Tag>
        <Counter value={12} /><Counter value={12} active /><Counter value={0} />
      </div>
      <div className={s.row}>
        {tones.map((t) => <StatusDot key={t} tone={t} label={t} />)}
        <StatusDot tone="bad" letter="!" label="Ошибка" /><StatusDot tone="ok" size="s" />
      </div>
    </>
  )
}
```

`apps/demo/src/pages/OverlaysPage.tsx`:
```tsx
import { useRef, useState } from 'react'
import { Button, Input, Menu, Popover } from '@katran/ui'
import s from './Page.module.css'

export function OverlaysPage() {
  const [menu, setMenu] = useState(false)
  const [pop, setPop] = useState(false)
  const [sort, setSort] = useState('status')
  const m = useRef<HTMLButtonElement>(null)
  const p = useRef<HTMLButtonElement>(null)
  const keys = [{ id: 'status', label: 'Статус' }, { id: 'reason', label: 'Причина статуса' }, { id: 'created', label: 'Дата документа' }]
  return (
    <>
      <h1 className={s.h1}>Меню и поповеры</h1>
      <p className={s.note}>Меню сортировки составной колонки: выбранный ключ отмечен, стрелки ходят по пунктам, Escape закрывает и возвращает фокус.</p>
      <div className={s.row}>
        <Button ref={m} onClick={() => setMenu(true)}>Сортировать «Статус» по…</Button>
        <Menu open={menu} anchor={m} onClose={() => setMenu(false)} title="Сортировать «Статус» по"
          items={keys.map((k) => ({ id: k.id, label: k.label, checked: sort === k.id, hint: sort === k.id ? '↑' : undefined, onSelect: () => setSort(k.id) }))} />
        <Button ref={p} onClick={() => setPop(true)}>Фильтр по сумме</Button>
        <Popover open={pop} anchor={p} onClose={() => setPop(false)} label="Фильтр по сумме">
          <div style={{ display: 'grid', gap: 'var(--k-sp-2)', padding: 'var(--k-sp-2)' }}>
            <Input aria-label="От" placeholder="от" /><Input aria-label="До" placeholder="до" />
            <Button variant="primary" onClick={() => setPop(false)}>Применить</Button>
          </div>
        </Popover>
      </div>
    </>
  )
}
```

`apps/demo/src/pages/StatesPage.tsx`:
```tsx
import { useState } from 'react'
import { Button, EmptyState, ErrorState, ProgressBar, Skeleton, dimClass, useLoadingGate } from '@katran/ui'
import s from './Page.module.css'

export function StatesPage() {
  const [loading, setLoading] = useState(false)
  const show = useLoadingGate(loading)
  const simulate = (ms: number) => { setLoading(true); setTimeout(() => setLoading(false), ms) }
  return (
    <>
      <h1 className={s.h1}>Состояния</h1>
      <p className={s.note}>Скелетон показывается только если загрузка дольше 200 мс и держится не меньше 400 мс — быстрый ответ не мигает. Нажмите «100 мс» и «800 мс».</p>
      <div className={s.row}>
        <Button onClick={() => simulate(100)}>Загрузка 100 мс</Button><Button onClick={() => simulate(800)}>Загрузка 800 мс</Button>
        <span style={{ minWidth: 'var(--k-swatch)' }}>{show ? <Skeleton.Line lines={2} width="60%" /> : <span className={loading ? dimClass : ''}>Данные показаны</span>}</span>
      </div>
      <h2 className={s.h2}>Прогресс обновления</h2>
      <div className={s.row} style={{ display: 'block', padding: 0 }}><ProgressBar label="Обновление данных" /></div>
      <h2 className={s.h2}>Пусто и ошибка</h2>
      <div className={s.row}><EmptyState title="По заданным условиям документов нет" action={{ label: 'Сбросить фильтр', onClick: () => {} }} /></div>
      <div className={s.row}><ErrorState title="Не удалось загрузить реестр" text="Сервис не ответил за 10 с" retry={() => {}} /></div>
    </>
  )
}
```

`apps/demo/src/pages/PaginationPage.tsx`:
```tsx
import { useState } from 'react'
import { Pagination } from '@katran/ui'
import s from './Page.module.css'

export function PaginationPage() {
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  return (
    <>
      <h1 className={s.h1}>Пагинация</h1>
      <p className={s.note}>87 записей — как на эталоне. Страницы с 1; преобразование к нулевой нумерации бека — в модели.</p>
      <div className={s.row} style={{ display: 'block', padding: 0 }}>
        <Pagination page={page} pageSize={size} total={87} onPage={setPage} pageSizes={[20, 50]} onPageSize={(n) => { setSize(n); setPage(1) }} />
      </div>
    </>
  )
}
```

- [ ] **Step 4: Запуск и проверка в браузере**

В `/Users/shaman/_CODE/VTB/.claude/launch.json` добавить конфигурацию:
```json
{ "name": "katran-demo", "runtimeExecutable": "pnpm", "runtimeArgs": ["--dir", "katran", "--filter", "demo", "dev"], "port": 5180 }
```
Открыть превью `katran-demo` (инструмент `preview_start` с этим именем — не через Bash). Проверить: консоль без ошибок; переключение темы меняет фон; переключение плотности меняет высоту кнопок (замерить `getBoundingClientRect().height` у `Button` — 28 при 100 %, 35 при 125 %); шрифты IBM Plex загружены (`document.fonts.check('12px "IBM Plex Sans"')` → `true`); тултип на длинном `CopyValue` появляется, на коротком — нет; меню ходит стрелками. Снять скриншот страницы значений в обеих темах.

- [ ] **Step 5: Сборка и Pages**

`.github/workflows/pages.yml`:
```yaml
name: pages
on:
  push: { branches: [main] }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: PAGES_BASE=/katran/ pnpm --filter demo build
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/demo/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
Run: `pnpm check` — всё зелёное, включая `pnpm --filter demo build`.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Демо: оболочка с темой и плотностью, страница токенов и страницы примитивов, публикация на Pages"
```
Публикация на GitHub (создание репозитория `ivanklimenko/katran`, `git push`) — только по явной команде владельца. Задача 15 добавляет страницу «Табы» — выполнять её до публикации.

---

### Task 15: `Tabs`, `TabPanel`

**Files:**
- Create: `packages/ui/src/tabs/Tabs.tsx`, `TabPanel.tsx`, `Tabs.module.css`, `Tabs.test.tsx`, `index.ts`
- Create: `apps/demo/src/pages/TabsPage.tsx`
- Modify: `packages/ui/src/index.ts`, `apps/demo/src/router.ts` (маршрут `tabs`, заголовок «Табы»), `apps/demo/src/App.tsx` (страница в `pages`)

**Interfaces:**
- `<Tabs id: string items: TabItem[] value: string onChange: (id) => void orientation?: 'horizontal'|'vertical' label: string>`; `TabItem = { id: string; label: string; count?: number; disabled?: boolean }`. Паттерн WAI-ARIA Tabs с **ручной активацией**: стрелки двигают фокус (← → для горизонтальных, ↑ ↓ для вертикальных), `Home`/`End`, `Enter`/`Space` выбирают. Ручная — потому что переключение реестра грузит данные, автоматическая активация по стрелке дёргала бы запросы.
- `<TabPanel tabsId tabId active children>` — `role="tabpanel"`, `aria-labelledby` = id таба, `hidden` когда не активна. Идентификаторы: таб `${id}-tab-${item.id}`, панель `${id}-panel-${item.id}`; `Tabs` ставит `aria-controls`.
- Вид: горизонтальные — сегментный контрол (дорожка `sunk`, активный сегмент `paper` с рамкой `line`, текст `ink`; как в проде «Документы / Архив документов / Исследование»); вертикальные — список, активный пункт с полосой `val` слева и фоном `val-soft` (как «Управление приоритетами»). `count` — `Counter` справа от подписи.
- Переполнение в «••• N» — не здесь (план деталки).

- [ ] **Step 1: Тест (падает)**

`packages/ui/src/tabs/Tabs.test.tsx`:
```tsx
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { TabPanel } from './TabPanel'
import { Tabs, type TabItem } from './Tabs'

const items: TabItem[] = [
  { id: 'docs', label: 'Документы', count: 84 },
  { id: 'archive', label: 'Архив документов' },
  { id: 'research', label: 'Исследование', disabled: true },
  { id: 'prio', label: 'Приоритеты' },
]

function Host({ orientation }: { orientation?: 'horizontal' | 'vertical' }) {
  const [v, setV] = useState('docs')
  return (
    <>
      <Tabs id="reg" label="Разделы реестра" items={items} value={v} onChange={setV} orientation={orientation} />
      {items.map((it) => <TabPanel key={it.id} tabsId="reg" tabId={it.id} active={v === it.id}>Панель {it.label}</TabPanel>)}
    </>
  )
}

describe('Tabs', () => {
  it('роли, выбранный таб, связь с панелью, счётчик', () => {
    renderK(<Host />)
    const list = screen.getByRole('tablist', { name: 'Разделы реестра' })
    expect(list).toHaveAttribute('aria-orientation', 'horizontal')
    const docs = screen.getByRole('tab', { name: /Документы/ })
    expect(docs).toHaveAttribute('aria-selected', 'true')
    expect(docs).toHaveTextContent('84')
    const panel = screen.getByRole('tabpanel', { name: /Документы/ })
    expect(docs).toHaveAttribute('aria-controls', panel.id)
    expect(screen.queryByText('Панель Архив документов')).toBeNull()
  })

  it('стрелка двигает фокус, пропуская недоступный; выбор — по Enter (ручная активация)', async () => {
    renderK(<Host />)
    screen.getByRole('tab', { name: /Документы/ }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Архив документов' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: /Документы/ })).toHaveAttribute('aria-selected', 'true')
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Приоритеты' })).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('tab', { name: 'Приоритеты' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Панель Приоритеты')).toBeVisible()
  })

  it('вертикальные: ↑↓ и aria-orientation', async () => {
    renderK(<Host orientation="vertical" />)
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-orientation', 'vertical')
    screen.getByRole('tab', { name: /Документы/ }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('tab', { name: 'Архив документов' })).toHaveFocus()
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Приоритеты' })).toHaveFocus()
  })

  it('клик выбирает; недоступный не выбирается', async () => {
    renderK(<Host />)
    await userEvent.click(screen.getByRole('tab', { name: 'Архив документов' }))
    expect(screen.getByRole('tab', { name: 'Архив документов' })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(screen.getByRole('tab', { name: 'Исследование' }))
    expect(screen.getByRole('tab', { name: 'Архив документов' })).toHaveAttribute('aria-selected', 'true')
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<Host />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```
Run: `pnpm --filter @katran/ui test tabs`
Expected: FAIL.

- [ ] **Step 2: Реализация**

`packages/ui/src/tabs/Tabs.tsx`:
```tsx
import { useRef, type KeyboardEvent } from 'react'
import { Counter } from '../value'
import s from './Tabs.module.css'

export type TabItem = { id: string; label: string; count?: number; disabled?: boolean }
export type TabsProps = {
  /** Префикс идентификаторов: таб `${id}-tab-${item}`, панель `${id}-panel-${item}`. */
  id: string
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  orientation?: 'horizontal' | 'vertical'
  /** Доступное имя списка табов. */
  label: string
}

export const tabId = (tabs: string, item: string) => `${tabs}-tab-${item}`
export const panelId = (tabs: string, item: string) => `${tabs}-panel-${item}`

/** WAI-ARIA Tabs с ручной активацией: стрелки двигают фокус, Enter/Space выбирает. */
export function Tabs({ id, items, value, onChange, orientation = 'horizontal', label }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const enabled = items.filter((it) => !it.disabled)
  const focusAt = (i: number) => { const it = enabled[(i + enabled.length) % enabled.length]; if (it) refs.current[it.id]?.focus() }

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, it: TabItem) => {
    const pos = enabled.findIndex((x) => x.id === it.id)
    const next = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight'
    const prev = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft'
    if (e.key === next) { e.preventDefault(); focusAt(pos + 1) }
    else if (e.key === prev) { e.preventDefault(); focusAt(pos - 1) }
    else if (e.key === 'Home') { e.preventDefault(); focusAt(0) }
    else if (e.key === 'End') { e.preventDefault(); focusAt(enabled.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange(it.id) }
  }

  return (
    <div role="tablist" aria-label={label} aria-orientation={orientation} className={[s.list, s[orientation]].join(' ')}>
      {items.map((it) => {
        const selected = it.id === value
        return (
          <button
            key={it.id}
            ref={(el) => { refs.current[it.id] = el }}
            type="button"
            role="tab"
            id={tabId(id, it.id)}
            aria-selected={selected}
            aria-controls={panelId(id, it.id)}
            aria-disabled={it.disabled || undefined}
            disabled={it.disabled}
            tabIndex={selected ? 0 : -1}
            className={s.tab}
            onClick={() => !it.disabled && onChange(it.id)}
            onKeyDown={(e) => onKey(e, it)}
          >
            <span>{it.label}</span>
            {it.count !== undefined && <Counter value={it.count} active={selected} />}
          </button>
        )
      })}
    </div>
  )
}
```

`packages/ui/src/tabs/TabPanel.tsx`:
```tsx
import type { ReactNode } from 'react'
import { panelId, tabId } from './Tabs'

export type TabPanelProps = { tabsId: string; tabId: string; active: boolean; children: ReactNode; className?: string }

export function TabPanel({ tabsId, tabId: item, active, children, className }: TabPanelProps) {
  return (
    <div role="tabpanel" id={panelId(tabsId, item)} aria-labelledby={tabId(tabsId, item)} hidden={!active} tabIndex={0} className={className}>
      {active && children}
    </div>
  )
}
```

`packages/ui/src/tabs/Tabs.module.css`:
```css
.list { display: flex; }
.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--k-sp-2);
  border: 1px solid transparent;
  background: none;
  font: 500 var(--k-fs-1) / 1 var(--k-sans);
  color: var(--k-ink2);
  cursor: pointer;
  white-space: nowrap;
  transition: background var(--k-t-fast), color var(--k-t-fast);
}
.tab:disabled { color: var(--k-faint); cursor: default; }
.tab:focus-visible { outline: 2px solid var(--k-val); outline-offset: -2px; }

/* горизонтальные — сегментный контрол */
.horizontal { gap: var(--k-sp-1); padding: var(--k-sp-1); border-radius: var(--k-r-m); background: var(--k-sunk); width: max-content; }
.horizontal .tab { height: var(--k-h-ctl-m); padding: 0 var(--k-sp-3); border-radius: var(--k-r-s); }
.horizontal .tab:hover:not(:disabled) { color: var(--k-ink); }
.horizontal .tab[aria-selected="true"] { background: var(--k-paper); border-color: var(--k-line); color: var(--k-ink); }

/* вертикальные — список с маркером слева */
.vertical { flex-direction: column; gap: 0; border-right: 1px solid var(--k-line); min-width: var(--k-side); }
.vertical .tab { height: var(--k-h-ctl-l); padding: 0 var(--k-sp-4); border-left: 3px solid transparent; justify-content: space-between; text-align: left; }
.vertical .tab:hover:not(:disabled) { background: var(--k-hover); }
.vertical .tab[aria-selected="true"] { border-left-color: var(--k-val); background: var(--k-val-soft); color: var(--k-val); }
```

`packages/ui/src/tabs/index.ts`:
```ts
export { Tabs, tabId, panelId, type TabsProps, type TabItem } from './Tabs'
export { TabPanel, type TabPanelProps } from './TabPanel'
```
В `packages/ui/src/index.ts` добавить `export * from './tabs'`.

- [ ] **Step 3: Тесты проходят**

Run: `pnpm --filter @katran/ui test tabs && pnpm lint`
Expected: PASS, 5 тестов. Если `toBeVisible` спотыкается о `hidden` у соседних панелей — проверять `screen.getByRole('tabpanel', { name: 'Приоритеты' })` вместо текста.

- [ ] **Step 4: Страница демо**

В `apps/demo/src/router.ts` добавить `'tabs'` в тип `Route` и `{ id: 'tabs', title: 'Табы' }` в `routes`; в `App.tsx` — `tabs: TabsPage`.

`apps/demo/src/pages/TabsPage.tsx`:
```tsx
import { useState } from 'react'
import { TabPanel, Tabs } from '@katran/ui'
import s from './Page.module.css'

const reg = [{ id: 'docs', label: 'Документы', count: 84 }, { id: 'archive', label: 'Архив документов' }, { id: 'research', label: 'Исследование' }]
const prio = [{ id: 'system', label: 'По системе-инициатору' }, { id: 'urgency', label: 'По срочности' }, { id: 'amount', label: 'По сумме' }, { id: 'threshold', label: 'Управление порогом' }]

export function TabsPage() {
  const [r, setR] = useState('docs')
  const [p, setP] = useState('urgency')
  return (
    <>
      <h1 className={s.h1}>Табы</h1>
      <p className={s.note}>Ручная активация: стрелки двигают фокус, Enter выбирает — переключение реестра грузит данные, и автоматика дёргала бы запросы. Горизонтальные — переключение реестров в одном блоке, вертикальные — группа близких справочников в одном федеративном блоке.</p>
      <h2 className={s.h2}>Горизонтальные</h2>
      <div className={s.row} style={{ display: 'block' }}>
        <Tabs id="reg" label="Разделы реестра" items={reg} value={r} onChange={setR} />
        {reg.map((it) => <TabPanel key={it.id} tabsId="reg" tabId={it.id} active={r === it.id}><p>Здесь будет реестр «{it.label}».</p></TabPanel>)}
      </div>
      <h2 className={s.h2}>Вертикальные</h2>
      <div className={s.row} style={{ display: 'flex', alignItems: 'stretch', padding: 0, gap: 0 }}>
        <Tabs id="prio" label="Управление приоритетами" items={prio} value={p} onChange={setP} orientation="vertical" />
        {prio.map((it) => <TabPanel key={it.id} tabsId="prio" tabId={it.id} active={p === it.id} className={s.content}><p>Справочник «{it.label}»: таблица порогов и весов.</p></TabPanel>)}
      </div>
    </>
  )
}
```
В `Page.module.css` добавить `.content { padding: var(--k-sp-4); flex: 1; }`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Tabs и TabPanel: горизонтальные сегментные и вертикальные списком, ручная активация"
```

---

## Самопроверка плана (выполнена при написании)

**Покрытие спеки.** 3.1–3.4 → задачи 1, 5; 4.1–4.4 → 2, 3, 4 (+ размеры, добавленные по ходу: `tip-max, dot-s, dot-m, counter, menu-min, progress, side, note-max, swatch`); 5.1 «Ввод и действия» → 6, 7; «Значения» → 10; «Наложения» → 9, 11; «Состояния» → 12; «Навигация» → 13, 15 (переполнение `Tabs` — план деталки); «Оболочка» → 5 и 14 (переключатели живут в демо); «Утилиты» → 8; 9 (качество: тесты, axe, контраст, генерация) → 1, 3, 5 и каждая задача; 10 (демо, Pages) → 14. Не покрыто намеренно: `DataGrid`, `StatusLane`, `FilterPanel`, `BulkBar`, модели, Playwright — планы 2 и 3.

**Согласованность имён.** `useKatran()` возвращает `{ theme, density, setTheme, setDensity, announce, portalRoot }` — `portalRoot` добавляется в задаче 11, тест провайдера в задаче 5 на него не опирается. `FLASH_MS` экспортируется из `CopyValue` и используется в `LinkValue`. `dimClass` экспортируется из `Skeleton.tsx` через `state/index.ts`. `densityOptions` — реэкспорт `densities` из `@katran/tokens` (задача 2, `index.ts`). `durations['sk-show']`/`['sk-min']` — ключи из `tokens.src.ts`.

**Заглушек нет.** Все шаги с кодом содержат код; все `Run:` с ожидаемым результатом.
