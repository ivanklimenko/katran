# Перенос `apps/pi` во внутреннее приложение

Документ для команды, которая переносит реестры «Валютные документы» и «Рублёвые документы» из `apps/pi` в своё приложение. Рассчитан на то, что читатель видит только этот файл и репозиторий `katran` — все пути ниже абсолютные относительно корня монорепо. Общая рекомендация «katran в FSD-приложении» — `docs/guides/effector-fsd.md`; API для бекенда — `docs/reference/pi-api.md`; запуск и регуляторы стенда — `apps/pi/README.md`.

Среда выполнения: **React 17.0.2** (legacy-рендер, без `createRoot`), **effector 23.4**, планка браузера Chromium 88. `apps/pi` собран под ту же среду, что и весь кит (`docs/STATE.md` §2) — переносимый код не нужно адаптировать под React 17, он уже под него написан.

## 1. Что это

Слои сверху вниз: `app → pages → widgets → entities → shared` (Feature-Sliced Design, подробности — `docs/guides/effector-fsd.md`).

```
apps/pi/src/
  app/            только у нас: точка входа, hash-роутер, транспорт, фейковый сервер — сюда не переносится
  pages/          fx-docs, rub-docs — экраны (модель реестра + компонент страницы)
  widgets/        doc-registry — «грид + фильтры + лейн + жизненный цикл» как единый блок
  entities/       fx-doc, rub-doc, doc-status — типы документов, порты (searchFx/facetsFx/filterMetaFx), раскладка колонок
  shared/         api (транспорт requestFx, контракт grid-contract.ts, guards, problem), lib (lifecycle, test)
```

**Шов между нашим кодом и вашим бекендом — один эффект**, `requestFx` (`apps/pi/src/shared/api/request.ts`). Всё выше него (`entities`, `widgets`, `pages`) не знает про `fetch`/`axios`/адрес бека — оно вызывает `requestFx` и получает `unknown`, который сам же и разбирает по контракту (`shared/api/grid-contract.ts`). Всё, что нужно для переноса — подключить свой обработчик этого эффекта (раздел 4) и, если состав строки бека отличается от `docs/reference/pi-api.md`, поправить два файла мапперов (раздел 6).

Наше и выбрасывается — папка `apps/pi/src/app/`: точка входа на `ReactDOM.render` (только у нас, Vite/Pages), hash-роутер `#/fx-docs`/`#/rub-docs` (только у нас, стенд без вашего роутера), `app/fake/*` — фейковый сервер и вымышленные данные (только для разработки без бека). Ничего из `app/` не импортируется из `pages`/`widgets`/`entities`/`shared` — граница проверена линтом (`eslint.config.js`, раздел 7).

## 2. Путь «слайсы»

Копируете в свой `src` папки `pages/`, `widgets/`, `entities/`, `shared/` из `apps/pi/src/` целиком (файлы `*.test.ts(x)` можно не копировать, если не собираетесь гонять эти тесты у себя — но лучше оставить, раздел 8). В своём `app/` пишете:

1. **Обработчик транспорта** — раздел 4.
2. **Адаптер роутера** — раздел 5.
3. **Монтирование страниц** — раздел 3.

Импорты в скопированном коде относительные (`../../../shared/api`, без алиасов `@/...`) — переносятся как есть, ничего не переписывать. Если в вашем проекте настроен алиас `@/`, можно (не обязательно) заменить относительные пути на алиас — это косметика, на поведение не влияет.

**Сборка должна понимать CSS Modules.** В слайсах есть свои стили — `entities/fx-doc/ui/cells.module.css`, `entities/rub-doc/ui/cells.module.css`, `widgets/doc-registry/ui/DocRegistry.module.css`, — они импортируются как объект классов (`import s from './cells.module.css'`, дальше `s.num`, `s.dirRow`). Поэтому у вас нужно:

- **CSS Modules для `*.module.css`** в сборщике. Vite включает их сам; webpack — `css-loader` с `modules: { auto: true }` (или правило на `/\.module\.css$/`). Имена классов в файлах — camelCase (`dirRow`, `srTag`), обращение в коде — `s.dirRow`, так что `localsConvention`/`exportLocalsConvention` можно не настраивать; у нас (`apps/pi/vite.config.ts`) стоят `camelCaseOnly` и `generateScopedName` вида `k-<файл>__<класс>` — это удобство отладки, не требование.
- **Объявление типа `*.module.css` для TypeScript**, иначе `tsc` не пропустит импорт стиля. У нас — `packages/ui/src/css-modules.d.ts` (одна строка `declare module '*.module.css' { const classes: Record<string, string>; export default classes }`), подключён через `include` в `apps/pi/tsconfig.json`. У вас — такой же файл в своём `src` (или готовое объявление из `vite/client`, если вы на Vite).
- **Порядок подключения стилей не важен**: там, где стиль слайса должен перебить класс компонента кита (моноширинный шрифт, жирный номер, цвет `warn`), в файле стоит удвоенный класс (`.num.num`, `.mono.mono`, `.warn.warn`) — специфичность выше, чем у одиночного класса кита, в каком бы порядке сборщик ни положил CSS. Не «упрощайте» эти селекторы до одинарных.

## 3. Монтирование страниц

Обе страницы — обычные React-компоненты: `FxDocsPage` (`pages/fx-docs`), `RubDocsPage` (`pages/rub-docs`). Единственный проп — необязательный `note?: string` — строка пояснения под заголовком реестра; без него строки нет. У нас текст про фейковый сервер передаёт `apps/pi/src/app/App.tsx` — в самих страницах текста стенда нет. Над ними обязателен `KatranProvider` (`@katran/ui`) — без него компоненты кита не находят тему/плотность/тултипы. Нужны также шрифты кита.

```tsx
import '@katran/tokens/fonts.css'
import '@katran/ui/styles.css'
import { KatranProvider } from '@katran/ui'
import { FxDocsPage } from './pages/fx-docs'

export function DocumentsScreen() {
  return (
    <KatranProvider storageKey="documents">
      <FxDocsPage />
    </KatranProvider>
  )
}
```

`storageKey` разводит **настройки провайдера** (тема и плотность, `localStorage`) с другими экранами на той же странице. **Раскладку грида он не разводит**: ширины, порядок и скрытые колонки, размер страницы, раздельные колонки сохраняет сам реестр — `createRegistry` (`apps/pi/src/widgets/doc-registry/lib/createRegistry.ts`) по умолчанию берёт `localStoragePersist('katran-pi')` из `@katran/effector`, и ключи в `localStorage` получаются `katran-pi:fx-docs` и `katran-pi:rub-docs` (префикс + `id` реестра) независимо от `storageKey`. Префикс `katran-pi` — наш; чтобы хранить раскладку под своим префиксом (или не в `localStorage`), передайте свой адаптер в `RegistryConfig.persist` в модели страницы:

```ts
// pages/fx-docs/model/registry.model.ts
import { localStoragePersist } from '@katran/effector'

export const registry = createRegistry({
  id: 'fx-docs', layout: fxDocLayout, ports: fxDocPorts, lifecycle,
  persist: localStoragePersist('documents'), // ключ в localStorage — documents:fx-docs
})
```

Адаптер — любой объект `PersistAdapter` (`{ load(key), save(key, value) }`, тип экспортирует `@katran/effector`): `localStoragePersist(prefix)`, `memoryPersist()` (ничего не сохраняет между перезагрузками — так в тестах) или свой — например, на серверные настройки пользователя. Подробности про `KatranProvider`, изоляцию стилей и CORS для шрифтов — `docs/consuming.md`.

**Почему сам `apps/pi` не импортирует `@katran/ui/styles.css`.** Пример выше — для вас, потребителя опубликованного пакета; в исходниках `apps/pi/src/app/entry.tsx` этой строки нет, и это не упущение. Внутри монорепо `apps/pi` берёт `@katran/ui` из исходников (`exports["."]` в `packages/ui/package.json` — `./src/index.ts`, не `dist`): `packages/ui/src/index.ts` сам импортирует `@katran/tokens/tokens.css` как побочный эффект первой строкой, а CSS каждого компонента (`Button.module.css` и т. п.) приезжает вместе с компонентом при импорте — Vite подключает такие модульные стили в общий бандл сам, отдельно собирать их не нужно. Отсюда у нас в `entry.tsx` — только `@katran/tokens/fonts.css` (шрифты `index.ts` не тянет, это осознанно отдельный импорт).
Если вы ставите кит опубликованным пакетом (не из монорепо) — источников `src/*.module.css` у вас нет, только собранный `packages/ui/package.json` → `publishConfig.exports["./styles.css"]` = `./dist/ui.css` (единый файл со стилями всех компонентов, собранный при публикации). Поэтому в вашем коде явный `import '@katran/ui/styles.css'` обязателен — без него компоненты кита останутся без стилей. `@katran/tokens/tokens.css` в `dist/ui.css` уже включён (тот же побочный импорт в исходнике собирается в бандл), но шрифты `@katran/tokens/fonts.css` всё равно импортируются отдельно — `@font-face` не зависит от компонентов.

Рендер — legacy, без `createRoot` (React 17):

```tsx
import { render } from 'react-dom'
render(<DocumentsScreen />, document.getElementById('root'))
```

Так сделано в `apps/pi/src/app/entry.tsx` — единственное место, где у нас вызывается `render`.

## 4. Обработчик транспорта

`requestFx` (`apps/pi/src/shared/api/request.ts`) — единственный эффект, с которым говорит весь код `apps/pi`:

```ts
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'
export type HttpRequest = { method: HttpMethod; url: string; query?: Record<string, string> | undefined; body?: unknown }
export const requestFx = createEffect<HttpRequest, unknown, ApiError>(...)
```

По умолчанию он бросает `ApiError` со словами «Транспорт не подключён» — это сигнал, что `requestFx.use(...)` ещё не вызван. Подключение — одна строка в вашем `app`, до первого рендера (у нас — `apps/pi/src/app/transport.ts`):

```ts
requestFx.use(myHandler)
```

**Правило обработчика**: 2xx-ответ → разобранный JSON (или `null`/`undefined`, если тела нет); не 2xx → отказ (`throw`) значением `toApiError(status, body)` из `apps/pi/src/shared/api/problem.ts`. `toApiError` сам распознаёт тело в формате Problem Details (RFC 9457, `docs/reference/pi-api.md` §2) и собирает читаемое сообщение; если тело не Problem Details — подставляет заглушку по коду статуса.

### 4.1. Пример на `fetch`

```ts
import { ApiError, requestFx, toApiError } from './shared/api'

const API_BASE = 'https://your-backend.example/api' // адрес вашего бека

requestFx.use(async ({ method, url, query, body }) => {
  try {
    const qs = query ? `?${new URLSearchParams(query)}` : ''
    const res = await fetch(`${API_BASE}${url}${qs}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    })
    const data: unknown = res.headers.get('content-type')?.includes('json') ? await res.json() : null
    if (!res.ok) throw toApiError(res.status, data)
    return data
  } catch (e) {
    // сеть недоступна, CORS, битый JSON — fetch бросает TypeError/SyntaxError; эффект должен падать только ApiError
    throw e instanceof ApiError ? e : toApiError(0, null)
  }
})
```

### 4.2. Пример на axios

```ts
import axios from 'axios'
import { requestFx, toApiError } from './shared/api'

const api = axios.create({ baseURL: 'https://your-backend.example/api' }) // свой инстанс с интерцепторами, если есть

requestFx.use(async ({ method, url, query, body }) => {
  try {
    return (await api.request({ method, url, params: query, data: body })).data as unknown
  } catch (e) {
    // и ответ не 2xx, и сетевой сбой (response нет → статус 0) — всё превращается в ApiError
    throw toApiError(axios.isAxiosError(e) ? e.response?.status ?? 0 : 0, axios.isAxiosError(e) ? e.response?.data : null)
  }
})
```

`API_BASE`/`api` — переменные примера: подставьте адрес и способ авторизации своего бека (заголовок, cookie, интерцептор axios — где угодно внутри обработчика, до или после запроса). Важно только соблюсти правило выше: 2xx → JSON, иначе → `throw toApiError(status, body)`; сетевой сбой (ответа нет) — тоже `ApiError` (`toApiError(0, null)`), а не исходная ошибка `fetch`/axios: тип отказа `requestFx` — `ApiError`, и грид показывает сообщение именно из него.

`requestFx.use(...)` вызывается один раз, синхронно, до первого рендера страницы — effector сохраняет `scope` при вызове `requestFx` изнутри обработчика (эффекты `searchFx`/`facetsFx`/`filterMetaFx` вызывают `requestFx` именно так, `apps/pi/src/shared/api/ports.ts`).

## 5. Адаптер роутера

Обе страницы получают `pageOpened`/`pageClosed` через `PageLifecycle` (`apps/pi/src/shared/lib/lifecycle/createPageLifecycle.ts`):

```ts
export type PageLifecycle = { pageOpened: EventCallable<void>; pageClosed: EventCallable<void>; $opened: Store<boolean> }
```

Экземпляр лежит в модели страницы (`pages/fx-docs/model/registry.model.ts`: `export const lifecycle = createPageLifecycle()`) — он уже вызывается изнутри `createRegistry` (первый запрос, каталог фильтров, снятие выделения при уходе), **вам достаточно сообщить эти два события в нужный момент**, ничего в модели не создавать заново. У нас это делает hash-роутер (`apps/pi/src/app/routes.ts`); при переносе на свой роутер — эквивалент на `useEffect` с очисткой:

```tsx
import { useEffect } from 'react'
import { lifecycle } from '../pages/fx-docs' // экспортируется из pages/fx-docs (реэкспорт model/registry.model)

function FxDocsRoute() {
  useEffect(() => {
    lifecycle.pageOpened()
    return () => lifecycle.pageClosed()
  }, [])
  return <FxDocsPage />
}
```

Подставьте `FxDocsRoute` туда, где ваш роутер обычно монтирует компонент экрана (react-router `<Route element={<FxDocsRoute />} />`, собственный конфиг маршрутов и т. п.) — принцип один: на вход экрана `pageOpened()`, на уход `pageClosed()`. Если ваш роутер держит компонент смонтированным между переходами (например, вкладки без размонтирования), вызывайте события из его собственных хуков активации, а не из `useEffect` с пустыми зависимостями.

## 6. Если строка бека отличается

Состав `content[]`, который мы ожидаем от `POST /grids/{gridId}/search`, описан в `docs/reference/pi-api.md` §4. Если у вашего бека поля называются иначе (или структура другая) — **правится только один файл на грид**:

- `apps/pi/src/entities/fx-doc/api/fxDoc.mapper.ts` — `parseFxDoc(raw, path)`
- `apps/pi/src/entities/rub-doc/api/rubDoc.mapper.ts` — `parseRubDoc(raw, path)`

Маппер получает `raw: unknown` (одну строку `content[]`) и обязан вернуть строго типизированный `FxDoc`/`RubDoc` (`entities/*/model/*.ts`) — весь остальной код (порты, грид, колонки) от формы бека не зависит, он видит только `FxDoc`/`RubDoc`. Разборщики полей — все семь экспортов `apps/pi/src/shared/api/guards.ts`: `obj`, `str`, `strOrNull`, `num`, `oneOf` использует построчный разбор в мапперах (`parseFxDoc`/`parseRubDoc` — каждое поле `FxDoc`/`RubDoc` идёт через один из этих четырёх плюс `obj` для вложенных `lock`/`inactive`); `arr` и `scalar` мапперам не нужны — ими пользуется `shared/api/grid-contract.ts` при разборе всего ответа `search`/`facets` (массив `content`/массив пар `{value,count}`, `scalar` — тип значения фасета). Каждый гард бросает `contractError` с путём до поля, если форма не совпала (грид покажет ошибку, приложение не упадёт).

Если у бека отличается **каталог** `filter-meta` (набор доступных полей, справочники) или тело `search`/`facets` — правится `apps/pi/src/shared/api/grid-contract.ts` (`toSearchBody`, `toFacetsBody`, `fromSearchResponse`, `fromFacetsResponse`, `fromFilterMetaResponse`) — это уже расхождение не в составе строки, а в самом контракте `vtb-filters` §5–6, и меняется на весь `apps/pi`, а не на один грид.

## 7. Контрактные тесты против своего бека

`apps/pi/src/app/fake/contract.test.ts` — цепочка «порт → `requestFx` → сервер» через `fork({ handlers: [[requestFx, ...]] })`. Чтобы прогнать те же проверки (форма ответа, фильтр применяется, сортировка, коды ошибок) против настоящего бека вместо фейкового сервера — подставьте свой обработчик из раздела 4 в `handlers`:

```ts
import { allSettled, fork } from 'effector'
import { requestFx } from './shared/api'
import { fxDocPorts } from './entities/fx-doc'
import { myHandler } from './my-transport' // обработчик из раздела 4

const scope = () => fork({ handlers: [[requestFx, myHandler]] })

it('search: фильтр по статусу', async () => {
  const r = await allSettled(fxDocPorts.searchFx, {
    scope: scope(),
    params: { filter: [{ field: 'status', op: 'EQ', value: 'ERROR' }], sort: [], page: 0, size: 20 },
  })
  expect(r.status).toBe('done')
})
```

Это те же порты, что использует страница — если тест зелёный, страница получит те же данные тем же путём. `requestFx` внутри `fork` не ходит в сеть по-настоящему только если ваш обработчик сам не ходит (для CI — держите отдельный smoke-тест против тестового стенда бека, не части `pnpm check`).

## 8. Farfetched

Если у вас в приложении уже есть [Farfetched](https://ff.effector.dev/), порты оборачиваются как есть — переписывать `searchFx`/`facetsFx`/`filterMetaFx` не нужно, эффект остаётся эффектом:

```ts
import { createQuery } from '@farfetched/core'
import { fxDocPorts } from './entities/fx-doc'

export const fxDocsQuery = createQuery({ effect: fxDocPorts.searchFx })
```

Дальше — обычные средства Farfetched (кеш, ретраи, барьеры) поверх готового эффекта. Модели `apps/pi` (`createRegistry`, `createGridModel`, `createFiltersModel` из `@katran/effector`) продолжают дёргать `ports.searchFx`/`ports.facetsFx`/`ports.filterMetaFx` напрямую — Farfetched-обёртка нужна только если вы хотите управлять запросом отдельно от грида (например, предзагрузка вне страницы).

## 9. Путь «remote»: `apps/pi` целиком как Module Federation

Если вместо копирования слайсов вы хотите зарегистрировать `apps/pi` как готовый remote в своём хосте (webpack 5 Module Federation) — заготовка, не сделано:

- **Вход** — `bootstrap`-паттерн Module Federation (асинхронный вход, который сначала догружает shared-зависимости, затем монтирует), а не прямой `entry.tsx`: сейчас `apps/pi/src/app/entry.tsx` — синхронный `ReactDOM.render` для Vite/Pages, для remote нужен отдельный вход с `import('./bootstrap')`.
- **`exposes`** — по одному пункту на страницу (`./FxDocsPage`, `./RubDocsPage`), а не всё приложение целиком: хост монтирует то, что нужно на своём маршруте, и сам решает роутинг (раздел 5).
- **`shared`** — конфигурация `Access-Control-Allow-Origin` для шрифтов, версии `react`/`react-dom`/`effector` — из спеки совместимости, `docs/superpowers/specs/2026-09-24-katran-compat-design.md` §2.4 (та же секция продублирована в `docs/consuming.md`, разделы «webpack remote» и «Сервер remote»). Не изобретайте свой набор shared-ключей — работающий пример (проверен макетом, 21/21) уже там, включая обязательный `'effector/effector.mjs': { shareKey: 'effector', ... }` — без него на странице оказываются две копии effector, и модели фильтров молча перестают обновляться (STATE §8).
- **`examples/federation/`** — рабочий макет цепочки «host + remote» на реальном webpack 5 (вне pnpm workspace, ставится `npm`), с проверкой `e2e/check.mjs`. Это не готовый remote для `apps/pi`, а образец того, как хост и remote договариваются через Module Federation — переносите структуру `webpack.config.js` оттуда, не придумывайте свою.
- **CORS для шрифтов** и **ErrorBoundary хоста** (на случай `Unsatisfied version …`, если effector хоста ниже `^23.4.0`) — `docs/consuming.md`, разделы «Сервер remote» и «Что нужно от хоста».

## 10. Чек-лист «перенос завершён»

- [ ] `requestFx.use(...)` подключён — страницы не показывают «Транспорт не подключён».
- [ ] Оба экрана (`FxDocsPage`, `RubDocsPage`) загружаются и показывают данные вашего бека.
- [ ] `?slow=N` и `?fail=search|facets|meta` нигде не нужны — это регуляторы фейкового сервера (`apps/pi/src/app/fake/params.ts`), у вашего транспорта их нет и не должно быть.
- [ ] Контрактные тесты (раздел 7) зелёные против вашего бека.
- [ ] eslint-границы FSD перенесены в ваш конфиг (раздел 11) — импорты вверх по слоям и между соседними слайсами одного слоя запрещены линтом, не только на словах.
- [ ] В скопированных слайсах нет упоминаний стенда (тексты, геометрия Shell, префикс persist): пояснение `note` страниц — ваше или не передано (раздел 3); высоту реестру даёт ваш контейнер экрана — `DocRegistry` занимает `height: 100%` родителя, у нас определённую высоту задаёт `apps/pi/src/app/Shell.module.css` (`.main`/`.content`), без неё грид вырастет по содержимому; раскладка грида хранится под вашим префиксом (`RegistryConfig.persist`, раздел 3), а не под `katran-pi`.

## 11. Границы слоёв — где смотреть правило

Правило «импорт только вниз, чужой слайс — только через `index.ts`, соседние слайсы одного слоя — не импортируют друг друга» проверяется в `eslint.config.js` (корень монорепо) генератором зон FSD: константа `LAYERS` и функция `fsdZones` (ищите по комментарию «FSD-границы apps/pi») строят зоны `import-x/no-restricted-paths` по каталогам `apps/pi/src/{app,pages,widgets,entities,shared}` при загрузке конфига. Перенося слайсы к себе, скопируйте туда же эту часть конфигурации (или её эквивалент под ваш линтер), а не полагайтесь на дисциплину: без линта граница держится ровно до первой «срочной» правки (`docs/STATE.md` §4).

## 12. FSD-специфика этого документа

- Публичный API каждого слайса — его `index.ts` (`entities/fx-doc/index.ts`, `widgets/doc-registry/index.ts`, `pages/fx-docs/index.ts`): импортируйте оттуда, не из внутренних путей (`entities/fx-doc/model/fxDoc.ts` напрямую — не FSD).
- `doc-status` — сущность, общая для обоих документов. Соседям она отдаёт свой API через `@x`: `entities/doc-status/@x/fx-doc.ts` (для `fx-doc`) и `entities/doc-status/@x/rub-doc.ts` (для `rub-doc`) — у каждого соседа свой файл, и линт пускает `fx-doc` только в `@x/fx-doc.ts` (правило `@x` — раздел 1 `docs/guides/effector-fsd.md`; линт — раздел 11). Не дублируйте словарь статусов на своей стороне.
- Модели (`createFiltersModel`, `createGridModel` — из `@katran/effector`; `createRegistry` — местная фабрика `apps/pi`, не кита, раздел «Зависимости» ниже) вызываются на верхнем уровне модуля модели страницы, не в компоненте — так уже сделано в `pages/*/model/registry.model.ts`, при переносе не оборачивайте их в `useMemo`.

## Зависимости

Версии — как в `apps/pi/package.json`; переносимые слайсы (`pages`/`widgets`/`entities`/`shared`) ставят те же пакеты и версии в вашем приложении:

| Пакет | Версия | Кто именно |
|---|---|---|
| `react`, `react-dom` | `17.0.2` | среда выполнения (раздел «Среда выполнения» выше); peer-зависимость `@katran/ui` и `@katran/effector` — `>=17` |
| `effector` | `^23.4.4` | peer-зависимость `@katran/effector` — `>=23` |
| `effector-react` | `^23.3.0` | `useUnit` — вызывается напрямую в `widgets/doc-registry/ui/DocRegistry.tsx` (не только внутри `@katran/effector`); peer-зависимость `@katran/effector` — `>=23` |
| `@katran/ui` | `workspace:*` (в вашем приложении — версия из `docs/consuming.md`, «Установка») | компоненты (`KatranProvider`, `DataGrid`, `FilterPanel` и т. д.); `entities/*/ui`, `widgets/doc-registry/ui` |
| `@katran/effector` | `workspace:*` | `createFiltersModel`, `createGridModel`, персист-адаптеры — используются внутри `widgets/doc-registry/lib/createRegistry.ts` |
| `@katran/tokens` | `workspace:*` | шрифты (`@katran/tokens/fonts.css`, раздел 3); токены переезжают вместе с `@katran/ui` (см. ниже) |

**Для тестов слайсов** (если оставляете `*.test.ts(x)`, раздел 2) — dev-зависимости, версии как в `apps/pi/package.json` (библиотеки тестирования — под React 17):

| Пакет | Версия | Зачем |
|---|---|---|
| `vitest` | `^5.0.1` | раннер; тесты пишут `describe`/`it`/`expect` без импорта — нужен `test.globals: true` (у нас `apps/pi/vitest.config.ts`) и `"types": ["vitest/globals"]` в `tsconfig` |
| `jsdom` | `^30.1.1` | `test.environment: 'jsdom'` — тесты компонентов и роутера |
| `@testing-library/react` | `^12.1.5` | последняя линия под React 17 (13+ — только React 18); на ней `shared/lib/test/renderK.tsx` — без неё тесты `widgets`/`app` не соберутся |
| `@testing-library/dom` | `^8.20.1` | peer-зависимость `@testing-library/react@12` |
| `@testing-library/jest-dom` | `^7.0.1` | матчеры `toBeInTheDocument` и т. п.; подключаются в setup-файле `import '@testing-library/jest-dom/vitest'` (у нас `apps/pi/vitest.setup.ts`) |
| `@testing-library/user-event` | `^14.6.7` | клики и клавиатура в тестах компонентов |
| `jest-axe` | `^11.0.0` | проверка доступности (`registries.a11y.test.tsx`, `DocRegistry.test.tsx`); `expect.extend(toHaveNoViolations)` — в том же setup-файле; типы — свой минимальный `packages/ui/src/test/jest-axe.d.ts` (не `@types/jest-axe`, он тянет типы Jest) |

`createRegistry` (раздел 3 и «FSD-специфика» выше) — **не** экспорт `@katran/effector`, это местная фабрика `apps/pi/src/widgets/doc-registry/lib/createRegistry.ts`, которая сама вызывает `createFiltersModel`/`createGridModel` кита внутри себя; переносится вместе со слайсом `widgets/doc-registry`, а не устанавливается из npm.
