import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite'

// Сборка dist для потребителей вне монорепо: webpack remote команды не транспилирует node_modules
// и не читает TypeScript. effector/effector-react/react — peer, @katran/ui здесь только типы.
export default defineConfig({
  // Пакеты кита в монорепо подключаются исходниками: условие экспорта katran-source → src/index.ts.
  // У потребителя вне монорепо условия нет — он получает dist (main/types/exports манифеста).
  resolve: { conditions: ['katran-source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['katran-source', ...defaultServerConditions] } },
  build: {
    target: 'chrome88',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['effector', 'effector-react', 'react', 'react/jsx-runtime', '@katran/ui'] },
    sourcemap: true,
  },
})
