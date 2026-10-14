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
// В рабочем пространстве версия закреплена override корня; переключается вместе с React.
// Правится одна строка override: остальной package.json корня (однострочные массивы) не переформатируется.
const REACT_IS = 'styled-components>react-is'
const root = new URL('../package.json', import.meta.url)
const rootText = readFileSync(root, 'utf8')
const line = /("styled-components>react-is":\s*)"[^"]*"/
if (!line.test(rootText)) {
  console.error(`в package.json корня нет pnpm.overrides["${REACT_IS}"]`)
  process.exit(1)
}
writeFileSync(root, rootText.replace(line, `$1"${want.react}"`))
console.log(`React ${process.argv[2]}: devDependencies ui и effector и override ${REACT_IS} (${want.react}) переключены; дальше pnpm install --no-frozen-lockfile`)
