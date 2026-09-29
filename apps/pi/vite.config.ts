import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
