import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [react(), dts({ include: ['src'], exclude: ['**/*.test.*', 'src/test/**'] })],
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
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'ui' },
    cssFileName: 'ui',
    rollupOptions: { external: ['react', 'react-dom', 'react/jsx-runtime', '@katran/tokens', '@floating-ui/dom'] },
    sourcemap: true,
  },
})
