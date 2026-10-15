// Проверка самих проверок стилей (спека styled §6): node scripts/check-style-rules.mjs (pnpm check:rules).
// Копирует образцы нарушений из scripts/fixtures во временные файлы кита — обычный модуль в packages/ui/src
// и модуль горячего пути в packages/ui/src/value, — прогоняет eslint, stylelint и check-css-target (без
// аргументов, то есть тем же обходом, что в pnpm check) и падает, если хоть одно ожидаемое нарушение не найдено
// или на строке, помеченной «чисто», есть замечание. Временные файлы удаляются всегда — и при ошибке, и по Ctrl+C.
//
// Метки в образцах — в конце строки: «ждём: <проверка> …» и «чисто». Проверки:
//   eslint:template-fn — функция в шаблоне styled (no-restricted-syntax);
//   eslint:r13         — импорт styled-components вне styled.ts;
//   eslint:hot         — styled в модуле горячего пути;
//   eslint:keyframes-text   — текст CSS прямо в шаблоне keyframes (тело — фрагментом css, R15);
//   eslint:styled-names     — импорт из модуля styled кита под другим именем или целиком (* as, R15);
//   eslint:template-literal — строка или шаблонная строка как интерполяция (R15);
//   stylelint:<правило> — правило stylelint;
//   target:<признак>    — check-css-target (признак — подстрока сообщения: имя возможности doiuse или свойство).
import { spawnSync } from 'node:child_process'
import { copyFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import stylelint from 'stylelint'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SAMPLES = [
  { fixture: 'scripts/fixtures/styled-bad.tsx.txt', dest: 'packages/ui/src/__style-rules-sample__.tsx' },
  { fixture: 'scripts/fixtures/styled-bad-hot.tsx.txt', dest: 'packages/ui/src/value/__style-rules-sample-hot__.tsx' },
]

const cleanup = () => { for (const s of SAMPLES) rmSync(join(ROOT, s.dest), { force: true }) }
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { cleanup(); process.exit(130) })

const ESLINT_CHECKS = {
  'template-fn': (m) => m.ruleId === 'no-restricted-syntax' && m.message.startsWith('Функция в шаблоне styled'),
  r13: (m) => m.ruleId === '@typescript-eslint/no-restricted-imports' && m.message.includes('(R13)') && !m.message.includes('Горячий путь'),
  'keyframes-text': (m) => m.ruleId === 'no-restricted-syntax' && m.message.startsWith('Текст CSS прямо в keyframes'),
  'styled-names': (m) => m.ruleId === 'no-restricted-syntax' && m.message.startsWith('Импорт из модуля styled кита под другим именем'),
  'template-literal': (m) => m.ruleId === 'no-restricted-syntax' && m.message.startsWith('Строка как интерполяция в шаблоне styled'),
  hot: (m) => m.ruleId === '@typescript-eslint/no-restricted-imports' && m.message.includes('Горячий путь без styled'),
}

/** Метки образца: [{ line, expect: ['eslint:hot', …] }, { line, clean: true }]. */
function marksOf(text) {
  const marks = []
  text.split('\n').forEach((s, i) => {
    const expect = /ждём:\s*((?:eslint|stylelint|target):[\w-]+(?:[\s,]+(?:eslint|stylelint|target):[\w-]+)*)\s*(\*\/)?\s*$/.exec(s)
    if (expect) marks.push({ line: i + 1, expect: expect[1].split(/[\s,]+/).filter(Boolean) })
    else if (/(\/\/|\/\*)\s*чисто\s*(\*\/)?\s*$/.test(s)) marks.push({ line: i + 1, clean: true })
  })
  return marks
}

let problems = 0
let passed = 0
const fail = (msg) => { problems++; console.error(`  НЕТ  ${msg}`) }
const ok = (msg) => { passed++; console.log(`  да   ${msg}`) }

try {
  for (const s of SAMPLES) copyFileSync(join(ROOT, s.fixture), join(ROOT, s.dest))
  const files = SAMPLES.map((s) => join(ROOT, s.dest))

  const eslintResults = await new ESLint({ cwd: ROOT }).lintFiles(files)
  const stylelintResults = (await stylelint.lint({ files, cwd: ROOT })).results
  const target = spawnSync(process.execPath, [join(ROOT, 'scripts/check-css-target.mjs')], { cwd: ROOT, encoding: 'utf8' })
  const targetLines = `${target.stdout}\n${target.stderr}`.split('\n')
  if (target.status === 0) fail('check-css-target без аргументов не упал на образцах')

  for (const s of SAMPLES) {
    const file = join(ROOT, s.dest)
    console.log(`${s.fixture} → ${s.dest}`)
    const es = eslintResults.find((r) => r.filePath === file)?.messages ?? []
    const st = stylelintResults.find((r) => r.source === file)?.warnings ?? []
    const tg = targetLines.filter((l) => l.startsWith(`${s.dest}:`) && l.includes('не поддерживается'))
    const fatal = es.filter((m) => m.fatal)
    if (fatal.length) fail(`eslint не разобрал файл: ${fatal.map((m) => m.message).join('; ')}`)
    const atLine = (line) => ({
      eslint: es.filter((m) => m.line === line),
      stylelint: st.filter((w) => w.line === line),
      target: tg.filter((l) => l.includes(`(строка ${line})`)),
    })
    for (const mark of marksOf(readFileSync(join(ROOT, s.fixture), 'utf8'))) {
      const got = atLine(mark.line)
      if (mark.clean) {
        const all = [...got.eslint.map((m) => `eslint ${m.ruleId}`), ...got.stylelint.map((w) => `stylelint ${w.rule}`), ...got.target]
        if (all.length) fail(`строка ${mark.line} помечена «чисто», а есть замечания: ${all.join('; ')}`)
        else ok(`строка ${mark.line}: чисто`)
        continue
      }
      for (const want of mark.expect) {
        const [tool, what] = want.split(':')
        const found = tool === 'eslint' ? ESLINT_CHECKS[what] && got.eslint.some(ESLINT_CHECKS[what])
          : tool === 'stylelint' ? got.stylelint.some((w) => w.rule === what)
            : tool === 'target' ? got.target.some((l) => l.includes(what))
              : false
        if (found) ok(`строка ${mark.line}: ${want}`)
        else fail(`строка ${mark.line}: ${want} не найдено`)
      }
    }
  }
} finally {
  cleanup()
}

console.log(`Проверки стилей: найдено ${passed} из ${passed + problems}`)
if (problems) process.exit(1)
