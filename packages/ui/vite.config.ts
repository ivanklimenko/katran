import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  // Пакеты кита в монорепо подключаются исходниками: условие экспорта katran-source → src/index.ts.
  // У потребителя вне монорепо условия нет — он получает dist (main/types/exports манифеста).
  resolve: { conditions: ['katran-source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['katran-source', ...defaultServerConditions] } },
  // Classic JSX runtime в dist: элементы кита создаёт createElement того React, что пришёл из
  // share scope хоста, и dist не импортирует 'react/jsx-runtime'. У React 17 нет поля exports,
  // а @katran/ui — ESM-пакет ("type": "module"), где webpack 5 требует полных путей: импорт
  // 'react/jsx-runtime' без .js в remote на webpack не разрешался без правила fullySpecified: false.
  // Имена фабрик — свои: часть модулей уже импортирует React как пространство имён.
  plugins: [react({ jsxRuntime: 'classic' }), dts({ include: ['src'], exclude: ['**/*.test.*', 'src/test/**'] })],
  oxc: {
    jsx: { runtime: 'classic', pragma: '__kCreate', pragmaFrag: '__kFragment' },
    jsxInject: `import { createElement as __kCreate, Fragment as __kFragment } from 'react'`,
  },
  build: {
    // Реальная планка браузера метаприложения — Chromium 88 (хост не транспилирует node_modules,
    // поэтому кит должен приходить уже пониженным). Без явного target Vite 8 собирает под
    // 'baseline-widely-available' (Chrome 107+). CSS сборка не выпускает: стили — шаблоны styled-components
    // в JS, их планку Chromium 88 проверяет check-css-target.
    target: 'chrome88',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'ui' },
    rollupOptions: { external: ['react', 'react-dom', 'styled-components', '@katran/tokens', '@katran/tokens/fonts', '@floating-ui/dom'] },
    sourcemap: true,
  },
})
