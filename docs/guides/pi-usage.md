# Перенос `apps/pi` во внутреннее приложение

Документ для команды, которая переносит реестры «Валютные документы» и «Рублёвые документы» из `apps/pi` в своё приложение. Рассчитан на то, что читатель видит только этот файл и репозиторий `katran` — все пути ниже абсолютные относительно корня монорепо. Общая рекомендация «katran в FSD-приложении» — `docs/guides/effector-fsd.md`; API для бекенда — `docs/reference/pi-api.md`; запуск и регуляторы стенда — `apps/pi/README.md`.

Среда выполнения: **React 17.0.2** (legacy-рендер, без `createRoot`), **effector 23.4**, планка браузера Chromium 88. `apps/pi` собран под ту же среду, что и весь кит (`docs/STATE.md` §2) — переносимый код не нужно адаптировать под React 17, он уже под него написан.

## 1. Что это

Слои сверху вниз: `app → pages → widgets → features → entities → shared` (Feature-Sliced Design, подробности — `docs/guides/effector-fsd.md`).

```
apps/pi/src/
  app/            только у нас: точка входа, hash-роутер, транспорт, фейковый сервер — сюда не переносится
  pages/          fx-docs, rub-docs — экраны (модель реестра и деталки + компонент страницы)
  widgets/        doc-registry — «грид + фильтры + лейн + жизненный цикл» как единый блок;
                  doc-detail — деталка документа: drawer A/B, шапка, лейн, вкладки, «Общие данные» (раздел 13)
  features/       doc-edit — правка документа в деталке: модель правки, счета, контекст правки для деталки (раздел 14)
  entities/       fx-doc, rub-doc, doc-status, doc-trail, posting — типы документов, порты (searchFx/facetsFx/filterMetaFx/detailFx/tabFx;
                  у валюты ещё fxEditPorts — saveEditFx/accountsFx, раздел 14), раскладка колонок, профили деталки, проводки
  shared/         api (транспорт requestFx, контракт grid-contract.ts, guards, problem), lib (lifecycle, detail, test)
```

**Шов между нашим кодом и вашим бекендом — один эффект**, `requestFx` (`apps/pi/src/shared/api/request.ts`). Всё выше него (`entities`, `widgets`, `pages`) не знает про `fetch`/`axios`/адрес бека — оно вызывает `requestFx` и получает `unknown`, который сам же и разбирает по контракту (`shared/api/grid-contract.ts`). Всё, что нужно для переноса — подключить свой обработчик этого эффекта (раздел 4) и, если состав строки бека отличается от `docs/reference/pi-api.md`, поправить два файла мапперов (раздел 6).

Наше и выбрасывается — папка `apps/pi/src/app/`: точка входа на `ReactDOM.render` (только у нас, Vite/Pages), hash-роутер `#/fx-docs`/`#/rub-docs` (только у нас, стенд без вашего роутера), `app/fake/*` — фейковый сервер и вымышленные данные (только для разработки без бека). Ничего из `app/` не импортируется из `pages`/`widgets`/`entities`/`shared` — граница проверена линтом (`eslint.config.js`, раздел 7).

## 2. Путь «слайсы»

Копируете в свой `src` папки `pages/`, `widgets/`, `features/`, `entities/`, `shared/` из `apps/pi/src/` целиком (файлы `*.test.ts(x)` можно не копировать, если не собираетесь гонять эти тесты у себя — но лучше оставить, раздел 8). В своём `app/` пишете:

1. **Обработчик транспорта** — раздел 4.
2. **Адаптер роутера** — раздел 5.
3. **Монтирование страниц** — раздел 3.

Импорты в скопированном коде относительные (`../../../shared/api`, без алиасов `@/...`) — переносятся как есть, ничего не переписывать. Если в вашем проекте настроен алиас `@/`, можно (не обязательно) заменить относительные пути на алиас — это косметика, на поведение не влияет.

**Сборка должна понимать CSS Modules.** В слайсах есть свои стили — `entities/fx-doc/ui/cells.module.css`, `entities/fx-doc/ui/detail.module.css`, `entities/fx-doc/ui/edit.module.css` (правка, срез 2c), `entities/fx-doc/ui/extra.module.css` (вкладка «Доп. поля»), `entities/doc-trail/ui/trail.module.css` (вкладки следа документа), `entities/rub-doc/ui/cells.module.css`, `entities/rub-doc/ui/detail.module.css`, `entities/posting/ui/posting.module.css`, `widgets/doc-registry/ui/DocRegistry.module.css`, `widgets/doc-detail/ui/DocDetail.module.css`, — они импортируются как объект классов (`import s from './cells.module.css'`, дальше `s.num`, `s.dirRow`). Поэтому у вас нужно:

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

Файлы (сообщение документа, печатная форма) идут вторым эффектом — `requestFileFx` со своим обработчиком: раздел 15.4.

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

`requestFx.use(...)` вызывается один раз, синхронно, до первого рендера страницы — effector сохраняет `scope` при вызове `requestFx` изнутри обработчика (эффекты `searchFx`/`facetsFx`/`filterMetaFx`/`detailFx` вызывают `requestFx` именно так, `apps/pi/src/shared/api/ports.ts`).

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

Маппер получает `raw: unknown` (одну строку `content[]`) и обязан вернуть строго типизированный `FxDoc`/`RubDoc` (`entities/*/model/*.ts`) — весь остальной код (порты, грид, колонки) от формы бека не зависит, он видит только `FxDoc`/`RubDoc`. Разборщики полей — экспорты `apps/pi/src/shared/api/guards.ts` (их восемь: седьмой был `scalar`, восьмой — `strArr`, массив строк, добавлен срезом 2a для мапперов детали — `lines` SWIFT-полей, `valueDates`, `tabsOff`): `obj`, `str`, `strOrNull`, `num`, `oneOf` использует построчный разбор в мапперах (`parseFxDoc`/`parseRubDoc` — каждое поле `FxDoc`/`RubDoc` идёт через один из этих четырёх плюс `obj` для вложенных `lock`/`inactive`); `arr` и `scalar` мапперам не нужны — ими пользуется `shared/api/grid-contract.ts` при разборе всего ответа `search`/`facets` (массив `content`/массив пар `{value,count}`, `scalar` — тип значения фасета). Каждый гард бросает `contractError` с путём до поля, если форма не совпала (грид покажет ошибку, приложение не упадёт).

Деталь документа (`GET /grids/{gridId}/documents/{id}`, `docs/reference/pi-api.md` §7) разбирают свои мапперы — раздел 13.3.

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

Деталь проверяется так же — блоки `describe('контракт детали fx-docs …')` и `describe('контракт детали rub-docs …')` в том же файле гоняют `fxDocPorts.detailFx`/`rubDocPorts.detailFx` по `id` строк из `searchFx`: номер, сумма и статус совпадают со строкой, каждый тип документа разбирается маппером, неизвестный `id` — `404`.

Это те же порты, что использует страница — если тест зелёный, страница получит те же данные тем же путём. `requestFx` внутри `fork` не ходит в сеть по-настоящему только если ваш обработчик сам не ходит (для CI — держите отдельный smoke-тест против тестового стенда бека, не части `pnpm check`).

## 8. Farfetched

Если у вас в приложении уже есть [Farfetched](https://ff.effector.dev/), порты оборачиваются как есть — переписывать `searchFx`/`facetsFx`/`filterMetaFx`/`detailFx` не нужно, эффект остаётся эффектом:

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
- [ ] Деталка открывается из обоих реестров, и `GET /grids/{gridId}/documents/{id}` вашего бека проходит контрактный тест (`apps/pi/src/app/fake/contract.test.ts`, блоки «контракт детали», раздел 7) с вашим обработчиком.
- [ ] Вкладки деталки открываются, `GET …/documents/{id}/tabs/{tab}` вашего бека проходит контрактный тест; `tabsOff` детали совпадает с пустотой вкладок.
- [ ] Правка валютной деталки сохраняется в ваш бек: `POST …/documents/{id}/edits` и `GET …/documents/{id}/accounts` проходят контрактный тест (раздел 14.5); `409` вашего бека показывает «Документ изменили — откройте заново».
- [ ] `?slow=N`, `?fail=search|facets|suggest|meta|detail|tab|tab:<id>|edit|accounts` и `?conflict=edit` нигде не нужны — это регуляторы фейкового сервера (`apps/pi/src/app/fake/params.ts`), у вашего транспорта их нет и не должно быть.
- [ ] Контрактные тесты (раздел 7) зелёные против вашего бека.
- [ ] eslint-границы FSD перенесены в ваш конфиг (раздел 11) — импорты вверх по слоям и между соседними слайсами одного слоя запрещены линтом, не только на словах.
- [ ] В скопированных слайсах нет упоминаний стенда (тексты, геометрия Shell, префикс persist): пояснение `note` страниц — ваше или не передано (раздел 3); высоту реестру даёт ваш контейнер экрана — `DocRegistry` занимает `height: 100%` родителя, у нас определённую высоту задаёт `apps/pi/src/app/Shell.module.css` (`.main`/`.content`), без неё грид вырастет по содержимому; раскладка грида хранится под вашим префиксом (`RegistryConfig.persist`, раздел 3), а не под `katran-pi`.

## 11. Границы слоёв — где смотреть правило

Правило «импорт только вниз, чужой слайс — только через `index.ts`, соседние слайсы одного слоя — не импортируют друг друга» проверяется в `eslint.config.js` (корень монорепо) генератором зон FSD: константа `LAYERS` и функция `fsdZones` (ищите по комментарию «FSD-границы apps/pi») строят зоны `import-x/no-restricted-paths` по каталогам `apps/pi/src/{app,pages,widgets,features,entities,shared}` при загрузке конфига (слой `features` — с среза 2c, `features/doc-edit`; отдельная зона запрещает `widgets/doc-detail` импортировать `features` — правку виджет получает контекстом, раздел 14). Перенося слайсы к себе, скопируйте туда же эту часть конфигурации (или её эквивалент под ваш линтер), а не полагайтесь на дисциплину: без линта граница держится ровно до первой «срочной» правки (`docs/STATE.md` §4).

## 12. FSD-специфика этого документа

- Публичный API каждого слайса — его `index.ts` (`entities/fx-doc/index.ts`, `widgets/doc-registry/index.ts`, `pages/fx-docs/index.ts`): импортируйте оттуда, не из внутренних путей (`entities/fx-doc/model/fxDoc.ts` напрямую — не FSD).
- `doc-status` — сущность, общая для обоих документов. Соседям она отдаёт свой API через `@x`: `entities/doc-status/@x/fx-doc.ts` (для `fx-doc`) и `entities/doc-status/@x/rub-doc.ts` (для `rub-doc`) — у каждого соседа свой файл, и линт пускает `fx-doc` только в `@x/fx-doc.ts` (правило `@x` — раздел 1 `docs/guides/effector-fsd.md`; линт — раздел 11). Не дублируйте словарь статусов на своей стороне. Так же устроена `posting` (проводки деталки): `entities/posting/@x/fx-doc.ts` и `entities/posting/@x/rub-doc.ts`.
- Модели (`createFiltersModel`, `createGridModel` — из `@katran/effector`; `createRegistry` — местная фабрика `apps/pi`, не кита, раздел «Зависимости» ниже) вызываются на верхнем уровне модуля модели страницы, не в компоненте — так уже сделано в `pages/*/model/registry.model.ts`, при переносе не оборачивайте их в `useMemo`.

## 13. Деталка документа

Деталка «Платёжная инструкция» (срезы 2a и 2b — просмотр; правка валютной деталки — срез 2c, раздел 14) открывается из обоих реестров: кнопка открытия записи — drawer A у правого края окна, двойной клик или Shift+клик — drawer B слева от A, для сравнения двух документов. Реестр под деталкой остаётся рабочим (фильтры, выделение, страница). Спека — `docs/superpowers/specs/2026-09-29-katran-detail-view-design.md`; 2b — `docs/superpowers/specs/2026-09-30-katran-detail-tabs-design.md`; эндпоинт и состав детали для бека — `docs/reference/pi-api.md` §1.4 и §7, вкладок — §1.6 и §8.

С среза 2b все вкладки показывают содержимое: «Общие данные» и «Доп. поля» (валюта) — из детали, остальные грузятся лениво отдельным запросом (`GET …/documents/{id}/tabs/{tab}`, `pi-api.md` §1.6 и §8). Связанный документ открывается по клику на его ID в drawer B. Кнопки вкладок и действия лейна — заглушки до 2d (раздел 13.5).

### 13.0. Если реестры у вас уже перенесены

Деталка — не только новые папки: срезы 2a и 2b поменяли и файлы, которые вы уже скопировали по разделу 2. Их нужно скопировать заново (или перенести изменения из `git log` веток 2a и 2b):

| Файл | Что поменялось |
|---|---|
| `shared/api/ports.ts` | перегрузка `createGridPorts({ gridId, parseRow, parseDetail })` — с `parseDetail` порты получают `detailFx`; типы `DetailParser`, `DetailPort`, `GridPortsConfig` |
| `shared/api/guards.ts` | новый гард `strArr` |
| `shared/api/index.ts` | экспорт `strArr` и новых типов портов |
| `entities/fx-doc/api/ports.ts`, `entities/rub-doc/api/ports.ts` | передают `parseDetail: parseFxDocDetail` / `parseRubDocDetail` — у `fxDocPorts`/`rubDocPorts` появляется `detailFx` |
| `entities/fx-doc/index.ts`, `entities/rub-doc/index.ts` | экспорт детали: типы, профили, вкладки, действия, домен `fxDocDetailDomain`/`rubDocDetailDomain`, мапперы и примеры (исключение — раздел 13.1) |
| `widgets/doc-registry/ui/DocRegistry.tsx` | проп `marked` (метка открытых записей) |
| `pages/*/model/registry.model.ts` | модель деталки `detail`, связка `openRequested → detail.open`, автооткрытие первой записи (раздел 13.2) |
| `pages/*/ui/*Page.tsx` | `DocDetail` рядом с `DocRegistry`, `marked`, `rowOf`, `returnFocus` (раздел 13.2) |
| `shared/api/ports.ts` (2b) | `parseTab` в `createGridPorts` — с ним порты получают `tabFx`; типы `TabQuery`, `TabParser`, `TabPort` |
| `shared/api/index.ts` (2b) | экспорт `TabQuery`, `TabParser`, `TabPort` |
| `shared/lib/detail/*` (2b) | `TabContext`, `TabView`, `LocalTabView`, `RemoteTabView`, `remoteTab`, `DetailDomain.tabViews` |
| `entities/fx-doc/api/ports.ts`, `entities/rub-doc/api/ports.ts` (2b) | `parseTab: trailParsersFor(FX_TABS)` / `trailParsersFor(RUB_TABS)` — парсеры `TRAIL_PARSERS` сущности `doc-trail` по набору вкладок реестра (через `@x`) |
| `entities/fx-doc` (2b) | «Доп. поля»: `ExtraTab`, `fxExtraView`, `fxExtraGroups` (`model/extra.ts`, `ui/ExtraTab.tsx`, `ui/extra.module.css`); тип детали не менялся |
| `entities/fx-doc/index.ts` (2b) | экспорт `fxExtraView`, `ExtraTab`, `fxExtraGroups` |
| `widgets/doc-detail/*` (2b) | `tabFx`, `localTabs`, `tabView` слота, `retryTab`, `$expanded`, `setExpanded`; скелетон, ошибка и «Повторить» вкладки (раздел 13.1) |
| `pages/*/model/registry.model.ts` (2b) | `FX_LOCAL_TABS` / `RUB_LOCAL_TABS`, `tabFx` и `localTabs` в `createDetail` (раздел 13.2) |
| `pages/*/ui/detailDomain.ts` (2b, новый), `pages/*/ui/*Page.tsx` | домен деталки с `tabViews` — `fxDetailDomain` / `rubDetailDomain` вместо домена сущности; виды `doc-trail` — `trailViewsFor(FX_TABS)` / `trailViewsFor(RUB_TABS)` (раздел 13.2) |
| `pages/*/index.ts` (2b) | экспорт `fxDetailDomain` / `rubDetailDomain` и `FX_LOCAL_TABS` / `RUB_LOCAL_TABS` |

Новые папки — целиком: `widgets/doc-detail/`, `entities/posting/`, `shared/lib/detail/`, `entities/doc-trail/` (2b, вместе с `@x/fx-doc.ts` и `@x/rub-doc.ts`), а в `entities/fx-doc/` и `entities/rub-doc/` — новые файлы `model/detail.ts`, `model/swift.ts` / `model/profiles.ts`, `api/detail.mapper.ts`, `api/detail.example.ts`, `ui/detail.tsx`, `ui/detail.module.css`. `app/fake/*` (фейк детали) по-прежнему не переносится.

**Кит нужен свежий.** Все три пакета кита по-прежнему версии `0.1.0`, а срез 2a лежит в `CHANGELOG.md` в разделе «0.1.0 — в работе»: номер версии не отличает кит с деталкой от кита без неё. Если вы ставили кит тарболами, соберите их заново из текущего кода — `examples/federation/scripts/pack-kit.sh` (собирает три пакета и кладёт `.tgz` в `.kit/`; подробности — `docs/consuming.md`, «Откуда пакеты»), и переустановите; во внутренний реестр — опубликуйте заново. Со старыми тарболами сборка упадёт на импорте `Drawer`/`createDrawerStackModel`. Срез 2b добавил в кит (тот же раздел `CHANGELOG.md`): `MiniTable`, `StatusBadge`, `Timestamp`, `KeyValueList`, `CodeView`, форматтеры `formatTimestamp`, `formatDuration`, `timestampDiff`, `Disclosure` с `mono`/`emptyText`, `ConfigForm` с управляемым раскрытием `expanded`/`onExpandedChange`; тег-метка `Tag tone="mt"` — прежний.

### 13.1. Из чего состоит

| Где | Что |
|---|---|
| `widgets/doc-detail` | `createDetail({ detailFx, lifecycle })` (`lib/createDetail.ts`) — модель: стек A/B кита (`createDrawerStackModel` из `@katran/effector`) плюс загрузка документа по слоту и кэш по `id` на время открытого экрана; `$slots` (у каждого слота `id`, вкладка, состояние `loading`/`ready`/`error`, данные, текст ошибки), `$marks` (метки записей для грида), `open`, `close`, `closeTop`, `setTab`, `retry`. `DocDetail` (`ui/DocDetail.tsx`) — экран: `DrawerStack` кита, в слоте — шапка, лейн действий, `Tabs` с переполнением, во вкладке «Общие данные» — `ConfigForm` кита; скелетон на загрузку, ошибка с «Повторить». С 2b — ленивые вкладки: `createDetail({ detailFx, tabFx, localTabs, lifecycle })` грузит нелокальную вкладку при выборе, кэш по `id:tab` до ухода с экрана, у вкладки свои скелетон (не меньше 400 мс), ошибка «Не удалось загрузить вкладку» и «Повторить» (`retryTab(slot)`); раскрытое во вкладках (строки, аккордеоны, поля «Общих») — в модели, `$expanded` по ключу `id:tab`, переживает переключение вкладок и закрытие drawer'а. Виды вкладок виджет получает из домена (`tabViews`). Виджет один на оба реестра и `entities` не импортирует |
| `entities/fx-doc`, `entities/rub-doc` | всё доменное — объект `DetailDomain` сущности: `fxDocDetailDomain`, `rubDocDetailDomain` (`ui/detail.tsx`): заголовок, вкладки, действия лейна, реестр полей, профиль «Общих данных» по типу документа (`schemaOf`), сводка, блоки и секции. Тип детали — `FxDocDetail`/`RubDocDetail` (`model/detail.ts`), маппер — `api/detail.mapper.ts`, порт — `fxDocPorts.detailFx`/`rubDocPorts.detailFx` (с 2b — и `tabFx`). Виды вкладок в домен сущности не входят — их добавляет страница (`tabViews`, раздел 13.2) |
| `entities/posting` | проводки деталки: тип `Tx`, маппер `parseTx`/`parseTxs`, блок `TxBlock`; соседям — через `@x/fx-doc.ts` и `@x/rub-doc.ts` (раздел 12) |
| `entities/doc-trail` (2b) | история обработки документа, общая для обоих реестров: типы вкладок (`model/types.ts`), `toneOf`, мапперы `TRAIL_PARSERS` (`api/trail.mapper.ts`), примеры `TRAIL_EXAMPLES` (`api/trail.example.ts`), виды `TRAIL_VIEWS` и `trailViewsFor(tabs)` (`ui/views.ts`: Статусы, Комплаенс, Связанные, Задачи, Нотификации, Исходный текст / ED244, Стриминг, MPU, Аудит); соседям — `trailParsersFor` через `@x/fx-doc.ts`, `@x/rub-doc.ts` |
| `shared/lib/detail` | типы шва «сущность → виджет»: `DetailDomain` (с 2b — `tabViews`), `DetailSummary`, `DetailTab`, `DetailAction`, `ActionIcon`; вкладки (2b) — `TabContext`, `TabView` (`LocalTabView` / `RemoteTabView`), `remoteTab` |
| `shared/api` | `createGridPorts({ gridId, parseRow, parseDetail, parseTab })` — при `parseDetail` порты получают `detailFx: Effect<string, Detail, ApiError>` (`GET /grids/{gridId}/documents/{id}`, `id` кодируется в пути), при `parseTab` (2b) — `tabFx: Effect<TabQuery, unknown, ApiError>` (`GET …/documents/{id}/tabs/{tab}`; вкладка без парсера — `contractError` до запроса, битая форма ответа — после) |

Из кита деталке нужны (`@katran/ui`): новые в 2a — `Drawer`, `DrawerStack` (тип `DrawerStackItem`), `Tabs` с `overflow` и `variant="line"`, `ConfigForm` (типы `FormSchema`, `FieldDef`, `FieldValue`, `HeroCell`, `SectionContent`, `FieldPresenter`, `FieldView`), `FieldRow`, `Disclosure`, `DataGrid` с `marked`, `gridFocusTarget`; прежние — `TabPanel`, `ErrorState`, `Skeleton`, `useLoadingGate`, `Menu`, `IconButton`, `LinkValue`, `StatusDot`, `Tag`, `useKatran`, форматтеры `formatAmount`, `formatDate`, `formatDateTimeFull`; новые в 2b (вкладки) — `MiniTable` (тип `MiniColumn`), `StatusBadge` (`BadgeTone`), `Timestamp`, `KeyValueList` (`KeyValueItem`), `CodeView`, `formatTimestamp`, `formatDuration`, `timestampDiff`, `Disclosure` с `mono`/`emptyText`, `ConfigForm` с `expanded`/`onExpandedChange`, прежние `CopyValue`, `EmptyState`, `Button`, `Tag tone="mt"`. Из `@katran/effector` — `createDrawerStackModel` (типы `DrawerEntry`, `DrawerSlot`, `DrawerStackModel`). Кит — собранный из кода со срезами 2a и 2b (раздел 13.0).

**`createDetail`** (`widgets/doc-detail/lib/createDetail.ts`):

```ts
type DetailConfig<D> = {
  detailFx: Effect<string, D, ApiError>
  tabFx?: Effect<TabQuery, unknown, ApiError> | undefined   // порт вкладок (2b); нет — нелокальные вкладки не грузятся
  localTabs?: string[] | undefined       // вкладки с данными в детали, без своего запроса; по умолчанию ['main']
  lifecycle: PageLifecycle
  firstTab?: string | undefined          // вкладка только что открытого документа; по умолчанию 'main'
}
type TabSlot = { state: 'loading' | 'ready' | 'error'; data: unknown; error: string | null }
type DetailSlot<D> = {
  slot: 'a' | 'b'; id: string; tab: string; state: 'loading' | 'ready' | 'error'; data: D | null; error: string | null
  tabView: TabSlot | null                // активная нелокальная вкладка; null — локальная или порта вкладок нет
}
type Detail<D> = {
  stack: DrawerStackModel                                   // модель стека кита (opened, alreadyOpen, closeAll, $a, $b …)
  $slots: Store<{ a: DetailSlot<D> | null; b: DetailSlot<D> | null }>
  $marks: Store<Record<string, 'a' | 'b'>>                  // id документа → слот; для DataGrid marked
  $focus: Store<Record<string, number>>                     // растёт при повторном открытии открытого — Drawer focusKey
  $quiet: Store<Record<string, true>>                       // открытые не пользователем (quiet): drawer не забирает фокус
  open: EventCallable<DrawerOpen>                           // { id, secondary, quiet? } — тот же payload, что у registry.openRequested
  close: EventCallable<'a' | 'b'>
  closeTop: EventCallable<void>
  setTab: EventCallable<{ slot: 'a' | 'b'; tab: string }>
  retry: EventCallable<'a' | 'b'>
  retryTab: EventCallable<'a' | 'b'>                        // повтор активной нелокальной вкладки слота (2b)
  $expanded: Store<Record<string, string[]>>                // раскрытое во вкладках по ключу `${id}:${tab}` до pageClosed (2b)
  setExpanded: EventCallable<{ id: string; tab: string; keys: string[] }>
}
```

`firstTab` задавайте, только если первая вкладка вашего набора — не `'main'` (у обоих наборов `apps/pi` первая — `'main'`).

**Исключение из правила «мапперы наружу не отдаются».** `entities/fx-doc` и `entities/rub-doc` экспортируют `parseFxDocDetail`/`parseRubDocDetail` и примеры ответа `FX_DETAIL_EXAMPLE`/`RUB_DETAIL_EXAMPLE`, `entities/posting` — `parseTx`/`parseTxs`. Это санкционированное исключение (спека `apps/pi` §5.2) только для тестов и примеров контракта: на примерах гоняются тесты мапперов (`api/detail.mapper.test.ts`), из них же — примеры в `pi-api.md` §7.5; мапперы нужны тесту доступности `app/details.a11y.test.tsx` (деталь фейка → тип детали для каждого типа документа). Рабочий код вызывает только порты (`detailFx`); в своих модулях мапперы напрямую не зовите.

### 13.2. Сборка на странице

Модель страницы создаёт реестр и деталку на одном `lifecycle` и связывает их через шов `openRequested` реестра — реестр о деталке не знает (`apps/pi/src/pages/fx-docs/model/registry.model.ts`):

```ts
import { createStore, sample } from 'effector'
import { fxDocLayout, fxDocPorts } from '../../../entities/fx-doc'
import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createDetail } from '../../../widgets/doc-detail'
import { createRegistry } from '../../../widgets/doc-registry'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'fx-docs', layout: fxDocLayout, ports: fxDocPorts, lifecycle })
/** Вкладки валюты с данными в детали — без своего запроса (спека 2b §3.1): «Общие данные» и «Доп. поля». */
export const FX_LOCAL_TABS = ['main', 'extra']
/**
 * Деталка экрана — на том же жизненном цикле: уход с экрана закрывает оба drawer'а, чистит кэш детали и вкладок
 * и раскрытое (спека 2a §5, 2b §3.3). Остальные вкладки — лениво через tabFx.
 */
export const detail = createDetail({ detailFx: fxDocPorts.detailFx, tabFx: fxDocPorts.tabFx, localTabs: FX_LOCAL_TABS, lifecycle })
// реестр о деталке не знает: открытие — через шов openRequested (спека apps/pi §7, спека 2a §4.4)
sample({ clock: registry.openRequested, target: detail.open })

// В-Д4: при первом ответе реестра после входа на экран первая запись открывается в A (эталон grid.html:2192);
// quiet — открытие не пользователем: фокус остаётся в реестре (R10)
const $autoOpened = createStore(false).reset(lifecycle.pageClosed)
const firstRow = sample({
  clock: registry.grid.$rows.updates,
  source: { done: $autoOpened, opened: lifecycle.$opened },
  filter: ({ done, opened }, rows) => opened && !done && rows.length > 0,
  fn: (_, rows) => rows[0]!,
})
$autoOpened.on(firstRow, () => true)
sample({ clock: firstRow, fn: (row) => ({ id: fxDocLayout.rowKey(row), secondary: false, quiet: true }), target: detail.open })
```

Автооткрытие — поведение эталона, не механизм деталки: в A открывается первая запись **первого непустого** ответа реестра после входа на экран (пустой ответ пропускается, флаг сбрасывается только `pageClosed`). Открывается она с `quiet: true`: фокус в drawer не переходит и остаётся в реестре, как на эталоне (там фокусом не управляют вовсе). Открытие пользователем (кнопка, двойной клик, Shift, клавиатура) `quiet` не передаёт — фокус уходит в заголовок drawer'а. Метка «тихого» открытия (`detail.$quiet`) живёт, пока документ открыт: повторное открытие того же документа пользователем фокус в его drawer переводит. Если оно вам не нужно, удалите последний блок (четыре выражения с `$autoOpened`/`firstRow`) и заодно `createStore` из импорта `effector` — иначе он останется неиспользованным и линт упадёт; остальное от блока не зависит.

`FX_LOCAL_TABS` — вкладки, чьи данные приходят в детали («Общие данные» и «Доп. поля»): для них `tabFx` не вызывается. У рубля — `RUB_LOCAL_TABS = ['main']`. Каждая вкладка вида `local` обязана быть в этом списке — тесты страницы (`model/registry.model.test.ts`) это проверяют.

Виды вкладок собирает страница: она видит и `fx-doc`, и `doc-trail` (`apps/pi/src/pages/fx-docs/ui/detailDomain.ts`). `trailViewsFor(FX_TABS)` — виды `doc-trail` ровно для вкладок набора, у которых они есть (зеркально `trailParsersFor` порта; рубль — `trailViewsFor(RUB_TABS)`):

```ts
import { trailViewsFor } from '../../../entities/doc-trail'
import { FX_TABS, fxDocDetailDomain, fxExtraView, type FxDoc, type FxDocDetail } from '../../../entities/fx-doc'
import type { DetailDomain, TabView } from '../../../shared/lib/detail'

/**
 * Виды вкладок валюты (спека 2b §3.4): «Доп. поля» — локальная, из детали (fx-doc); общие вкладки истории обработки —
 * виды doc-trail по набору FX_TABS (у валюты «Исходный текст» — source, ED244 нет). «Общие данные» рисует ConfigForm виджета.
 * Собирается здесь: соседние сущности друг друга не видят (FSD), а страница видит обе через index.ts.
 */
const tabViews: Record<string, TabView<FxDocDetail>> = { extra: fxExtraView, ...trailViewsFor(FX_TABS) }

export const fxDetailDomain: DetailDomain<FxDocDetail, FxDoc> = { ...fxDocDetailDomain, tabViews }
```

Экран рендерит реестр и деталку рядом (`apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx`):

```tsx
import { useUnit } from 'effector-react'
import { gridFocusTarget, useKatran } from '@katran/ui'
import { fxDocLayout } from '../../../entities/fx-doc'
import { DocDetail } from '../../../widgets/doc-detail'
import { DocRegistry } from '../../../widgets/doc-registry'
import { detail, registry } from '../model/registry.model'
import { fxDetailDomain } from './detailDomain'

const TITLE = 'Валютные документы'

/** note — пояснение над реестром; текст задаёт приложение (у стенда — про фейковый сервер), слайс его не знает. */
export function FxDocsPage({ note }: { note?: string | undefined }) {
  const { announce } = useKatran()
  const [rows, marks] = useUnit([registry.grid.$rows, detail.$marks])
  return (
    <>
      <DocRegistry
        registry={registry}
        layout={fxDocLayout}
        title={TITLE}
        describe={(d) => `документ ${d.docNumber}`}
        note={note}
        bulkActions={[
          { label: 'Экспортировать', onClick: (n) => announce(`Экспорт: выбрано ${n}`) },
          { label: 'Отложить', onClick: (n) => announce(`Отложить: выбрано ${n}`) },
        ]}
        rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
        openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
        marked={(d) => marks[fxDocLayout.rowKey(d)] ?? null}
      />
      <DocDetail
        detail={detail}
        domain={fxDetailDomain}
        rowOf={(id) => rows.find((r) => fxDocLayout.rowKey(r) === id) ?? null}
        returnFocus={(id) => gridFocusTarget(TITLE, id)}
      />
    </>
  )
}
```

- `marked` — метка записей, открытых в A и B (подсветка записи и пометка в имени кнопки открытия).
- `rowOf` — строка реестра по `id`: шапка и лейн (номер, статус) показываются из неё, пока деталь грузится или если загрузка упала.
- `returnFocus` — куда вернуть фокус при закрытии drawer'а: `gridFocusTarget(title, id)` кита ищет кнопку открытия этой записи в гриде с доступным именем `title` (то же, что `title` у `DocRegistry`), а если записи на странице уже нет — активную ячейку грида. Кит зовёт её, **только если фокус потерян** — был внутри закрытого drawer'а (оказался на `body`) или стоит там, куда его вернуло прошлое закрытие; если пользователь сам увёл фокус из drawer'а (в фильтр, в грид), фокус остаётся, где он. Исключение в `returnFocus` кит глушит.
- `DocDetail` рендерит drawer'ы порталом в корень `KatranProvider` — отдельного контейнера на странице ему не нужно; ширина drawer'а — токен `--k-drawer` (800 при плотности 100 %, растёт с плотностью).
- **Drawer занимает окно по высоте целиком:** `position: fixed; top: 0; bottom: 0`, у правого края, `z-index` — токен `--k-z-drawer` (100). Верхнюю панель хоста (шапку метаприложения) он перекроет; настройки отступа сверху в ките пока нет (техдолг, `docs/STATE.md` §7). Если шапка хоста должна оставаться видимой — сообщите нам, это правка `Drawer` кита, а не ваша.

Рублёвый экран — то же самое с `rubDocPorts`, `rubDocLayout`, `RUB_LOCAL_TABS` и доменом `rubDetailDomain` (`apps/pi/src/pages/rub-docs/`; в `ui/detailDomain.ts` — только виды `doc-trail` по `RUB_TABS`).

### 13.3. Бек отдаёт деталь иначе

- Другой адрес детали (не `GET /grids/{gridId}/documents/{id}`) — одна строка в `apps/pi/src/shared/api/ports.ts`: ``url: `${base}/documents/${encodeURIComponent(id)}` `` внутри `detailFx` (адрес общий для обоих гридов).
- Другие имена или структура полей детали — правится только маппер: `apps/pi/src/entities/fx-doc/api/detail.mapper.ts` (`parseFxDocDetail`) и `apps/pi/src/entities/rub-doc/api/detail.mapper.ts` (`parseRubDocDetail`); проводки — `apps/pi/src/entities/posting/api/posting.mapper.ts`. Маппер обязан вернуть `FxDocDetail`/`RubDocDetail` — виджет и блоки видят только их. После правки обновите пример в `api/detail.example.ts` под форму своего бека — на нём гоняется `detail.mapper.test.ts`.
- Новый тип SWIFT-сообщения — профиль в `FX_PROFILES` (схема `FormSchema`: сводка, блоки, сетка пар, текст, extra, при необходимости `seqB`) и недостающие поля в `FX_FIELDS` — оба в `apps/pi/src/entities/fx-doc/model/swift.ts`; тип добавляется и в `FX_TYPES` строки (`model/fxDoc.ts`).
- Рублёвые секции и реквизиты — константы `apps/pi/src/entities/rub-doc/model/profiles.ts`: состав сторон `RUB_PARTY`, секции `RUB_SECTIONS`/`RSECTION_TITLE` и строки секций (`PURPOSE_EXTRA_ROWS`, `AGENT_COLS`, `BUDGET_ROWS`, `COLLECT_ROWS`, `ED107_HEAD`, `ED107_GROUPS`), подписи реквизитов `RFIELDS`, коды операций `RUB_OPERATION`.
- Вкладки и действия лейна — `FX_TABS`/`FX_ACTIONS` и `RUB_TABS`/`RUB_ACTIONS` там же; ключи вкладок — те же, что в `tabsOff` ответа (`pi-api.md` §7.4).
- **Бек отдаёт вкладку иначе** (другие имена полей, другая вложенность ответа `GET …/tabs/{tab}`) — правится только маппер вкладки в `apps/pi/src/entities/doc-trail/api/trail.mapper.ts` (`parseStatuses`, `parseTasks`, … — таблица `TRAIL_PARSERS`): он обязан вернуть тип из `model/types.ts`, виды вкладок видят только его. После правки замените пример вкладки в `api/trail.example.ts` (`TRAIL_EXAMPLES`) ответом своего бека — на нём гоняется `api/trail.mapper.test.ts`. Другой адрес вкладки — одна строка `url` внутри `tabFx` в `apps/pi/src/shared/api/ports.ts`. Ответ — всегда объект, пустая вкладка — объект с пустым списком и ключ в `tabsOff` детали (`pi-api.md` §1.6, §8).

### 13.4. Жизненный цикл

`pageClosed` экрана закрывает оба drawer'а и очищает кэш деталей: при возврате прежние деталки не всплывают. Ответ, пришедший после ухода, не принимается — ни в кэш, ни в ошибки, ни в состояние загрузки: у каждого запроса номер визита экрана (растёт на `pageOpened`), и запрос прежнего визита, висевший при уходе, нового визита не касается, даже если ответил уже после возврата. Автооткрытие первой записи при возврате (13.2) фокус не забирает. Адаптеру роутера (раздел 5) делать для деталки ничего дополнительно не нужно — хватает тех же `pageOpened`/`pageClosed`. Кэш по `id` живёт, пока экран открыт: переключение A↔B и повторное открытие не перезапрашивают деталь; «Повторить» в состоянии ошибки — `retry(slot)`. `refreshRequested` реестра деталь не трогает; после сохранения правки деталь приходит в ответе и кладётся в кэш (`replaceDetail`), после `409` — перезапрашивается (`reloadDetail`) — раздел 14. Вкладки (2b) живут так же: кэш по `id:tab`, раскрытое (`$expanded`) и ошибки вкладок очищает `pageClosed`; ответ вкладки прежнего визита не принимается; «Повторить» во вкладке — `retryTab(slot)`, повторный выбор вкладки с ошибкой — тоже новый запрос.

### 13.5. Жесты и клавиатура

- Клик по кнопке открытия — A через 220 мс: `DataGrid` ждёт, не будет ли второго клика (токен `--k-t-open-delay`).
- Двойной клик — документ в B, рядом с A (A не заменяется); если A пуст — в A.
- Shift+клик — в B сразу; Enter/Space на кнопке — в A сразу.
- Документ, уже открытый в A или B, повторно не открывается — фокус переходит в его drawer.
- Esc или «×» — закрывает сначала B, потом A; фокус возвращается на кнопку открытия записи (`returnFocus`), если был в закрытом drawer'е (13.2). Закрытие A «×» при открытом B: B сдвигается в A, фокус — в заголовок оставшегося drawer'а, а не в грид (R11). Esc в поле ввода, в меню и в поповере drawer не закрывает — у них Esc свой (меню «••• N» вкладок закрывается, деталка остаётся). Видимый тултип тоже забирает Esc первым: первое нажатие прячет подсказку, второе закрывает drawer. Пока деталка открыта, Esc из интерактивного элемента внутри ячейки грида тоже закрывает drawer (без деталки он возвращает фокус в ячейку).
- Действия лейна в 2a — заглушки: объявляют действие через `announce`, как массовые действия реестра; настоящие — срез 2d (раздел 15). Кнопки вкладок 2b («Переотправить», «Перейти в блок «Ручные отклонения»», «История», «Исходное сообщение») — тоже заглушки: `announce` «Действие будет в 2d».
- Раскрываемые строки вкладок («Связанные», «Задачи») — мышью и Enter/Space на шевроне, `aria-expanded`; клик по ссылке или кнопке внутри строки её не раскрывает. ID связанного документа — ссылка-кнопка «Открыть … в соседней панели»: документ открывается в B (уже открытый — фокус в его drawer). Esc внутри `CodeView` и раскрытых строк не перехватывается — работает, как в остальной деталке.

### 13.6. Как проверить

- **Контрактный тест детали против своего бека.** Блоки «контракт детали» лежат в `apps/pi/src/app/fake/contract.test.ts`, а `app/` не переносится — скопируйте два блока `describe('контракт детали fx-docs …')` и `describe('контракт детали rub-docs …')` в свой тестовый файл и подставьте свой обработчик в `fork({ handlers: [[requestFx, myHandler]] })` (раздел 7). Против настоящего бека держите проверки, которые требует контракт: `detailFx` по `id` строки из `searchFx` завершается `done`, номер (`docNumber`), сумма (`amount`), статус (`status`) и тип — как у строки (`pi-api.md` §7.1); каждый тип документа разбирается маппером; неизвестный `id` — `404` (подставьте заведомо несуществующий `id` своего бека). Специфичны для фейка и уберите: равенство сторон и полей строке (`fields['50'].acc === row.f50acc`, `fields['57'].lines`, `party.s.acc === row.fromAcc`, `party.r.inn === row.toInn`) — так фейк строит деталь, бек не обязан; `'nope'`/`'rub-9999'` как «несуществующий» `id`; `500` через `createFakeServer(…, { failing: () => 'detail' })`; тест «есть документ с бюджетными реквизитами и с посредниками» (`makeRubDocDetail` — данные фейка).
- **Мапперы** — `entities/*/api/detail.mapper.test.ts` переезжают вместе со слайсом; если меняли маппер под свой бек — обновите `api/detail.example.ts`.
- **Контрактный тест вкладок.** Блоков вкладок в том же `contract.test.ts` два. `describe('контракт вкладок (спека 2b …)')` строит свои порты — `createGridPorts({ …, parseTab: TRAIL_PARSERS })`, все парсеры `doc-trail` без набора реестра; `describe('контракт вкладок: порты сущностей …')` гоняет сами `fxDocPorts.tabFx`/`rubDocPorts.tabFx` (парсеры по набору реестра, чужая вкладка — отказ без запроса). Вместе (`…/tabs/{tab}`): каждая вкладка набора отвечает `200` и разбирается маппером, `tabsOff` детали совпадает с пустотой вкладок; `404` на вкладку не из набора и `500` по `?fail=tab:<id>` — там же; подробнее `404` (неизвестный грид, документ, вкладка) и `500` по `?fail=tab` проверяет `apps/pi/src/app/fake/server.test.ts`. Против своего бека оставьте `200`, разбор, совпадение `tabsOff` и `404`; `500` через регулятор и тест «данные разнообразны» — специфика фейка, уберите.
- **Мапперы вкладок** — `entities/doc-trail/api/trail.mapper.test.ts` (на `TRAIL_EXAMPLES`, включая битые формы) переезжает вместе со слайсом.
- **e2e деталки** — `apps/pi/e2e/detail.spec.ts` (Playwright, `@playwright/test`, раздел «Зависимости»): как сценарий для своего e2e — геометрия против эталона ± 2 (drawer 800, шапка 44, лейн 36, вкладки 32, строка поля 27), A+B рядом, двойной клик и Shift, Esc по порядку, повторное открытие, меню «••• N», скелетон, ошибка с «Повторить», уход с экрана. Как есть он не заработает: завязан на стенд — маршруты `#/fx-docs`/`#/rub-docs`, регуляторы фейка `?slow=N`, `?fail=detail`, `?hostile`, данные фейка (запись 3 валюты заблокирована, первая запись открывается при входе), превью на порту 5186. Эти места замените своими. Вкладки — `apps/pi/e2e/detail-tabs.spec.ts`: высоты строк вкладок против эталона ± 2 (таблица 24, шапка 22, «ключ–значение» 24, раскрываемая строка 26), «Связанный» → B, ошибка вкладки и «Повторить» (`?fail=tab:audit`), кэш вкладок (взведённый `?fail=tab` не срабатывает на уже загруженной вкладке), `?hostile`; завязан на те же данные фейка.

### 13.7. Как добавить вкладку

Ниже — что править у себя (переносимый код) и что дополнительно только на стенде katran (фейк `app/fake/*` и его тесты к вам не переезжают). Шаги для общей вкладки (история обработки, оба реестра) и отдельно — что меняется для вкладки одного реестра и для локальной.

1. **Ключ и данные** (`entities/doc-trail`). Ключ — в объединение `TrailTabId` (`model/types.ts`); тип данных — там же; маппер — в `api/trail.mapper.ts` и в `TRAIL_PARSERS`; пример ответа — в `api/trail.example.ts` (`TRAIL_EXAMPLES`), тест маппера — на нём. `TRAIL_PARSERS`, `TRAIL_EXAMPLES` и `TRAIL_VIEWS` типизированы `Record<TrailTabId, …>`: после правки `TrailTabId` компилятор требует ключ во всех трёх — до шага 2 `TRAIL_VIEWS` не типизируется, это ожидаемо.
2. **Вид** (`entities/doc-trail/ui`). Компонент вкладки и ключ в `TRAIL_VIEWS` (`ui/views.ts`): `remoteTab<T>({ render: (data, ctx) => …, skeletonRows })` (`shared/lib/detail`). `data` — уже разобранный маппером ответ, `ctx` — `docId`, `openDocument(id)` (открыть в B), `announce(text)`, `expanded`/`setExpanded` (раскрытое переживает переключение вкладок; `null` — ещё не трогали, берите свои умолчания). Блоки — из кита: `MiniTable`, `KeyValueList`, `CodeView`, `StatusBadge`, `Timestamp`, `Disclosure`, `EmptyState`.
3. **Набор вкладок.** Ключ и подпись — в `FX_TABS` (`entities/fx-doc/model/swift.ts`) и/или `RUB_TABS` (`entities/rub-doc/model/profiles.ts`); порядок полосы фиксированный. Порт (`entities/*/api/ports.ts`, `trailParsersFor(FX_TABS)`) и домен страницы (`pages/*/ui/detailDomain.ts`, `trailViewsFor(FX_TABS)`) подхватят вкладку сами — оба берут ровно ключи набора, у которых есть парсер / вид `doc-trail`; руками там ничего не добавляется. Ключ в `tabsOff` детали, когда данных нет, ставит бек (удалённая вкладка; на стенде — фейк, `tabsOffOf`).
4. **Контракт для бека.** Подраздел в `docs/reference/pi-api.md` §8 (форма ответа и пример — `TRAIL_EXAMPLES` дословно), ключ — в списки §1.6 (набор `tab` по гридам) и в таблицу §7.4.
5. **Проверка у себя.** Тест маппера на примере; тесты страницы (`pages/*/model/registry.model.test.ts`) — у каждой вкладки набора есть вид нужного вида и парсер в порту; контрактный тест `…/tabs/{tab}` своего бека — по образцу блоков вкладок `apps/pi/src/app/fake/contract.test.ts` (раздел 13.6). Если перенесли и `app/details.a11y.test.tsx` — он проходит под axe каждую вкладку набора, но только на документе, где у вкладки есть данные: с вашим беком подставьте свои порты, без данных тест падает с «нет документа с вкладкой».
6. **Только на стенде katran** (фейк и его тесты). Ключ — в `FX_TRAIL_TABS` (`app/fake/fx-docs.trail.ts`) и/или `RUB_TRAIL_TABS` (`app/fake/rub-docs.trail.ts`), данные — в генераторе `fxDocTrail` / `rubDocTrail` того же файла: без ключа в наборе фейк отвечает `404` «Неизвестная вкладка» (`app/fake/server.ts`), а `tabsOff` детали по вкладке не считается (`tabsOffOf`, `app/fake/trail.data.ts`). В `app/fake/contract.test.ts` — жёсткий список ключей `TRAIL_PARSERS` (тест «TRAIL_PARSERS: ключи — ровно TrailTabId…») дополнить новым ключом; `app/details.a11y.test.tsx` пройдёт вкладку, только когда фейк отдаёт по ней данные.

**Вкладка одного реестра.** Отдельных файлов `trail.*` в `entities/fx-doc` / `entities/rub-doc` нет — заведите их по образцу `doc-trail` в своей сущности (тип, маппер, пример, вид) и подключите слиянием, рядом с общими: порт — `parseTab: { ...trailParsersFor(FX_TABS), mytab: parseMyTab }` (`entities/fx-doc/api/ports.ts`); вид — экспорт из `entities/fx-doc/index.ts` и `{ extra: fxExtraView, mytab: myTabView, ...trailViewsFor(FX_TABS) }` в `pages/fx-docs/ui/detailDomain.ts`. Ключ — только в `FX_TABS`, не в `TrailTabId`. Инвариант стенда «ключи `TRAIL_PARSERS` = все нелокальные вкладки обоих реестров» (`app/fake/contract.test.ts`, тот же тест, и соседний «виды вкладок страниц (trailViewsFor)…») тогда перестаёт быть равенством: вычтите свои вкладки реестра из нелокальных (`remoteOf(FX_TABS, ['main', 'extra', 'mytab'])`) и проверьте их отдельно — ключ есть в парсерах порта и в `tabViews` домена.

**Локальная вкладка** (данные приходят в детали). Поля — в типе детали и её маппере (`entities/*/api/detail.mapper.ts`), парсер вкладки не нужен; вид — `{ kind: 'local', render: (detail, ctx) => … }` в `tabViews` домена страницы (как `fxExtraView`); ключ — в `FX_TABS`/`RUB_TABS` и в `FX_LOCAL_TABS` / `RUB_LOCAL_TABS` модели страницы (`pages/*/model/registry.model.ts`). Ключ локальной вкладки в `tabsOff` ставит бек в ответе детали (pi-api §7.4), когда её данных нет; маппер детали только передаёт `tabsOff` как есть (`detail.mapper.ts`). Если бек этого не делает, вычислять ключ по пустоте полей — правка маппера детали; сейчас такого кода нет.

```ts
// entities/doc-trail/ui/views.ts — так устроены готовые виды
export const TRAIL_VIEWS: Record<TrailTabId, RemoteTabView> = {
  statuses: remoteTab<StatusEvent[]>({ render: (data, ctx) => createElement(StatusesTab, { data, ctx }) }),
  // …
}
```

Файл `views.ts` — без JSX, поэтому `createElement`; в `.tsx` то же самое пишется `render: (data, ctx) => <StatusesTab data={data} ctx={ctx} />`.

## 14. Правка деталки (срез 2c)

Валютная деталка правит часть реквизитов: SWIFT-поля «Общих данных» по профилю типа сообщения (50, 52, 56, 57, 59, 70, 72 у MT103; 52, 56, 57, 72 у MT202; у MT202COV — ещё поля последовательности B), 20 исх, счета Дт и Кт (только из справочника), дату валютирования (с подтверждением `Prompt`). У поля — маркер «изменено», «Было / Стало» и блок аудита с историей; ↺ — «вернуть исходное» новой правкой с историей. Рублёвая деталка — только просмотр (на эталоне у неё карандашей нет). Спека — `docs/superpowers/specs/2026-10-06-katran-detail-edit-design.md`; эндпоинты для бека — `docs/reference/pi-api.md` §1.7 (сохранение), §1.8 (счета), правки в детали — §7.6; сверка с эталоном — `docs/reference/detail-drift.md`, раздел «2c».

### 14.0. Если деталка у вас уже перенесена

Срез 2c добавил слой `features` и поменял файлы, которые вы скопировали по разделу 13. Скопируйте заново (или перенесите изменения из `git log` ветки `feat/detail-edit`):

| Файл | Что поменялось |
|---|---|
| `shared/api/edit-ports.ts` (новый), `shared/api/index.ts` | `createEditPorts({ gridId, parseDetail })` → `saveEditFx` (`POST …/edits`, ответ — деталь тем же парсером) и `accountsFx` (`GET …/accounts?side=`); типы `EditValue`, `EditQuery`, `EditPorts`, `AccountItem`, `AccountsQuery`, `AccountSide`; `fromAccountsResponse` |
| `shared/lib/detail/types.ts`, `index.ts` | `EditContext` — правка одного документа для видов сущности; `EditConfirmView`, `AccountsSlot`, `LeaveIntent`; у `DetailDomain` — третий необязательный параметр `edit` у `renderHero`/`renderBlock` (функции рубля с двумя параметрами совместимы) и `formEdit` |
| `entities/fx-doc/model/edit.ts`, `model/rules.ts`, `model/account.ts` (новые) | `FxEdit`, `FxHistEntry`, `currentOf`/`originalOf`/`isChanged`/`sameEditValue`/`fieldTarget`; правила `validateFxEdit`, `normalizeFxEdit`, `fxEditableTargets` (у заблокированного — пусто), `fxEditRule`, `swiftFieldInvalid`, `FX_CONFIRM_TARGETS`; `groupAccount` |
| `entities/fx-doc/model/detail.ts`, `api/detail.mapper.ts`, `api/detail.example.ts` | поле детали `edits` и его разбор (`parseEdits`); пример с правкой поля 57 |
| `entities/fx-doc/model/swift.ts` | `editable: true` у 50, 52, 56, 57, 59, 70, 72 в `FX_FIELDS` |
| `entities/fx-doc/api/ports.ts` | `fxEditPorts = createEditPorts({ gridId: 'fx-docs', parseDetail: parseFxDocDetail })` |
| `entities/fx-doc/ui/edit.tsx`, `ui/edit.module.css` (новые), `ui/detail.tsx`, `ui/detail.module.css`, `index.ts` | виды правки: 20 исх, счета с подсказкой, дата валютирования, маршрут «пересчитан», `fxFormEdit` (карандаши, редактор и аудит полей в `ConfigForm`), `fxCommitView` (текст `Prompt` даты); `renderHero`/`renderBlock` домена принимают `edit` |
| `features/doc-edit/` (новая папка) | `createDocEdit` — модель правки документа, справочники счетов, факты `docEdited`/`conflict`; `useEditContexts` — `EditContext` по документу; `editKey`, `editScope`, `CONFLICT_TEXT`, `DISCARD_VIEW` |
| `widgets/doc-detail/lib/createDetail.ts` | `guard` (охрана ухода): `leaveRequested`/`leave`; `replaceDetail` (деталь ответа — в кэш, сброс вкладок документа), `reloadDetail` (перезапрос после `409`); эпоха документа — ответы, ушедшие до `replaceDetail`, кэш не трогают |
| `widgets/doc-detail/ui/DocDetail.tsx` | проп `editOf`; `Prompt` правки — в слое `overlay` drawer'а своего документа |
| `pages/fx-docs/model/edit.model.ts` (новый), `model/registry.model.ts`, `ui/FxDocsPage.tsx`, `index.ts` | модель правки страницы и её связи; `createDetail({ …, guard: true })`; `editOf` в `DocDetail`; экспорт `docEdit` и `detail` |
| `eslint.config.js` (ваш аналог) | слой `features` в `LAYERS`; зона «`widgets/doc-detail` не импортирует `features`» (раздел 11) |

`pages/rub-docs`, `entities/rub-doc` срез не менял. **Кит нужен свежий** (как в разделе 13.0 — пересобрать тарболы): `Prompt`, `Drawer` с `overlay` (прокрутка drawer'а переехала во внутреннюю часть), `EditMark`, `EditHistory`, `diffFieldValues`/`diffText`/`editCountLabel`, `SuggestInput`, `Option.tag`, `FieldEditor`, `ConfigForm` с `edit`, `FieldDef.editable`, экспорт `useStableId`; в `@katran/effector` — `createEditModel`; новые токены правки — `CHANGELOG.md`, раздел среза 2c.

### 14.1. Из чего состоит

| Где | Что |
|---|---|
| `@katran/effector` — `createEditModel` | правка без DOM и HTTP: один редактор на экран (`$editing`, A и B вместе), черновики по ключу (`$drafts`), ошибки валидатора приложения (`$errors`), `$dirty`, сохранение через `saveFx` приложения (`$saving`, `$saveError`; ответ принимается только своего визита экрана: `saved`/`failed` — для любого ключа, а закрывается редактор или получает `$saveError` только тот, чей ключ в ответе), `$confirm` — ожидающий `Prompt` («Отменить правку?» или подтверждение перед запросом), `requestLeave(next)` (грязный черновик — вопрос, иначе сразу `leave(next)`), `submit` (↺ — сохранение без редактора), факты `saved`/`failed` |
| `features/doc-edit` — `createDocEdit` | модель кита с ключами `` `${id}:${target}` `` (цель — `field:57`, `refOut`, `accDt`, `accKt`, `valueDate`), правила сущности (`validate`, `normalize`, `same`), цели с подтверждением (`confirmTargets`), порты `saveEditFx`/`accountsFx`. Модель получает **нормализованное** текущее значение (иначе только что открытый редактор «грязный»), а в `was` запроса уходит значение **как его прислал бек** — бек сверяет его со своим (иначе `409` на строчных буквах и пробелах). Справочники счетов — `$accounts` по `` `${id}:${side}` ``, грузятся при открытии правки счёта, живут до ухода с экрана. Наружу — `docEdited({ id, detail })`, `conflict({ id })`, `$savedCount`, `$unsaved` (отказ, которому негде показаться строкой: ↺ или редактор этого ключа уже закрыт уходом) |
| `features/doc-edit` — `useEditContexts(edit, commitView)` | функция `(docId) => EditContext` для `DocDetail`: состояние редактора и `Prompt` видит только документ, которому они принадлежат; объявления в живую область — «Изменения сохранены» и «Изменения не сохранены: {текст отказа}» |
| `entities/fx-doc` | что правится (`fxEditableTargets` — по профилю, поле 56 у MT103 — только заполненное или уже с правками; заблокированный документ — ничего), правила и тексты ошибок (`validateFxEdit` — дословно эталона), нормализация (`normalizeFxEdit`), виды правки на компонентах кита (`FieldEditor`, `SuggestInput`, `DateInput`, `EditMark`, `EditHistory`, `Prompt`) |
| `widgets/doc-detail` | деталка о правке не знает: получает `editOf` и отдаёт `EditContext` видам домена; при `guard: true` закрытие и замену документа в слоте сначала сообщает (`leaveRequested`), выполняет — по `leave`; `replaceDetail`/`reloadDetail` |

### 14.2. Сборка на странице

Модель правки — отдельный модуль страницы на том же `lifecycle`, что реестр и деталка (`apps/pi/src/pages/fx-docs/model/edit.model.ts`):

```ts
import { sample } from 'effector'
import { FX_CONFIRM_TARGETS, fxEditPorts, normalizeFxEdit, sameEditValue, validateFxEdit } from '../../../entities/fx-doc'
import { createDocEdit, editScope } from '../../../features/doc-edit'
import { detail, lifecycle, registry } from './registry.model'

export const docEdit = createDocEdit({
  ports: fxEditPorts,
  validate: validateFxEdit,
  normalize: normalizeFxEdit,
  same: sameEditValue,
  confirmTargets: FX_CONFIRM_TARGETS,
  lifecycle,
})

// охрана ухода деталки (guard: true): решает модель правки — черновик держит Prompt «Отменить правку?», чистый и в полёте — сразу
sample({ clock: detail.leaveRequested, fn: ({ docId, intent }) => ({ scope: editScope(docId), next: intent }), target: docEdit.model.requestLeave })
sample({ clock: docEdit.model.leave, target: detail.leave })
// бек принял правку: деталь ответа — в кэш без запроса детали; реестр — заново (строка могла измениться)
sample({ clock: docEdit.docEdited, target: detail.replaceDetail })
sample({ clock: docEdit.docEdited, target: registry.refreshRequested })
// 409: документ изменили — деталь перезапрашивается, редактор с черновиком остаётся
sample({ clock: docEdit.conflict, fn: ({ id }) => id, target: detail.reloadDetail })
// документ пришёл заблокированным (перезапрос по 409) — только просмотр: редактор закрывается
sample({
  source: { slots: detail.$slots, editing: docEdit.model.$editing },
  filter: ({ slots, editing }) => editing !== null
    && [slots.a, slots.b].some((s) => s !== null && s.data !== null && s.data.lock !== null && editing.key.startsWith(editScope(s.id))),
  target: docEdit.model.cancel,
})
```

В `registry.model.ts` деталка создаётся с охраной ухода — `createDetail({ detailFx: fxDocPorts.detailFx, tabFx: fxDocPorts.tabFx, localTabs: FX_LOCAL_TABS, lifecycle, guard: true })`. **С `guard: true` без связей `leaveRequested → requestLeave` и `leave → detail.leave` деталка не закрывается вовсе** — «×», Esc и замена документа только сообщают о намерении. Если правка вам не нужна, оставьте `createDetail` без `guard` (как у рубля).

Экран передаёт контексты правки деталке (`apps/pi/src/pages/fx-docs/ui/FxDocsPage.tsx`, к примеру раздела 13.2 добавляются три импорта, вызов хука и проп `editOf`):

```tsx
import { fxCommitView } from '../../../entities/fx-doc'
import { useEditContexts } from '../../../features/doc-edit'
import { docEdit } from '../model/edit.model'

// внутри FxDocsPage:
const editOf = useEditContexts(docEdit, fxCommitView)
// …
<DocDetail detail={detail} domain={fxDetailDomain} rowOf={…} returnFocus={…} editOf={editOf} />
```

Домен страницы (`fxDetailDomain`, раздел 13.2) менять не нужно: `fxDocDetailDomain` сущности уже несёт `formEdit` и виды правки в `renderHero`/`renderBlock`. Без `editOf` деталка — только просмотр, как в 2b.

### 14.3. Поведение

- Заблокированный документ (`lock` в детали; в реестре — «открыть только для просмотра») — только просмотр: ни карандашей, ни ↺, ни редакторов; маркеры «изменено» и аудит видны. Бек правку такого документа отклоняет (`400`, `path: target`).
- Карандаш — у правимых полей при наведении на строку и по фокусу с клавиатуры (`:focus-visible`); имена «Редактировать поле {tag}» (с `B.` у последовательности B), «Изменить 20 исх», «Изменить счёт Дт» / «Изменить счёт Кт», «Изменить дату валютирования».
- Редактор поля — «Как есть» (исходное с бека) и «Редактирование» (текущее), на всю ширину сетки под строкой поля; фокус — в первое поле; валидация на лету, «Сохранить» недоступна при ошибке. Один редактор на экран: открытие другого при грязном черновике — `Prompt` «Отменить правку?».
- Esc в любом месте редактора — «Отмена» (черновик сбрасывается без вопроса), деталка открыта; Esc во время сохранения поглощается. Клик вне редактора поля его не закрывает. 20 исх — Enter сохраняет, Esc отменяет. Счёт — только из списка подсказки: Tab в строку состояния («Повторить» при отказе справочника), Esc, Tab за последним и клик вне поля со строкой подсказки и списка — отмена; список открывается под строкой подсказки; выбор во время сохранения игнорируется. Клик по `Prompt` правку не отменяет — решают его кнопки.
- Сохранение: «стало = текущее» — редактор закрывается без запроса; ↺ — правка «стало = исходное» с аудитом; дата валютирования — сначала `Prompt` «Утвердить новую дату валютирования?» («Отмена» оставляет правку с выбранной датой).
- После сохранения — деталь из ответа, вкладки документа сброшены, реестр перезапрошен, «Изменения сохранены» в живую область; поле не раскрывается само (аудит — по раскрытию строки). Ошибка — строкой под редактором (`400` — `errors[0].message` бека как есть; в редакторе поля подсвечены только виноватые строки и счёт — `FieldEditor.invalid`), «Сохранить» = повтор; `409` — «Документ изменили — откройте заново» и перезапрос детали. Отказ ↺ и отказ сохранения, когда редактор уже закрыт уходом, — объявлением «Изменения не сохранены: …».
- Уход из документа с грязным черновиком («×», Esc, сдвиг B→A, другой документ в слоте) — `Prompt` «Отменить правку?» в drawer'е документа: «Продолжить правку» — остаёмся, «Отменить правку» — уходим. Уход во время сохранения и уход с экрана (`pageClosed`) — без вопроса.

### 14.4. Бек отдаёт правку иначе

- **Другие адреса** правки или счетов — по строке `url` в `apps/pi/src/shared/api/edit-ports.ts` (`createEditPorts`).
- **Другая форма `edits` в детали** — правится только маппер `parseEdits` в `entities/fx-doc/api/detail.mapper.ts`; он обязан вернуть `Record<string, FxEdit>` (`model/edit.ts`). После правки обновите `edits` в `api/detail.example.ts` — на нём гоняется `detail.mapper.test.ts`.
- **Другой ответ счетов** — `fromAccountsResponse` в `edit-ports.ts`.
- **Другие правила** (набор, длины, референс) — `entities/fx-doc/model/rules.ts`; правила фронта и бека должны совпадать, иначе пользователь увидит ошибку только после «Сохранить». Тексты ошибок бека фронт показывает дословно (`pi-api.md` §1.7).
- **Другой набор правимого** — `editable` в `FX_FIELDS` (`model/swift.ts`) и `fxEditableTargets` (`model/rules.ts`); подсветка виноватых строк — `swiftFieldInvalid` там же (держите её в согласии с `validateSwiftField`).

### 14.5. Как проверить

- **Контрактный тест правки против своего бека.** Блок `describe('контракт правки fx-docs (план 2c) …')` в `apps/pi/src/app/fake/contract.test.ts` — скопируйте его, как блоки детали (раздел 13.6), и подставьте свой обработчик. Против бека держите: `saveEditFx` возвращает деталь, которую разбирает маппер, с новым значением и записью в `edits`; `accKt` — запись `edits.route` от «система» и новые поля маршрута; ↺ `accKt` — исходный маршрут, история сохранена; `valueDate` — запись сразу `confirmed`, `by` = `who`; `accountsFx` для `kt` и `dt` разбирается, неверный `side` — `400`; у рубля — `404`. Специфичны для фейка и уберите: сид поля 57 (документ и тексты записей), состав справочников `CLIENT_ACCOUNTS`/`BANK_ACCOUNTS`, «следующий по кругу» маршрут, `who: 'Вы'`. Ответы `409`, `400` и регуляторы проверяет `apps/pi/src/app/fake/server.test.ts` («фейковый сервер: правка детали») — это тесты фейка, у вас — свои на `409` и `400` бека.
- **Правила и модели** — `entities/fx-doc/model/rules.test.ts`, `features/doc-edit/model/createDocEdit.test.ts`, `features/doc-edit/ui/useEditContexts.test.tsx`, `pages/fx-docs/model/registry.model.test.ts` (связи страницы, охрана ухода), `entities/fx-doc/ui/edit.test.tsx` — переезжают вместе со слайсами.
- **e2e правки** — `apps/pi/e2e/detail-edit.spec.ts`: геометрия против эталона ± 2, поле 57 (ошибка набора, сохранение, маркер, реестр перезапрошен), 20 исх, счёт Кт и маршрут, дата с `Prompt`, грязный черновик и уход (в т. ч. клик по кнопкам `Prompt` при правке 20 исх), `409` и отказ сохранения, заблокированный документ без карандашей (третья запись фейка, № 811306), у рубля карандашей нет. Как есть не заработает: завязан на данные фейка (сид правки поля 57 у второй записи реестра, MT202 в CNY; подсказка и 20 исх — первая запись, MT199 в USD; маршрут — первая запись USD типа MT103/MT202), регуляторы `?slow=N`, `?conflict=edit`, `?fail=edit` и счёт запросов через событие окна `k-fake-request` — фейк живёт в странице, и сеть его запросов не видит (`browserFakeOptions.observe`, `app/fake/params.ts`). С вашим беком считайте запросы обычным `page.on('request')`.
- **Регуляторы фейка** (только стенд, `apps/pi/README.md`): `?fail=edit` — `500` на сохранении, `?fail=accounts` — `500` на справочнике счетов, `?conflict=edit` — `409` на любой правке. Правки фейка — в памяти страницы до перезагрузки, строки реестра они не меняют. Поля 50, 59, 70 у данных фейка — кириллицей: редактор этих полей открывается сразу с ошибкой набора — это данные стенда, не дефект.

### 14.6. Правка в другом реестре

Рубль в 2c — только просмотр; когда правка понадобится другому реестру (рублю или вашему), шаги те же, что у валюты. Порядок:

1. **Порты** — `createEditPorts({ gridId, parseDetail })` из `shared/api` в `api/ports.ts` сущности (как `fxEditPorts`): `saveEditFx` (`POST …/documents/{id}/edits`, ответ — деталь тем же парсером, что у `detailFx`) и `accountsFx` (`GET …/documents/{id}/accounts?side=`).
2. **Правки в детали** — поле `edits` в типе детали и его разбор в маппере (по образцу `parseEdits` в `entities/fx-doc/api/detail.mapper.ts`), пример с правкой — в `api/detail.example.ts`; помощники `currentOf`/`originalOf`/`isChanged` — по образцу `entities/fx-doc/model/edit.ts`.
3. **Правила сущности** — `validate(target, v)`, `normalize(target, v)`, `same(a, b)`, `confirmTargets` (по образцу `entities/fx-doc/model/rules.ts`) и список правимого (`…EditableTargets`, им же бек проверяет цель). **Без своего `same`** модель сравнивает JSON и чувствительна к порядку ключей: только что открытый редактор окажется «грязным», и уход спросит «Отменить правку?» без правки.
4. **Виды** — `formEdit(d, edit)` домена для `ConfigForm` (по образцу `fxFormEdit`) и третий параметр `edit` у `renderHero`/`renderBlock`: виды строятся на `EditContext` (`shared/lib/detail`) — `editing`, `draft`, `error`, `saving`, `saveError`, команды `open`/`change`/`cancel`/`save`/`revert`, справочники `accounts(side)`/`retryAccounts(side)`. Тексты подсказки счетов («Только из карточки клиента · …», «Счёт не из списка …») — в `entities/fx-doc/ui/edit.tsx` (`SIDE`), у другой сущности — свои.
5. **`commitView` для `useEditContexts`** — `(target, was, now) => EditConfirmView`: текст `Prompt` подтверждения перед запросом (у валюты — `fxCommitView`, «было → стало» элементами `PromptChange`). Без целей подтверждения (`confirmTargets: []`) он не вызывается — передайте функцию, возвращающую общий вид, например `() => ({ title: 'Подтвердите действие', okLabel: 'Подтвердить', cancelLabel: 'Отмена', tone: 'neutral' })`.
6. **Модель страницы** — `pages/<экран>/model/edit.model.ts` по образцу раздела 14.2 (связи `leaveRequested`/`leave`, `docEdited`, `conflict`, закрытие редактора у заблокированного документа) и `createDetail({ …, guard: true })`; `editOf={useEditContexts(docEdit, commitView)}` в `DocDetail`.
7. **Бек (или фейк стенда)** — `…/edits` и `…/accounts` по `docs/reference/pi-api.md` §1.7, §1.8, правки в детали — §7.6; у фейка — хранилище `createFxEditStore` (`app/fake/edits.ts`) с правилами сущности.

Оговорки:

- **Заблокированный документ — только просмотр** (Д66): список правимого у документа с `lock` — пустой (бек отклоняет правку), виды не рисуют карандаши, ↺ и редакторы (маркеры и аудит остаются), модель страницы закрывает редактор, если документ пришёл заблокированным.
- **Справочник счетов** `$accounts` грузится только для целей `accDt`/`accKt` (`sideOf` в `features/doc-edit/model/createDocEdit.ts`); другие имена целей счетов справочник не запросят.
- **Прокрутка drawer'а** с 2c — во внутренней части `[data-part="scroll"]`, не в корне (`CHANGELOG.md`, срез 2c): стили и скрипты, прокручивающие деталку, переносите туда.

## 15. Действия лейна и «вторая рука» (срез 2d)

Кнопки лейна деталки делают настоящую работу, а чужую правку можно утвердить или отклонить. Лейн — шесть действий: «Обновить» (и F5), «Создать служебный документ», «Скачать» (SWIFT-сообщение у валюты, сообщение ED XML у рубля), «Печать» (меню форм), «Скопировать ссылку на документ», «Аннулировать»; «Редактировать» убран — правка идёт карандашами. «Создать служебный документ» и «Аннулировать» остаются заглушками с `announce` до среза 2e. «Вторая рука» — у цели правки, где бек вернул `canConfirm`: «Утвердить» и «Отклонить» (с обязательной причиной до 140 символов). Спека — `docs/superpowers/specs/2026-10-07-katran-lane-actions-design.md` (уточнения исполнения — её §9); эндпоинты для бека — `docs/reference/pi-api.md` §1.7 (решения `confirm`/`reject`), §1.9 (сообщение), §1.10 (печать), правки в детали с `canConfirm`/`reason` — §7.6; сверка с эталоном — `docs/reference/detail-drift.md`, раздел «2d».

### 15.0. Если деталка у вас уже перенесена

Срез 2d поменял и добавил файлы поверх разделов 13 и 14 (или перенесите изменения из `git log` ветки `feat/lane-actions`):

| Файл | Что поменялось |
|---|---|
| `shared/api/request.ts`, `index.ts` | `requestFileFx` — второй транспорт (файлы), `fileNameOf(header)` — имя из `Content-Disposition`; типы `FileRequest`, `FileResponse` |
| `shared/api/action-ports.ts` (новый) | `createActionPorts(gridId)` → `messageFx(id)` и `printFx({ id, form })` поверх `requestFileFx`; типы `ActionPorts`, `PrintQuery` |
| `shared/api/edit-ports.ts`, `guards.ts` | `confirmEditFx({ id, target, when })`, `rejectEditFx({ id, target, when, reason })` — ответ деталью тем же парсером; типы `DecisionQuery`, `RejectQuery`; охранник `bool` |
| `shared/lib/doc-link.ts` (новый) | `defaultDocLink`, `configureDocLinks({ build })`, `buildDocLink` — подмена ссылки хостом (15.3) |
| `shared/lib/detail/types.ts`, `index.ts` | `PrintFormItem` (`menu` действия — `{ label, form }[]`), `ActionsView`, `DecisionKind`/`DecisionState`; у `EditContext` — `decision`, `canDecide`, `confirmEdit`, `rejectEdit`, `changeReason`, `onDecision`; у `DetailDomain` — `decisionNote`, `decisionFocus`; `LeaveIntent` — вид `refresh`; из `ActionIcon` ушла `edit` |
| `entities/fx-doc/model/edit.ts`, `api/detail.mapper.ts`, `api/detail.example.ts` | `FxEdit.canConfirm`, `FxHistEntry.reason`, статус `rejected`; `parseEdits` читает `canConfirm` (не boolean — нарушение контракта с путём, нет ключа — `false`) |
| `entities/fx-doc/model/swift.ts`, `entities/rub-doc/model/profiles.ts` | из наборов действий ушло `edit`; пункты меню печати — `PrintFormItem` с кодами форм |
| `entities/fx-doc/ui/edit.tsx`, `edit.module.css`, `index.ts` | кнопки решения у 20 исх и счетов, маркер «отклонено», `fxDecisionNote` (тело `Prompt` решения), `fxDecisionFocus` (карандаш цели после решения); в аудите поля — кнопки решения у последней `pending` |
| `features/doc-actions/` (новая папка) | `createDocActions` — модель действий лейна, `useActionsOf` — виды по документам; эффекты `writeClipboardFx`, `saveFileFx`, `showInWindowFx`, `closeWindowFx`, `revokeUrlsFx`; тексты `LINK_COPIED_TEXT`, `PRINT_BLOCKED_TEXT`, `PRINT_PENDING_TEXT`, `ACTION_FAILED_TEXT` |
| `features/doc-edit/model/createDocEdit.ts`, `ui/useEditContexts.ts`, `index.ts` | `confirmRequested`, `rejectRequested`, `reasonChanged`, `decisionResult`, `$decision`, `$decided`; `useEditContexts` отдаёт виду `decision`/`canDecide` и объявляет `$decided`; `DECISION_TEXT`, `REJECT_MAX` |
| `widgets/doc-detail/lib/createDetail.ts`, `ui/DocDetail.tsx`, `ui/DocDetail.module.css` | `refreshDoc(id)`; проп `actionsOf`; F5 на корне drawer; запасное поле ссылки; `Prompt` решения с полем «Причина» |
| `pages/fx-docs/model/actions.model.ts`, `pages/rub-docs/model/actions.model.ts` (новые), `registry.model.ts`, `pages/fx-docs/model/edit.model.ts`, `ui/*Page.tsx`, `index.ts` | `docActions` страницы и её связи; событие `docLinkOpened`; `useActionsOf` и `actionsOf`; снятие открытого решения ушедшего документа |
| `app/routes.ts`, `app/transport.ts`, `app/fake/*` | чтение `?doc=` и `docLinkOpened` после `pageOpened`; подключение `requestFileFx` стенда; фейк — решения, чужие правки в сиде, сообщение, PDF, регуляторы `?fail=decide`, `?fail=message`, `?fail=print` |

**Кит нужен свежий** (пересобрать тарболы): `Prompt` (`children`, `okDisabled`, `busy`, `error`, `fallbackFocus`), `EditHistory` (`onConfirm`/`onReject`, `confirmLabel`/`rejectLabel`, `reason` в записи), `EditStatus` с `'rejected'` и `EditMark status="rejected"`, `Button` со стилем `[aria-disabled="true"]`, `Drawer.onKeyDown`; в `@katran/effector` изменений нет. Записи — `CHANGELOG.md`, раздел среза 2d.

### 15.1. Действия лейна

Четыре рабочих действия собирает `createDocActions` (`apps/pi/src/features/doc-actions/model/createDocActions.ts`); он не знает ни деталки, ни реестра — с ними его связывает страница.

| Действие | Событие модели | Что делает |
|---|---|---|
| «Обновить», F5 | `refreshRequested(docId)` → `refresh` | модель только объявляет намерение; страница решает, что обновлять (ниже) |
| «Скопировать ссылку» | `copyLink(docId)` | `buildDocLink(gridId, id)` → `navigator.clipboard.writeText`; успех — объявление «Ссылка скопирована»; буфера нет или отказ — `$linkFallback` / `$linkFallbackDoc`, виджет показывает поле только для чтения в drawer этого документа |
| «Скачать» | `download(docId)` | `messageFx(id)` → файл (`saveFileFx`: `<a download>`); имя — из `Content-Disposition`, иначе `fallbackName(id)` (`<номер>.txt` у валюты, `<номер>.xml` у рубля) |
| «Печать» → форма | `print({ id, form, win })` | `printFx` → PDF в окне `win` (`showInWindowFx`); `win === null` (вкладку заблокировали) — файл `<форма>-<номер>.pdf` и объявление «Браузер заблокировал вкладку — форма скачана»; ошибка — окно закрывается, объявление с текстом отказа; открытые адреса PDF освобождаются при `pageClosed` |

`$pending` (`{ [`${docId}:${actionId}`]: true }`, `actionId` — `link`, `down`, `print`) держит действие в полёте: повторный вызов игнорируется, кнопка — `aria-disabled="true"` и `aria-busy` (не `disabled`: Chromium снимает фокус с отключённой кнопки, и F5 деталки с клавиатурой терялись). Объявления идут через `$notice` (`{ count, text }`); текст отказа — `detail` Problem, иначе `message`, иначе `ACTION_FAILED_TEXT`.

**Окно печати открывает вид, не модель:** `useActionsOf` вызывает `window.open('', '_blank')` синхронно в обработчике клика, до любого `await` (иначе браузер блокирует вкладку), снимает `opener` и пишет «Формируется…»; окно уходит в `print` как `win`. Свой вид действий пишите так же.

Сборка на странице (`apps/pi/src/pages/rub-docs/model/actions.model.ts` — «Обновить» без охраны):

```ts
import { combine, sample } from 'effector'
import { createDocActions } from '../../../features/doc-actions'
import { createActionPorts } from '../../../shared/api'
import { detail, lifecycle, registry } from './registry.model'

export const rubActionPorts = createActionPorts('rub-docs')

// запасное имя файла сообщения — стор страницы: номер из строки реестра, иначе из детали в слотах, иначе id
const $fallbackName = combine(registry.grid.$rows, detail.$slots, (rows, { a, b }) => (id: string): string => {
  const row = rows.find((r) => r.id === id)
  const data = a?.id === id ? a.data : b?.id === id ? b.data : null
  return `${row ? row.docNumber : data ? data.docNumber : id}.xml`
})

export const docActions = createDocActions({ gridId: 'rub-docs', ports: rubActionPorts, lifecycle, fallbackName: $fallbackName })

// «Обновить»: модели правки у рубля нет — деталь документа и реестр заново
sample({ clock: docActions.refresh, target: detail.refreshDoc })
sample({ clock: docActions.refresh, target: registry.refreshRequested })
```

У валюты `refresh` **не связывается**: «Обновить» идёт через охрану правки — `docActions.refreshRequested` → `docEdit.model.requestLeave({ scope: editScope(id), next: { kind: 'refresh', id } })`; грязный черновик держит `Prompt` «Отменить правку?», чистый редактор закрывается без вопроса, и по `docEdit.model.leave` с `kind === 'refresh'` страница вызывает `detail.refreshDoc` и `registry.refreshRequested` (`apps/pi/src/pages/fx-docs/model/actions.model.ts`). Связка `leave → detail.leave` в `edit.model.ts` пропускает `refresh` (фильтр `intent.kind !== 'refresh'`) — деталка при «Обновить» не закрывается. Свяжете `refresh` напрямую — охрана будет обойдена. `detail.refreshDoc(id)` сбрасывает кэш и ошибки вкладок документа, перезапрашивает деталь (без скелетона) и активную нелокальную вкладку каждого слота с этим документом; ответы, ушедшие до обновления, кэш не трогают.

Экран: `useActionsOf(docActions)` вызывается **один раз на модель** (на странице; второй вызов продублирует объявления `$notice`) и отдаётся деталке:

```tsx
import { useActionsOf } from '../../../features/doc-actions'
import { docActions } from '../model/actions.model'

// внутри страницы:
const actionsOf = useActionsOf(docActions)
// …
<DocDetail detail={detail} domain={rubDetailDomain} rowOf={…} returnFocus={…} actionsOf={actionsOf} />
```

`DocDetail` вызывает `actionsOf(docId)` и получает `ActionsView` (`run`, `pending`, `linkFallback`, `closeLinkFallback`); «Создать служебный документ» и «Аннулировать» (`esid`, `ban`) остаются объявлением-заглушкой. Без `actionsOf` все действия — заглушки, как в 2a (демо кита). F5 — `keydown` на корне drawer: «Обновить» только при чистом F5 (без Ctrl/Alt/Shift/Meta), не из поля ввода, без открытого редактора и `Prompt` документа; иначе браузер ведёт себя как обычно.

Коды печатных форм — в пунктах меню действия `print` профиля (`PrintFormItem`, `entities/fx-doc/model/swift.ts`: `payment-order`, `memorial-order`, `swift-form`; `entities/rub-doc/model/profiles.ts`: `payment-order`, `collection-order`, `payment-ordr`, `memorial-order`). Настоящие коды — у бека: поменяйте `form` в пунктах, отдельного словаря нет.

### 15.2. Утверждение и отклонение чужой правки

- **Контракт.** У цели в `edits` детали — `canConfirm: boolean` (ставит бек: последняя запись `pending`, автор не текущий пользователь, есть право); у записи истории — статус `rejected` и `reason`. Фронт текущего пользователя не знает. Решения — `POST …/documents/{id}/edits/{target}/confirm` (тело `{ when }`) и `…/reject` (тело `{ when, reason }`), ответ — деталь целиком; ошибки `400`/`403`/`404`/`409`/`5xx` — `pi-api.md` §1.7. Другие адреса — в `createEditPorts` (`shared/api/edit-ports.ts`).
- **Модель** — `createDocEdit` (`features/doc-edit`): `confirmRequested({ docId, target, when })`, `rejectRequested(…)` открывают `Prompt` решения; `reasonChanged({ docId, text })`; `decisionResult({ docId, ok })` — `true` отправляет запрос (у отклонения — только с непустой после `trim` причиной), `false` закрывает (при запросе в полёте оба игнорируются). `$decision: Record<docId, DecisionState>` с `busy` и `error`; решение не начинается при открытом редакторе документа, сохранении в полёте и уже открытом решении документа. Успех — тот же `docEdited({ id, detail })`, что у сохранения (страница кладёт деталь в кэш и перезапрашивает реестр — связи из 14.2 работают без изменений); `409` — `Prompt` закрывается, деталь перезапрашивается, объявление «Правку уже обработали — данные обновлены». `$decided` (`{ count, text }`) растёт на успехе и на `409`; тексты — `DECISION_TEXT`. Ответ прошлого визита экрана отбрасывается.
- **Одна связь на странице сверх 14.2** — открытое (не в полёте) решение документа, ушедшего из слотов не уходом с экрана, снимается (`apps/pi/src/pages/fx-docs/model/edit.model.ts`: слежение за `detail.$slots` и `decisionResult({ docId, ok: false })`); решение в полёте снимет его ответ. Без неё при повторном открытии документа всплыл бы старый `Prompt`.
- **Виды.** `useEditContexts` отдаёт виду `EditContext` с `decision`, `canDecide(target, canConfirm)`, `confirmEdit`, `rejectEdit`, `changeReason`, `onDecision` и объявляет `$decided`. Тело `Prompt` (цель, «Было → Стало», автор и время) — `decisionNote` домена (`fxDecisionNote`), фокус после решения — `decisionFocus` (`fxDecisionFocus`: карандаш цели; нет — заголовок drawer). Оба — в домене страницы: `{ ...fxDocDetailDomain, tabViews, decisionNote: fxDecisionNote, decisionFocus: fxDecisionFocus }` (`pages/fx-docs/ui/detailDomain.ts`). Без `decisionNote` `Prompt` решения открывается без тела.
- **Где кнопки.** У полей сетки — в сводке блока аудита раскрытой строки; у 20 исх, счетов Дт/Кт — рядом с маркером «изменено» (блока истории у этих целей нет). Пока у документа открыт редактор или идёт сохранение, кнопок нет; пока открыт `Prompt` решения, карандаши и ↺ документа не действуют (одна операция за раз). У даты валютирования и маршрута `canConfirm` всегда `false`. После отклонения у 20 исх и счетов остаётся маркер «отклонено» с причиной в подсказке.
- **Поле «Причина»** — в виджете (`DecisionPrompt` в `widgets/doc-detail/ui/DocDetail.tsx`): обязательное, счётчик `n/140`; «Отклонить» недоступна, пока причина пуста. Длина 140 — `REJECT_MAX` (`features/doc-edit`); виджет `features` не импортирует и держит свою константу `REASON_MAX` — меняйте обе, и лимит бека.
- **Другая форма** `canConfirm`/`reason` в детали — только `parseEdits` в `entities/fx-doc/api/detail.mapper.ts` (после правки обновите `api/detail.example.ts`); тексты решений — `DECISION_TEXT` и `Prompt` в `DocDetail.tsx`, `entities/fx-doc/ui/edit.tsx`.

### 15.3. Ссылка на документ и подключение хоста

Ссылка — параметр `?doc=<id>` в хвосте hash: `#/fx-docs?doc=<id>`. Копирует её `copyLink`; открывает деталь в слоте A страница по событию `docLinkOpened(id)` (`pages/fx-docs/model/registry.model.ts`, `pages/rub-docs/model/registry.model.ts`, экспорт из `pages/*/index.ts`). Открытие — как действие пользователя (фокус в drawer), документ открывается даже без своей строки на странице реестра; нет документа — состояние ошибки детали. Первая запись реестра в этом визите после ссылки не открывается и документ из ссылки не вытесняет. Событие не действует на закрытом экране.

Что делает хост — два места:

1. **Построение ссылки.** По умолчанию — `defaultDocLink(gridId, id)` (`shared/lib/doc-link.ts`): `${location.origin}${location.pathname}#/${gridId}?doc=${encodeURIComponent(id)}`. Под свою маршрутизацию подмените строитель **один раз, рядом с подключением транспорта** (у нас — `apps/pi/src/app/transport.ts`, там же комментарий-образец):

   ```ts
   import { configureDocLinks } from '../shared/lib/doc-link'

   configureDocLinks({ build: (gridId, id) => `${hostOrigin}/pi/${gridId}?doc=${encodeURIComponent(id)}` })
   ```

   Строитель читается в момент копирования (`buildDocLink`), поэтому подмена действует и на модели, созданные раньше. Страницы слой `app` не импортируют (FSD) — отсюда отдельный модуль в `shared/lib`.
2. **Разбор ссылки.** Роутер хоста, прочитав `doc` из своего адреса, вызывает `docLinkOpened(id)` **после** `pageOpened` экрана: до `pageOpened` экран закрыт и событие игнорируется. Образец — `startRouting` в `apps/pi/src/app/routes.ts` (`parseDocParam` читает `doc` из хвоста hash; на входе на экран — `pageOpened`, затем `docLinkOpened`):

   ```ts
   import { docLinkOpened, lifecycle } from '../pages/fx-docs'

   // на входе на экран:
   lifecycle.pageOpened()
   if (docFromAddress !== null) docLinkOpened(docFromAddress)
   ```

   `doc` из адреса после открытия не стирается. Ограничение роутера стенда: он открывает документ по смене значения `doc` на том же экране, поэтому повторная вставка **той же** ссылки `?doc=` после открытия другого документа его не откроет; у хоста с другой маршрутизацией это решается по-своему.

Запасной путь: буфер обмена доступен только по https и в разрешённом контексте; без него (нет `navigator.clipboard`, отказ) виджет показывает поле только для чтения с выделенной ссылкой и подсказкой «Скопируйте ссылку: Ctrl+C»; «Закрыть» возвращает фокус на кнопку лейна.

### 15.4. Файловый транспорт

Сообщение и печатная форма — файлы, поэтому у них свой эффект рядом с `requestFx` (`apps/pi/src/shared/api/request.ts`):

```ts
export type FileRequest = { url: string }
export type FileResponse = { blob: Blob; name: string | null }
export const requestFileFx = createEffect<FileRequest, FileResponse, ApiError>(...)
```

По умолчанию он бросает `ApiError` «Транспорт файлов не подключён: вызовите requestFileFx.use(…) в слое app». Подключите обработчик там же, где `requestFx` (у нас — `apps/pi/src/app/transport.ts`: `requestFileFx.use(createFakeFileServer(…))`):

```ts
import { fileNameOf, requestFileFx, toApiError } from '../shared/api'

requestFileFx.use(async ({ url }) => {
  const res = await fetch(`${API}${url}`, { headers: { Authorization: token() } }) // ваша авторизация
  if (!res.ok) {
    const type = res.headers.get('Content-Type') ?? ''
    const body = type.includes('json') ? await res.json().catch(() => null) : null
    throw toApiError(res.status, body)
  }
  return { blob: await res.blob(), name: fileNameOf(res.headers.get('Content-Disposition')) }
})
```

Правила обработчика: запрос — всегда `GET` по `url` контракта; 2xx → `{ blob, name }`, где `name` — результат `fileNameOf` (имя из `Content-Disposition`: `filename*=UTF-8''…` приоритетнее `filename="…"`; нет заголовка или транспорт его не видит — `null`, тогда фронт назовёт файл сам); не 2xx → отказ значением `toApiError(status, body)`, тело читается как JSON, если `Content-Type` — `application/problem+json` или `application/json` (иначе `null`). Если ваш транспорт не отдаёт заголовок ответа (CORS без `Access-Control-Expose-Headers: Content-Disposition`), имя будет запасным — `<номер>.txt`, `<номер>.xml` или `<форма>-<номер>.pdf`.

### 15.5. Бек отдаёт иначе, как проверить

- **Другие адреса** сообщения и печати — `url` в `createActionPorts` (`shared/api/action-ports.ts`), решений — в `createEditPorts` (`shared/api/edit-ports.ts`); `target` в пути решений кодируется (`encodeURIComponent`, `field%3AB.57`).
- **Контрактные тесты против своего бека** — блоки `describe` в `apps/pi/src/app/fake/contract.test.ts` (решения `confirm`/`reject` со всеми ошибками, сообщение, печать) и `app/fake/files.test.ts` (файловый сервер); скопируйте и подставьте свой обработчик, как в разделе 7. Специфичны для фейка и уберите: сид чужих правок (поле 57 второго документа, `accKt` у второго MT103 в USD), текст MT и содержимое PDF.
- **Юнит-тесты слайсов** переезжают вместе с ними: `features/doc-actions/model/createDocActions.test.ts`, `features/doc-actions/ui/useActionsOf.test.tsx`, `features/doc-edit/model/createDocEdit.test.ts`, `shared/lib/doc-link.test.ts`, `shared/api/request.test.ts`, `pages/fx-docs/model/actions.model.test.ts`, `pages/rub-docs/model/actions.model.test.ts`, `app/routes.test.ts`.
- **e2e** — `apps/pi/e2e/lane-actions.spec.ts` (утверждение и отклонение, скачивание, печать в новой вкладке, F5, ссылка, запасное поле) и лейн из шести кнопок в `detail.spec.ts`; завязаны на данные фейка и порт 5186, как остальные спеки.
- **Регуляторы фейка** (только стенд): `?fail=decide` — `500` на решении правки, `?fail=message` — `500` на сообщении, `?fail=print` — `500` на печатной форме (`apps/pi/README.md`).

## Зависимости

Версии — как в `apps/pi/package.json`; переносимые слайсы (`pages`/`widgets`/`features`/`entities`/`shared`) ставят те же пакеты и версии в вашем приложении:

| Пакет | Версия | Кто именно |
|---|---|---|
| `react`, `react-dom` | `17.0.2` | среда выполнения (раздел «Среда выполнения» выше); peer-зависимость `@katran/ui` и `@katran/effector` — `>=17` |
| `effector` | `^23.4.4` | peer-зависимость `@katran/effector` — `>=23` |
| `effector-react` | `^23.3.0` | `useUnit` — вызывается напрямую в `widgets/doc-registry/ui/DocRegistry.tsx`, `widgets/doc-detail/ui/DocDetail.tsx` и в страницах (не только внутри `@katran/effector`); peer-зависимость `@katran/effector` — `>=23` |
| `@katran/ui` | `workspace:*` (в вашем приложении — версия из `docs/consuming.md`, «Установка») | компоненты (`KatranProvider`, `DataGrid`, `FilterPanel`, `Drawer`, `ConfigForm` и т. д.); `entities/*/ui`, `widgets/doc-registry/ui`, `widgets/doc-detail/ui`, страницы (`gridFocusTarget`) |
| `@katran/effector` | `workspace:*` | `createFiltersModel`, `createGridModel`, персист-адаптеры — используются внутри `widgets/doc-registry/lib/createRegistry.ts`; `createDrawerStackModel` — внутри `widgets/doc-detail/lib/createDetail.ts`; `createEditModel` — внутри `features/doc-edit/model/createDocEdit.ts` |
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
| `@playwright/test` | `^1.63.0` | e2e на production-сборке (`apps/pi/e2e/*.spec.ts`, в том числе сценарии деталки `detail.spec.ts`, раздел 13.6) — только если переносите e2e; не часть `pnpm test` |

`createRegistry` (раздел 3 и «FSD-специфика» выше) — **не** экспорт `@katran/effector`, это местная фабрика `apps/pi/src/widgets/doc-registry/lib/createRegistry.ts`, которая сама вызывает `createFiltersModel`/`createGridModel` кита внутри себя; переносится вместе со слайсом `widgets/doc-registry`, а не устанавливается из npm.
