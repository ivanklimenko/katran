# Подключение кита в приложение команды (remote метаприложения)

Для команды, которая строит экран на katran внутри канального метаприложения. Основание — спека
`docs/superpowers/specs/2026-09-24-katran-compat-design.md`; рабочий макет цепочки — `examples/federation/`.

## Среда

- Хост: webpack 5, `ModuleFederationPlugin`; **React 17.0.2** и `react-dom` — shared singleton хоста; effector 23.4.
- Браузер: Chromium 88+. `node_modules` не транспилируются — пакеты кита приходят собранными под Chromium 88.

## Установка

**Откуда пакеты.** Пакеты кита в публичный npm не опубликованы. В контур их приносят тарболами `pnpm pack`
(так делает макет — `examples/federation/scripts/pack-kit.sh`: собирает три пакета и кладёт `.tgz` в `.kit/`,
remote ставит их по пути к файлу) или публикуют во внутренний реестр. Версия пока `0.1.0` — одна на все три пакета.
Команды ниже — для случая, когда пакеты уже лежат во внутреннем реестре; с тарболами вместо имён кита
указываются пути к `.tgz`.

```sh
npm i @katran/tokens @katran/ui @katran/effector effector@^23.4 effector-react@^23
npm i -D react@17.0.2 react-dom@17.0.2 @types/react@^17 @types/react-dom@^17
```

React 17 в devDependencies обязателен: `react/jsx-runtime` React 19 создаёт элементы, которые React 17
хоста не рендерит (ошибка React #31), а шарить `react/jsx-runtime` нельзя — с запасной копией
singleton выбирает 19 и падает весь хост.

## Точка входа экрана

```tsx
import '@katran/tokens/fonts.css'
import '@katran/ui/styles.css'
import { KatranProvider } from '@katran/ui'

export default function DocumentsScreen() {
  return (
    <KatranProvider defaultTheme="light" storageKey="documents">
      {/* экран на компонентах @katran/ui и моделях @katran/effector */}
    </KatranProvider>
  )
}
```

`storageKey` разводит настройки кита (тема, плотность, раскладка грида) с другими remote в общем `localStorage`.

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
    // react/jsx-runtime и effector-react — не шарить
  },
})
// output: { publicPath: 'auto', uniqueName: 'documents' }
```

`import: false` — remote не несёт своих копий: React, react-dom и effector берутся у хоста. Своя запасная
копия effector в `shared` опасна: при равных версиях webpack отдаёт её всей странице, включая хост.

## Сервер remote

- Заголовок `Access-Control-Allow-Origin` для статики remote: шрифты IBM Plex грузятся с адреса remote
  (`publicPath: 'auto'`), без CORS — 12 ошибок загрузки шрифтов (геометрия цела, шрифт системный).
- `remoteEntry.js` без хеша в имени — не кешировать надолго.

## Что нужно от хоста

- ErrorBoundary вокруг точки встраивания: если effector хоста окажется ниже `^23.4.0`, `strictVersion`
  не даст экрану подняться (`Unsatisfied version …`) — хост должен показать заглушку, а не упасть.
- Место под экран. Растягиваться на слот хоста экран сам не умеет: у корня `KatranProvider` только
  `min-height: 100%`, `className`/`style` он не принимает, поэтому `height: 100%` внутри него не резолвится.
  Экран задаёт свою высоту сам — так сделано в макете (`examples/federation/remote/src/DocumentsScreen.module.css`:
  блок экрана фиксированной высоты, грид прокручивается внутри). Проп `className`/`style` у `KatranProvider` —
  в техдолге (`docs/STATE.md`, §7).

## Изоляция

Кит не трогает `html`/`body` и глобальные стили хоста; наружу выходят только переменные `--k-*` на `:root`
и `@font-face` IBM Plex. Под корнем `KatranProvider` геометрия не зависит от глобальных сбросов хоста
(`box-sizing`, `td/th`, типографика `button`). Правила хоста с классами (`.content table td`) по-прежнему
могут перебить стили кита — точка встраивания не должна лежать внутри таких контейнеров.

Под корнем кита модель коробки — `content-box` (кроме контролов со встроенным в браузер `border-box`:
`button`, `select`, чекбоксов и радиокнопок, `input` типов `button`/`submit`/`reset`). Сброс действует
и на разметку команды внутри `KatranProvider`: глобальный `* { box-sizing: border-box }` хоста до неё
не дойдёт, поэтому свои блоки экрана задают `box-sizing` явно (или считают размеры с паддингом и рамкой).

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

## Размер (макет, prod, gzip)

remoteEntry 3.2 KiB, экран с данными 8.2 KiB, кит и зависимости 29.6 KiB — итого JS 41 KiB; шрифты 202 KiB (12 woff2).
