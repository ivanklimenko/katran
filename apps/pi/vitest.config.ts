import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  // Как в ките (packages/ui/vitest.config.ts): Node берёт styled-components по полю main — серверную сборку, в ней
  // createGlobalStyle (стили своих элементов ячеек, FxCellStyles/RubCellStyles) пишет правила только в серверный лист,
  // и в jsdom их нет. Тесты — на браузерной сборке, как у приложения (Vite читает поле browser).
  resolve: { alias: [{ find: /^styled-components$/, replacement: 'styled-components/dist/styled-components.browser.cjs.js' }] },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'], include: ['src/**/*.test.{ts,tsx}'], css: { modules: { classNameStrategy: 'non-scoped' } } },
}))
