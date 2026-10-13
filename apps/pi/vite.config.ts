import { defaultClientConditions, defaultServerConditions, defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Пакеты кита в монорепо подключаются исходниками: условие экспорта katran-source → src/index.ts.
  // У потребителя вне монорепо условия нет — он получает dist (main/types/exports манифеста).
  resolve: { conditions: ['katran-source', ...defaultClientConditions] },
  ssr: { resolve: { conditions: ['katran-source', ...defaultServerConditions] } },
  plugins: [react()],
  // Pages отдаёт приложение из /katran/pi/
  base: process.env.PAGES_BASE ?? '/',
  css: {
    modules: {
      generateScopedName: (local, filename) => {
        const base = filename.replace(/^.*[\\/]/, '').replace(/\.module\.css$/, '')
        return `k-${base}__${local}`
      },
      localsConvention: 'camelCaseOnly',
    },
  },
  build: { target: 'chrome88' },
})
