// Переключает devDependencies React у пакетов кита (ui, effector) и react-is для styled-components:
// node scripts/use-react.mjs 17|19.
// Рабочее пространство живёт на 17 (прод — React 17 хоста); CI-задача react19 переключает на 19,
// ставит зависимости без lock-файла и гоняет тесты и сборку пакетов. Демо не трогается:
// ReactDOM.render в React 19 удалён, демо остаётся на 17.
import { readFileSync, writeFileSync } from 'node:fs'

const VERSIONS = {
  17: {
    react: '17.0.2', 'react-dom': '17.0.2', '@types/react': '^17.0.93', '@types/react-dom': '^17.0.26',
    '@testing-library/react': '^12.1.5', '@testing-library/dom': '^8.20.1',
  },
  19: {
    react: '^19.3.0', 'react-dom': '^19.3.0', '@types/react': '^19.3.0', '@types/react-dom': '^19.3.0',
    '@testing-library/react': '^16.3.3', '@testing-library/dom': '^10.4.0',
  },
}
const want = VERSIONS[process.argv[2]]
if (!want) {
  console.error('node scripts/use-react.mjs 17|19')
  process.exit(2)
}
for (const pkg of ['packages/ui', 'packages/effector']) {
  const file = new URL(`../${pkg}/package.json`, import.meta.url)
  const json = JSON.parse(readFileSync(file, 'utf8'))
  // Только уже объявленные зависимости: у effector нет @testing-library/dom и @types/react-dom.
  for (const [name, version] of Object.entries(want)) if (json.devDependencies?.[name]) json.devDependencies[name] = version
  writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`)
}
// react-is для styled-components — той же мажорной версии, что React: react-is 19 не распознаёт элементы
// React 17 (и наоборот), рендер styled-компонентов падает (Context.Provider «недопустимый тип элемента»).
// Типы @types/styled-components зависят от @types/react «*», и pnpm даёт им одну копию на всё рабочее пространство —
// ту, что у apps/pi и demo (17): тогда styled-компоненты ui под @types/react 19 не проходят tsc (JSX двух версий,
// TS2769 на каждом styled-элементе). Обе версии закреплены override корня и переключаются вместе с React.
// Правятся только строки override: остальной package.json корня (однострочные массивы) не переформатируется.
const OVERRIDES = { 'styled-components>react-is': want.react, '@types/styled-components>@types/react': want['@types/react'] }
const root = new URL('../package.json', import.meta.url)
let rootText = readFileSync(root, 'utf8')
for (const [key, version] of Object.entries(OVERRIDES)) {
  const line = new RegExp(`("${key.replace(/[/]/g, '\\/')}":\\s*)"[^"]*"`)
  if (!line.test(rootText)) {
    console.error(`в package.json корня нет pnpm.overrides["${key}"]`)
    process.exit(1)
  }
  rootText = rootText.replace(line, `$1"${version}"`)
}
writeFileSync(root, rootText)
console.log(`React ${process.argv[2]}: devDependencies ui и effector и override ${Object.keys(OVERRIDES).join(', ')} переключены; дальше pnpm install --no-frozen-lockfile`)
