import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderCss, renderTs } from '../src/generate'
import { source } from '../src/tokens.src'

const out = (name: string) => resolve(import.meta.dirname, '../src', name)
writeFileSync(out('tokens.css'), renderCss(source))
writeFileSync(out('tokens.ts'), renderTs(source))
console.log('tokens.css и tokens.ts обновлены')
