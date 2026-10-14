import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  // Node берёт styled-components по полю main — серверную сборку: в ней createGlobalStyle пишет правила
  // только в серверный лист, и в jsdom их нет (KatranFonts). Тесты — на браузерной сборке, как у
  // потребителя (Vite и webpack читают поле browser).
  resolve: { alias: [{ find: /^styled-components$/, replacement: 'styled-components/dist/styled-components.browser.cjs.js' }] },
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'], css: { modules: { classNameStrategy: 'non-scoped' } } },
}))
