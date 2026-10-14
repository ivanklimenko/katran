import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderDeclarations, renderTs, renderVars } from '../src/generate'
import { source } from '../src/tokens.src'

const out = (name: string) => resolve(import.meta.dirname, '../src', name)
writeFileSync(out('tokens.ts'), renderTs(source))
writeFileSync(out('vars.ts'), renderVars(source))
writeFileSync(out('declarations.ts'), renderDeclarations(source))
console.log('tokens.ts, vars.ts и declarations.ts обновлены')
