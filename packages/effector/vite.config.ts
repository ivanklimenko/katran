import { defineConfig } from 'vite'

// Сборка dist для потребителей вне монорепо: webpack remote команды не транспилирует node_modules
// и не читает TypeScript. effector/effector-react/react — peer, @katran/ui здесь только типы.
export default defineConfig({
  build: {
    target: 'chrome88',
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index' },
    rollupOptions: { external: ['effector', 'effector-react', 'react', 'react/jsx-runtime', '@katran/ui'] },
    sourcemap: true,
  },
})
