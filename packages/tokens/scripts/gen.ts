import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fontFiles, renderDeclarations, renderFonts, renderTs, renderVars, unicodeRangeOf } from '../src/generate'
import { source } from '../src/tokens.src'

const out = (name: string) => resolve(import.meta.dirname, '../src', name)
writeFileSync(out('tokens.ts'), renderTs(source))
writeFileSync(out('vars.ts'), renderVars(source))
writeFileSync(out('declarations.ts'), renderDeclarations(source))

// Шрифты: файлы woff2 и лицензия из @fontsource — в packages/tokens/fonts, описания начертаний — в src/fonts.ts.
const require = createRequire(import.meta.url)
const fontsDir = resolve(import.meta.dirname, '../fonts')
rmSync(fontsDir, { recursive: true, force: true })
mkdirSync(fontsDir)
const faces = fontFiles().map((f) => {
  copyFileSync(require.resolve(`@fontsource/${f.pkg}/files/${f.stem}.woff2`), resolve(fontsDir, `${f.stem}.woff2`))
  const css = readFileSync(require.resolve(`@fontsource/${f.pkg}/${f.weight}.css`), 'utf8')
  return { ...f, unicodeRange: unicodeRangeOf(css, f.stem) }
})
// Лицензия шрифтов (SIL OFL 1.1) лежит рядом с файлами и уходит в тарбол: её проверяет release-pack.
for (const pkg of new Set(fontFiles().map((f) => f.pkg))) {
  copyFileSync(require.resolve(`@fontsource/${pkg}/LICENSE`), resolve(fontsDir, `OFL-${pkg}.txt`))
}
writeFileSync(out('fonts.ts'), renderFonts(faces))
const files = readdirSync(fontsDir)
console.log(`tokens.ts, vars.ts, declarations.ts и fonts.ts обновлены; fonts/: ${files.filter((f) => f.endsWith('.woff2')).length} файлов woff2 и ${files.filter((f) => f.endsWith('.txt')).length} лицензии`)
