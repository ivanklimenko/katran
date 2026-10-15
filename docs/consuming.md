# Подключение кита в приложение команды (remote метаприложения)

Для команды, которая строит экран на katran внутри канального метаприложения. Основание — спека
`docs/superpowers/specs/2026-09-24-katran-compat-design.md` и спека стилизации
`docs/superpowers/specs/2026-10-13-katran-styled-design.md`; рабочий макет цепочки — `examples/federation/`.

## Среда

- Хост: webpack 5, `ModuleFederationPlugin`; **React 17.0.2**, `react-dom` и **styled-components 5.3.11** — shared
  singleton хоста; effector 23.4.
- Браузер: Chromium 88+. `node_modules` не транспилируются — пакеты кита приходят собранными под Chromium 88.

## Установка

**Откуда пакеты.** Пакеты кита в публичный npm не опубликованы. В контур их приносят тарболами:
`pnpm release:pack` в корне репозитория собирает три пакета и кладёт проверенные `.tgz` в `release/`.
Тарбол ставят по пути к файлу или публикуют во внутренний реестр любым клиентом — `npm publish release/<файл>.tgz`,
по порядку `tokens` → `ui` → `effector`. **Из папки пакета через `npm publish` не публиковать:** npm не заменяет
`workspace:*` на версию, пакет в реестре не установится (такую публикацию останавливает `prepublishOnly`).
Версия — `0.2.0`, одна на все три пакета (переход с `0.1.1` — раздел «Переход на 0.2.0» ниже); `0.1.0` из реестра
не использовать — она опубликована из папки и не собирается (`Failed to resolve entry for package "@katran/tokens"`).
Команды ниже — для случая, когда пакеты уже лежат во внутреннем реестре; с тарболами вместо имён кита
указываются пути к `.tgz`.

```sh
npm i @katran/tokens @katran/ui @katran/effector effector@^23.4 effector-react@^23 styled-components@^5.3.11
npm i -D react@17.0.2 react-dom@17.0.2 react-is@17.0.2 @types/react@^17 @types/react-dom@^17 @types/styled-components@5.1.34
```

React 17 в devDependencies обязателен: `react/jsx-runtime` React 19 создаёт элементы, которые React 17
хоста не рендерит (ошибка React #31), а шарить `react/jsx-runtime` нельзя — с запасной копией
singleton выбирает 19 и падает весь хост.

**`react-is` — под версию React.** styled-components 5 распознаёт элементы и компоненты через `react-is`, а его
диапазон (`>= 16.8.0`) менеджер пакетов закрывает последней версией. `react-is` 19 элементов React 17 не узнаёт:
ломаются `styled(Компонент)` и `ThemeProvider` (`isElement`/`typeOf` — ложь, `Context.Provider` «недопустимый тип
элемента»). Закрепить `react-is` той же мажорной версии, что React, для копии styled-components:

```jsonc
// package.json — npm
"overrides": { "styled-components": { "react-is": "17.0.2" } }
// yarn: "resolutions": { "styled-components/react-is": "17.0.2" }
// pnpm: "pnpm": { "overrides": { "styled-components>react-is": "17.0.2" } }
```

`pnpm check:install` кита ставит пакеты в чистый проект именно так и проверяет, что styled-components получает
`react-is` той же мажорной версии, что React (без закрепления npm ставил 19.3.1 при React 17.0.2).

Под Module Federation с `import: false` (см. «webpack remote») в рантайме работает копия styled-components хоста —
и с ней `react-is` хоста; копия remote в бандл не попадает. Закрепление `react-is` у remote всё равно нужно: его
тесты, dev-сервер и сборка без хоста идут на собственной копии styled-components.

## Точка входа экрана

```tsx
import { KatranFonts, KatranProvider } from '@katran/ui'

export default function DocumentsScreen() {
  return (
    <>
      <KatranFonts />
      <KatranProvider defaultTheme="light" storageKey="documents">
        {/* экран на компонентах @katran/ui и моделях @katran/effector */}
      </KatranProvider>
    </>
  )
}
```

Импортов CSS нет: стили кита — styled-components, они вставляются в `<style>` при первом рендере. `KatranFonts` —
единственное глобальное правило кита (`@font-face` IBM Plex, 14 файлов `woff2` из `@katran/tokens`, адреса —
`new URL(…, import.meta.url)`, сборщик remote кладёт их рядом со своими чанками); ставится один раз.
`storageKey` разводит настройки кита (тема, плотность, раскладка грида) с другими remote в общем `localStorage`.

**Тема.** `KatranProvider` оборачивает детей в `ThemeProvider`, добавляя токены кита под ключом `katran` и не затирая
тему хоста: `theme={(outer) => ({ ...outer, katran: k })}`. Тип `DefaultTheme` кит дополняет полем
`katran?: typeof k` — необязательным, чтобы объекты темы хоста без `katran` проходили проверку типов; под провайдером
код экрана читает `theme.katran!` или проверяет поле. Сам кит тему не читает: его шаблоны статические, токены —
объектом `k` из `@katran/tokens` (`${k.paper}` → `var(--k-paper)`); так же удобно писать и стили экрана
(образец — `apps/pi`, `docs/guides/pi-usage.md`).

## webpack remote

```js
new ModuleFederationPlugin({
  name: 'documents',
  filename: 'remoteEntry.js',
  exposes: { './DocumentsScreen': './src/DocumentsScreen.tsx' },
  shared: {
    react:       { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, import: false },
    'react-dom': { singleton: true, requiredVersion: '^17.0.2', strictVersion: true, import: false },
    effector:    { singleton: true, requiredVersion: '^23.4.0', strictVersion: true, import: false },
    // effector-react.mjs импортирует 'effector/effector.mjs' — без этого ключа на странице вторая копия
    // effector, и модели ломаются молча (например, «Применить» в фильтрах не активируется)
    'effector/effector.mjs': { singleton: true, shareKey: 'effector', requiredVersion: '^23.4.0', strictVersion: true, import: false },
    // styled-components — одна копия на странице, копия хоста: иначе контекст темы у remote свой (тема хоста не видна)
    'styled-components': { singleton: true, requiredVersion: '^5.3.11', strictVersion: true, import: false },
    // react/jsx-runtime и effector-react — не шарить
  },
})
// output: { publicPath: 'auto', uniqueName: 'documents' }
```

`import: false` — remote не несёт своих копий: React, react-dom, effector и styled-components берутся у хоста. Своя
запасная копия effector в `shared` опасна: при равных версиях webpack отдаёт её всей странице, включая хост.
Запасная копия styled-components бесполезна: хост сам на styled-components, а при равных версиях webpack выбирал
копию remote и грузил лишние 13.9 KiB gzip (макет: 83.5 → 69.6 KiB JS remote). Без shared styled-components
вид кита тот же (его шаблоны от темы не зависят), но тема хоста под `KatranProvider` не видна, а в dev
styled-components предупреждает о нескольких копиях.

## Сервер remote

- Заголовок `Access-Control-Allow-Origin` для статики remote: шрифты IBM Plex грузятся с адреса remote
  (`publicPath: 'auto'`), без CORS — ошибки загрузки шрифтов (геометрия цела, шрифт системный).
- CSP: styled-components вставляет `<style>` во время выполнения — `style-src` хоста должен это допускать; хост сам
  на styled-components, поэтому его политика это уже разрешает.
- `remoteEntry.js` без хеша в имени — не кешировать надолго.

## Что нужно от хоста

- `styled-components` в `shared` хоста — singleton той же линии, что требует remote: `^5.3.11` (хост на 5.3.11).
  Remote объявляет его с `import: false` и `strictVersion: true` — своей копии у него нет; если хост styled-components
  не шарит или шарит версию вне `^5.3.11`, экран не поднимется (`Unsatisfied version …` или нет модуля в share scope).
  Запасной путь, когда хост этого дать не может, — вариант макета `REMOTE_STYLED=shared` (singleton со своей копией у
  remote, `examples/federation/remote/webpack.config.js`): на странице по-прежнему одна копия, но remote несёт
  лишние 13.9 KiB gzip.
- ErrorBoundary вокруг точки встраивания: если effector хоста окажется ниже `^23.4.0`, `strictVersion`
  не даст экрану подняться (`Unsatisfied version …`) — хост должен показать заглушку, а не упасть.
- Место под экран. Растягиваться на слот хоста экран сам не умеет: у корня `KatranProvider` только
  `min-height: 100%`, `className`/`style` он не принимает, поэтому `height: 100%` внутри него не резолвится.
  Экран задаёт свою высоту сам — так сделано в макете (`examples/federation/remote/src/DocumentsScreen.tsx`,
  styled-часть `Page`: блок экрана фиксированной высоты, грид прокручивается внутри). Проп `className`/`style` у `KatranProvider` —
  в техдолге (`docs/STATE.md`, §7).

## Изоляция

Кит не трогает `html`/`body` и глобальные стили хоста; наружу выходит только `@font-face` IBM Plex
(`KatranFonts`). Переменные `--k-*` объявляет корень `KatranProvider` — **только под ним**, на `:root` их нет:
стили экрана, читающие `var(--k-…)` или `k`, работают внутри провайдера (порталы наложений кита рендерятся внутрь
корня). Под корнем геометрия не зависит от глобальных сбросов хоста (`box-sizing`, `td/th`, типографика `button`).
Правила хоста с классами (`.content table td`) по-прежнему могут перебить стили кита — точка встраивания не должна
лежать внутри таких контейнеров.

Типографика корня провайдера (шрифт, размер, цвет) — в листе styled-components, который вставляется в конец `<head>`
при первом рендере: правило хоста на корень с той же специфичностью (0,1,0) теперь проигрывает по порядку (в 0.1.x
стили кита шли файлом CSS, и порядок решала сборка хоста).

Под корнем кита модель коробки — `content-box` (кроме контролов со встроенным в браузер `border-box`:
`button`, `select`, чекбоксов и радиокнопок, `input` типов `button`/`submit`/`reset`). Сброс действует
и на разметку команды внутри `KatranProvider`: глобальный `* { box-sizing: border-box }` хоста до неё
не дойдёт, поэтому свои блоки экрана задают `box-sizing` явно (или считают размеры с паддингом и рамкой).

## Тесты хоста

Два места, где тесты экрана на ките ведут себя иначе, чем сборка.

**`import.meta.url` в `dist`.** Адреса шрифтов `@katran/tokens/fonts` (`dist/fonts.js`) — `new URL(…, import.meta.url)`,
и `@katran/ui` импортирует этот модуль на верхнем уровне. Vitest исполняет ESM и работает как есть. Jest с
`babel-jest` в CommonJS падает при импорте `@katran/ui`: «Cannot use 'import.meta' outside a module». Два рецепта
(пакеты кита — ESM, поэтому `@katran` и так должен быть в исключениях `transformIgnorePatterns`):

```js
// jest.config.js — заглушка вместо начертаний: KatranFonts в тестах ничего не вставляет
moduleNameMapper: { '^@katran/tokens/fonts$': '<rootDir>/test/katranFontsStub.js' },
// test/katranFontsStub.js
export const fontFaces = []
```

или плагин Babel `babel-plugin-transform-import-meta` для файлов `@katran` (переписывает `import.meta.url` под
CommonJS).

**Серверная сборка styled-components в jsdom.** Node берёт styled-components по полю `main` — серверную сборку; в ней
`createGlobalStyle` (`KatranFonts`, глобальные правила экрана) пишет правила только в серверный лист, и в `document` jsdom
их нет. Тестам, которые проверяют вставленные правила, нужен алиас на браузерную сборку — так у кита и `apps/pi`
(`packages/ui/vitest.config.ts`, `apps/pi/vitest.config.ts`):

```js
// vitest.config.ts
resolve: { alias: [{ find: /^styled-components$/, replacement: 'styled-components/dist/styled-components.browser.cjs.js' }] }
// jest.config.js
moduleNameMapper: { '^styled-components$': '<rootDir>/node_modules/styled-components/dist/styled-components.browser.cjs.js' }
```

## Переход на 0.2.0

**Breaking (срез styled, спека §4.6).** API компонентов, разметка, геометрия, цвета и поведение не изменились.

- Удалить импорты `@katran/tokens/tokens.css`, `@katran/tokens/fonts.css` и `@katran/ui/styles.css` — этих
  экспортов больше нет; вместо `fonts.css` — компонент `<KatranFonts />` один раз на приложение.
- Добавить `styled-components@^5.3.11` в зависимости (peer `@katran/ui`; версия 6 не поддерживается) и в `shared`
  remote (`import: false`, см. «webpack remote»); закрепить `react-is` под версию React (см. «Установка»).
- Переменные `--k-*` вне `KatranProvider` недоступны (раньше `tokens.css` объявлял их на `:root`).
- Имена классов `k-Component__part` исчезли — в DOM классы styled-components; тесты и стили экрана, опиравшиеся на них,
  переходят на роли, подписи, `data-*` и `styled(Компонент)` (каждый компонент кита с корневым элементом принимает
  `className`). Классы горячего пути `k-…` (значения в ячейках, запись грида) — внутренние, не API; публичный остался
  только `dimClass` (`'k-dim'`).
- Типографика корня `KatranProvider` (шрифт, размер, цвет) — в листе styled-components, который вставляется в конец
  `<head>`: правило хоста, попадающее на корень с той же специфичностью (0,1,0), её больше не перебивает (в 0.1.x
  порядок решала сборка хоста). Перебить можно только селектором выше (0,1,0) — см. «Изоляция».
- Все три пакета без побочных эффектов при загрузке (`sideEffects: false`): сборщик хоста выбрасывает неиспользуемые модули кита.

## Сортировка — массив уровней

**Breaking (план 5a).** Было: `Sort = { key: string; dir: 'asc' | 'desc' } | null`, `sort: null` — без сортировки. Стало:

```ts
type SortLevel = { key: string; dir: 'asc' | 'desc' }
type Sort = SortLevel[]   // [] — без сортировки
```

Переход у потребителя:

- `GridQuery.sort` (то, что `fetchFx` получает в запросе) — теперь массив уровней, а не одно значение или `null`. Бек `vtb-filters` меняться не должен: контракт там `sort` — уже массив (§5.1), приложение просто перестаёт заворачивать единственный уровень в объект и разворачивать `null` в пустой массив.
- Всюду, где было `sort === null`, читать `sort.length === 0`; где создавался `{ key, dir }`, создавать `[{ key, dir }]`.
- `sortBy` (событие модели) принимает `Sort` целиком — то, что вычислили помощники уровней грида (`soleSort`/`addSortLevel`/`flipSortLevel`/`removeSortLevel`, `@katran/ui`), а не пара `{ key, dir }`.
- Ручные моки `Sort`/`GridQuery` в тестах потребителя нужно поправить на массив.

Новые необязательные пропы `DataGrid` (обратная совместимость, без breaking): `onResetWidths`, `onResetWidth` — сброс ширин колонок (двойной клик по ручке, `Home`/`Shift+Home` на ползунке); `split`, `onSplit` — «вместе / раздельно» для составных колонок; `rowState`, `openHint` — состояния записи (заблокирована/неактивна) и подсказка кнопки открытия, данные приходят с бека, модель не нужна. Соответствующие поля в `useGrid` — `split`, `onSplit`, `onResetWidths`, `onResetWidth`; `rowState`/`openHint` задаёт экран, как `label`/`layout`.

Что ещё учесть при переходе на план 5a:

- **`gridColumns(layout.columns)`** (`@katran/ui`) — передавать в `GridModelConfig.columns` вместо ручного списка: он включает части колонок с `split`, и только так части получают ширину по умолчанию и попадают в известные модели id (`setSplit`, `persist`).
- **`GridPersisted.split: string[]`** — обязательное поле сохраняемой формы. Свой адаптер `persist` (серверный, `sessionStorage`) и моки `GridPersisted` в тестах дополняются этим полем; ранее сохранённые данные без `split` модель читает как `[]`.
- **`MenuItem`** (`Menu`, `@katran/ui`): `onSelect` теперь необязателен и получает `{ shiftKey }` — каким кликом/клавишей выбран пункт; новое необязательное `ariaLabel` — доступное имя пункта, когда видимый текст — знак («+», «↕»). Существующие меню работают без правок.
- **`formatDateTimeMinutes(iso)`** — «дд.мм.гггг чч:мм» в локальной зоне из одного разобранного момента (подсказка блокированной записи); для своих подписей того же вида — брать его, а не склеивать `formatDate` с куском ISO-строки.

## Размер (макет, prod, gzip)

0.2.0, styled-components у хоста (`import: false`): remoteEntry 3.2 KiB, экран с данными 7.9 KiB, кит и зависимости
58.5 KiB — итого JS 69.6 KiB; шрифты 193.8 KiB (14 woff2). Со своей запасной копией styled-components — 83.5 KiB.
Для сравнения, 0.1.1 (CSS кита через style-loader, тоже в JS): JS 41 KiB, из них кит 29.6 KiB; шрифты 202 KiB
(12 woff2). Рост — код кита: шаблоны styled-компонентов и их обёртки вместо готового CSS.
