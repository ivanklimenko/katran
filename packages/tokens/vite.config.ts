import { defineConfig } from 'vite'

// Сборка dist для потребителей вне монорепо (webpack remote команды не транспилирует node_modules
// и не читает TypeScript): один ESM-файл, таргет Chromium 88. В монорепо пакет по-прежнему
// подключается исходниками (main/exports → src), publishConfig переключает на dist.
export default defineConfig({
  build: {
    target: 'chrome88',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    sourcemap: true,
  },
})
