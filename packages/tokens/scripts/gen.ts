import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fontFiles, renderDeclarations, renderFonts, renderTs, renderVars, unicodeRangeOf } from '../src/generate'
import { source } from '../src/tokens.src'

const out = (name: string) => resolve(import.meta.dirname, '../src', name)
writeFileSync(out('tokens.ts'), renderTs(source))
writeFileSync(out('vars.ts'), renderVars(source))
writeFileSync(out('declarations.ts'), renderDeclarations(source))

// Шрифты: файлы woff2 из @fontsource — в packages/tokens/fonts, описания начертаний — в src/fonts.ts.
const require = createRequire(import.meta.url)
const fontsDir = resolve(import.meta.dirname, '../fonts')
rmSync(fontsDir, { recursive: true, force: true })
mkdirSync(fontsDir)
const faces = fontFiles().map((f) => {
  copyFileSync(require.resolve(`@fontsource/${f.pkg}/files/${f.stem}.woff2`), resolve(fontsDir, `${f.stem}.woff2`))
  const css = readFileSync(require.resolve(`@fontsource/${f.pkg}/${f.weight}.css`), 'utf8')
  return { ...f, unicodeRange: unicodeRangeOf(css, f.stem) }
})
writeFileSync(out('fonts.ts'), renderFonts(faces))
console.log(`tokens.ts, vars.ts, declarations.ts и fonts.ts обновлены; fonts/: ${readdirSync(fontsDir).length} файлов woff2`)
