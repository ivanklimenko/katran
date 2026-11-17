import { mergeConfig } from 'vite'
import config from './vite.config'

// Дополнительный потребитель кита нужен только браузерным тестам; в обычную сборку не входит.
export default mergeConfig(config, {
  build: { outDir: 'e2e/dist', rolldownOptions: { input: { app: 'index.html', grid: 'e2e/fixtures/grid.html', registries: 'e2e/fixtures/registries.html' } } },
})
