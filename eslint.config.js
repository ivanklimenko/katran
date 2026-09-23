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
        ],
      }],
      'no-restricted-imports': ['error', { paths: [
        { name: 'effector', message: 'effector разрешён только в packages/effector' },
        { name: 'effector-react', message: 'effector-react разрешён только в packages/effector' },
      ] }],
    },
  },
  {
    files: ['packages/effector/src/**/*.{ts,tsx}', 'apps/demo/src/**/*.{ts,tsx}'],
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
)
