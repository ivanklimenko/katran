import { existsSync, readdirSync } from 'node:fs'
import tseslint from 'typescript-eslint'
import importX from 'eslint-plugin-import-x'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

// FSD-границы apps/pi (docs/guides/effector-fsd.md, спека apps/pi §4): слои только вниз, чужой слайс — только публичный API
const PI = './apps/pi/src'
const LAYERS = ['app', 'pages', 'widgets', 'entities', 'shared']
const dirsOf = (path) => (existsSync(path) ? readdirSync(path, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [])
const slicesOf = (layer) => dirsOf(`${PI}/${layer}`)
// у shared единица с публичным API — сегмент (api), а в lib — каждый подкаталог (lib/lifecycle, lib/test)
const unitsOf = (layer) => (layer === 'shared' ? slicesOf('shared').flatMap((seg) => (seg === 'lib' ? dirsOf(`${PI}/shared/lib`).map((x) => `lib/${x}`) : [seg])) : slicesOf(layer))
const fsdZones = LAYERS.flatMap((layer, i) => {
  const zones = []
  // вверх — никогда
  for (const upper of LAYERS.slice(0, i)) zones.push({ target: `${PI}/${layer}`, from: `${PI}/${upper}`, message: `FSD: ${layer} не импортирует ${upper}` })
  // вниз — только index.ts слайса или сегмента shared
  if (layer !== 'shared') {
    for (const lower of LAYERS.slice(i + 1)) {
      for (const s of unitsOf(lower)) zones.push({ target: `${PI}/${layer}`, from: `${PI}/${lower}/${s}`, except: ['./index.ts'], message: `FSD: ${lower}/${s} — только через публичный API (index.ts)` })
    }
  }
  // соседи по слою — только @x у entities, и только свой файл: fx-doc берёт doc-status/@x/fx-doc.ts, но не @x/rub-doc.ts
  if (layer !== 'app' && layer !== 'shared') {
    for (const t of slicesOf(layer)) {
      for (const f of slicesOf(layer).filter((x) => x !== t)) {
        zones.push({ target: `${PI}/${layer}/${t}`, from: `${PI}/${layer}/${f}`, ...(layer === 'entities' ? { except: [`./@x/${t}.ts`] } : {}), message: `FSD: ${layer}/${t} не импортирует соседа ${f}${layer === 'entities' ? ` (только через ${f}/@x/${t}.ts)` : ''}` })
      }
    }
  }
  return zones
})

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.css', 'packages/tokens/src/tokens.ts', 'examples/**'] },
  ...tseslint.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  // Резолвер вне files: ['**/*.{ts,tsx}'] — должен применяться и к самому eslint.config.js (.js-файл)
  { settings: { 'import-x/resolver': { typescript: true, node: true } } },
  // Дефолтные экспорты tseslint/importX совпадают с их именованными — здесь это ожидаемо, не ошибка
  { files: ['eslint.config.js'], rules: { 'import-x/no-named-as-default': 'off', 'import-x/no-named-as-default-member': 'off' } },
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
          ...fsdZones,
        ],
      }],
      'no-restricted-imports': ['error', { paths: [
        { name: 'effector', message: 'effector разрешён только в packages/effector' },
        { name: 'effector-react', message: 'effector-react разрешён только в packages/effector' },
      ] }],
    },
  },
  {
    files: ['packages/effector/src/**/*.{ts,tsx}', 'apps/demo/src/**/*.{ts,tsx}', 'apps/pi/src/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // Граница слоёв для effector (спека 3.2): из @katran/ui — только типы, без DOM.
  // localStorage не запрещён: persist-адаптер в localStorage санкционирован спекой 8.2.
  {
    files: ['packages/effector/src/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', {
        paths: [{ name: '@katran/ui', allowTypeImports: true, message: 'effector берёт из @katran/ui только типы: import type { … }' }],
        patterns: [{ group: ['@katran/ui/*'], message: 'effector не импортирует ресурсы @katran/ui (стили, подпути)' }],
      }],
      'no-restricted-globals': ['error',
        { name: 'document', message: 'effector не работает с DOM' },
        { name: 'window', message: 'effector не работает с DOM' },
      ],
    },
  },
  // Кит работает на React 17 (хост метаприложения): API React 18+ в пакетах запрещены (спека совместимости 2.1).
  // Замены — в packages/ui/src/compat/.
  {
    files: ['packages/ui/src/**/*.{ts,tsx}', 'packages/effector/src/**/*.{ts,tsx}'],
    ignores: ['packages/ui/src/compat/**'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name=/^(useId|useSyncExternalStore|useTransition|useDeferredValue|useInsertionEffect|startTransition|use|useOptimistic|useActionState)$/]",
          message: 'API React 18+ — кит работает на React 17; замены в packages/ui/src/compat/',
        },
        {
          selector: "MemberExpression[object.name='React'][property.name=/^(useId|useSyncExternalStore|useTransition|useDeferredValue|useInsertionEffect|startTransition|use|useOptimistic|useActionState)$/]",
          message: 'API React 18+ — кит работает на React 17; замены в packages/ui/src/compat/',
        },
        {
          selector: "ImportDeclaration[source.value='react-dom'] > ImportSpecifier[imported.name=/^(useFormStatus|createRoot|hydrateRoot)$/]",
          message: 'API react-dom 18+ — кит работает на React 17: корень монтирует хост, useFormStatus нет',
        },
        {
          selector: "ImportDeclaration[source.value='react-dom/client']",
          message: 'react-dom/client — модуль React 18+; кит работает на React 17, корень монтирует хост',
        },
      ],
    },
  },
)
