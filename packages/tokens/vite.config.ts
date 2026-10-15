import { defineConfig, type Plugin } from 'vite'

const FONT_URL = /new URL\((?=\s*['"]\.\.\/fonts\/)/g
// Сборщик переносит аргументы на отдельные строки: пометка — своей строкой перед адресом.
const IGNORED_FONT_URL = /(new URL\(\s*)\/\* @vite-ignore \*\/\s*/g

/**
 * Адреса шрифтов — в dist как в исходнике: new URL('../fonts/….woff2', import.meta.url).
 * Библиотечный режим Vite встраивает всё, на что указывает такая запись, data:-адресом (+300 КБ JS
 * вместо 14 файлов). Запись должна дойти до потребителя нетронутой: её разрешает его сборщик (Vite,
 * webpack 5) и кладёт файлы из папки fonts пакета в свою сборку. Поэтому на входе адреса помечаются
 * @vite-ignore (плагин Vite их пропускает), а из готового чанка пометка снимается — иначе её пропустил
 * бы и Vite потребителя. Только в этой сборке: в монорепо src/fonts.ts идёт к Vite приложений без пометки.
 */
const keepFontUrls = (): Plugin => ({
  name: 'katran:keep-font-urls',
  // До преобразований Vite: плагин адресов (vite:asset-import-meta-url) должен увидеть пометку.
  enforce: 'pre',
  transform(code, id) {
    if (id.endsWith('/src/fonts.ts')) return { code: code.replace(FONT_URL, 'new URL(/* @vite-ignore */ '), map: null }
  },
  renderChunk(code) {
    if (code.includes('/* @vite-ignore */')) return { code: code.replace(IGNORED_FONT_URL, '$1'), map: null }
  },
})

// Сборка dist для потребителей вне монорепо (webpack remote команды не транспилирует node_modules
// и не читает TypeScript): ESM-файлы входов (index — токены, fonts — начертания шрифтов), таргет Chromium 88.
// В монорепо пакет подключается исходниками через условие экспорта katran-source, main/types/exports
// манифеста указывают на dist.
export default defineConfig({
  plugins: [keepFontUrls()],
  build: {
    target: 'chrome88',
    lib: { entry: { index: 'src/index.ts', fonts: 'src/fonts.ts' }, formats: ['es'], fileName: (_format, name) => `${name}.js` },
    sourcemap: true,
  },
})
