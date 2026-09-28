import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
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
  // Детерминированные имена классов: k-Component__part (спека 3.3). Хеша нет намеренно.
  // Строковый шаблон 'k-[name]__[local]' здесь не подходит: Vite/generic-names вырезает
  // из имени файла только последнее расширение (.css), поэтому для Provider.module.css
  // [name] превращается в "Provider.module" (точка санируется в дефис) — получаем
  // k-Provider-module__root вместо требуемого k-Provider__root. Функция ниже сама
  // отрезает суффикс .module.css.
  css: {
    modules: {
      generateScopedName: (local, filename) => {
        const base = filename.replace(/^.*[\\/]/, '').replace(/\.module\.css$/, '')
        return `k-${base}__${local}`
      },
      localsConvention: 'camelCaseOnly',
    },
  },
  build: {
    // Реальная планка браузера метаприложения — Chromium 88 (хост не транспилирует node_modules,
    // поэтому кит должен приходить уже пониженным). Без явного target Vite 8 собирает под
    // 'baseline-widely-available' (Chrome 107+), cssTarget наследует его же.
    target: 'chrome88',
    cssTarget: 'chrome88',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'ui' },
    cssFileName: 'ui',
    rollupOptions: { external: ['react', 'react-dom', '@katran/tokens', '@floating-ui/dom'] },
    sourcemap: true,
  },
})
