# Прикладное приложение `apps/pi`: реестры ПИ на FSD с переносимым швом данных

Дата: 2026-09-28. Статус: согласовано с владельцем по разделам (27–28.09: единица переноса — оба пути; объём — валютный и рублёвый реестры; код в монорепо katran; шов — вариант B, транспорт; две сущности; документ по использованию в составе среза). Дополняет основную спеку `2026-09-23-katran-design.md`: разделы 3, 10 и 11 там правятся синхронно с этим документом. Рекомендация потребителям — `docs/guides/effector-fsd.md`.

## 1. Зачем

Внутри используется effector. Поведение стенда `pi-constructor` должно переехать внутрь с минимальными допилами — в идеале только подключением к своему транспорту. Стенд — ванильный JS (`window.PI`, `build.py`, без effector), напрямую он не переносится. Переносится его поведение, собранное на katran, и код экранов должен с первого дня выглядеть так, будто он уже лежит в `src/` внутреннего приложения.

Единица переноса пока не известна, оба пути должны оставаться возможными:

1. **Слайсы.** Внутри копируют `pages`/`widgets`/`entities`/`shared` в свой `src` и подключают транспорт и роутер.
2. **Готовый remote.** Внутри берут `apps/pi` целиком как remote Module Federation, подменяют транспорт и регистрируют remote в хосте.

Кит остаётся библиотекой: прикладной код ПИ живёт не в пакетах, а в отдельном приложении монорепо.

## 2. Что поставляем

- `apps/pi` — приложение на Vite, разложенное по FSD, с двумя экранами: «Валютные документы» и «Рублёвые документы».
- Шов данных: транспорт `requestFx` плюс порты сущностей с мапперами на контракт `vtb-filters`; фейковый сервер, говорящий на этом контракте.
- Две правки кита, совместимые назад: загружаемый каталог фильтров и длина хвоста сокращённого счёта.
- Заморозка рублёвого реестра стенда и сверка с ним.
- Документы: использование для команды, API для бекенда, README приложения; обновление `effector-fsd.md`.

Экран «Валютные документы», `apps/demo/src/data/` и e2e-замер геометрии переезжают из `apps/demo` в `apps/pi`. Демо остаётся витриной компонентов; в меню демо — ссылка «Реестры ПИ».

Вне среза: деталка (срез 2, строится уже в `apps/pi`), настоящие массовые действия и их `features/*` (появляются вместе с эндпоинтами), advanced-фильтры и группы каталога (срез 1f), серверная раскладка `PUT /filter-layout`, наборы фильтров, сборка `apps/pi` как remote (в документе — заготовка).

## 3. Предусловия

- **План 4 «Совместимость» исполнен**: сборка под React 17 и `chrome88`, dist пакетов. `apps/pi` собирается тем же конвейером.
- **План 5 «Реестр по эталону» исполнен**: многоуровневая сортировка S1 меняет `GridQuery.sort` на массив уровней, сокращение счёта F3 — на 8…4. Маппер `search` пишется сразу под массив уровней; рублёвый реестр опирается на параметр хвоста из раздела 6.2.

## 4. Раскладка `apps/pi`

```txt
apps/pi/src/
  app/
    entry.tsx              # createRoot + KatranProvider; только Vite и Pages
    routes.ts              # hash-роутер: #/fx-docs, #/rub-docs → pageOpened/pageClosed страниц
    transport.ts           # requestFx.use(fakeServer) — единственная строка, которую меняют внутри
    fake/
      server.ts            # обработчик requestFx: разбор маршрута, JSON на входе и выходе
      fx-docs.data.ts      # детерминированные вымышленные записи
      rub-docs.data.ts
  pages/
    fx-docs/   index.ts · model/registry.model.ts · ui/FxDocsPage.tsx
    rub-docs/  index.ts · model/registry.model.ts · ui/RubDocsPage.tsx
  widgets/
    doc-registry/  index.ts · lib/createRegistry.ts · ui/DocRegistry.tsx
  entities/
    doc-status/  index.ts · model/status.ts
    fx-doc/      index.ts · model/ · api/ · ui/
    rub-doc/     index.ts · model/ · api/ · ui/
  shared/
    api/            request.ts · problem.ts
    lib/lifecycle/  createPageLifecycle.ts
```

- **Граница переноса.** `pages`, `widgets`, `entities`, `shared` переезжают без правок. `app/` наш и выбрасывается: у команды свой `app`, куда переносятся одна строка транспорта и адаптер роутера. Для пути «remote» `app/` дополняется `bootstrap` для Module Federation — в срезе только описание в документе использования (раздел 9).
- **Жизненный цикл экрана.** `createPageLifecycle()` (`shared/lib/lifecycle`) отдаёт `pageOpened`, `pageClosed`, `$opened`. Роутер вызывает только их; ни одна модель не знает о роутере.
- **Границы слоёв — eslint** (`import-x/no-restricted-paths` в существующем `eslint.config.js`): слой импортирует только нижележащие слои; чужой слайс — только через его `index.ts`; соседние слайсы одного слоя друг друга не импортируют. Steiger не подключается: второй инструмент ради тех же правил не нужен.
- **Сборка и витрина.** Vite; GitHub Pages по адресу `/katran/pi/` — тот же `pages.yml`, второй артефакт в каталоге публикации.

## 5. Шов данных

### 5.1. Транспорт (`shared/api`)

```ts
export type HttpRequest = { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; url: string; query?: Record<string, string> | undefined; body?: unknown }
export class ApiError extends Error { status: number; problem: Problem | null }   // Problem — RFC 9457, контракт §8
export const requestFx: Effect<HttpRequest, unknown, ApiError>
export function toApiError(status: number, body: unknown): ApiError
```

- Правило обработчика: ответ 2xx — промис с разобранным JSON; иначе — отказ с `ApiError`, собранным `toApiError`. `message` — из `problem.title` и `problem.detail`, при их отсутствии — «Ошибка запроса (статус N)».
- `ApiError` — класс, наследник `Error`: `createGridModel` пишет в `$error` `e.message` только для `instanceof Error`, простой объект превратился бы в «[object Object]».
- Обработчик по умолчанию отказывает с `ApiError` «Транспорт не подключён: вызовите requestFx.use(…)» — вместо безымянной ошибки effector об отсутствии обработчика.
- Подключение: у нас `requestFx.use(fakeServer)` в `app/transport.ts`; внутри — `requestFx.use(свой клиент)`; в тестах — `fork({ handlers: [[requestFx, fakeServer]] })`.

### 5.2. Порты сущностей (`entities/fx-doc/api`, `entities/rub-doc/api`)

Порт — обычный `createEffect`, в обработчике вызывающий `requestFx` и маппящий данные в обе стороны (вызов эффекта из обработчика эффекта сохраняет scope в effector 23). Маппинг контракта грида (тело поиска, страница, фасеты, каталог) не зависит от домена и живёт в `shared/api/grid-contract.ts`; порты собирает фабрика `createGridPorts({ gridId, parseRow })` из `shared/api`. Сущность даёт только `gridId` и парсер строки. `gridId`: `fx-docs`, `rub-docs`.

| Порт | Запрос | Маппинг |
|---|---|---|
| `searchFx: Effect<GridQuery, GridPage<Row>, ApiError>` | `POST /grids/{gridId}/search` | `GridQuery` → тело §5.1 контракта: `filter.conditions`, `sort: [{ field, direction: 'ASC' \| 'DESC' }]` по уровням, `page: { number, size }`, `includeTotal: true`. Ответ: `content[]` → `parseRow`, `page.totalElements` → `total` |
| `facetsFx: Effect<FacetsQuery, Facet[], ApiError>` | `POST /grids/{gridId}/facets` | тело `{ filter: { conditions }, field }`, ответ `[{ value, count }]`. Эндпоинт — **предложение** в контракт (спека 1e, §4) |
| `filterMetaFx: Effect<void, FilterMeta, ApiError>` | `GET /grids/{gridId}/filter-meta` | DTO §6 контракта → `FilterMeta` кита |

- Сущность экспортирует порты одним объектом (`fxDocPorts`, `rubDocPorts`); мапперы наружу не отдаются.
- **Проверка формы ответа** — рукописные гарды (`parseFxDoc`, `parseRubDoc`, разбор страницы и каталога), без zod: меньше зависимостей в закрытом контуре. Несоответствие → `ApiError` со `status: 0` и `problem.type = 'urn:katran:contract'`, `detail` называет первое неверное поле. Грид показывает состояние ошибки, приложение не падает.
- **Имена полей строки бека неизвестны** (контракт не определяет состав `content[]`). Наш вариант — в `docs/reference/pi-api.md`; всё переименование держится в `api/*.mapper.ts`. Если бек отдаёт иначе, внутри правят только мапперы.
- **Farfetched** (если он внутри): порты оборачиваются как есть — `createQuery({ effect: searchFx })`; пример — в документе использования.

### 5.3. Фейковый сервер (`app/fake/server.ts`)

- Обработчик `requestFx`: принимает `HttpRequest`, отвечает JSON строго по контракту — те же тела и ответы, что у настоящего бека. Внутри — логика нынешнего `fakeBackend.ts` (фильтрация по семантике контракта §4.2, `sortRows` по уровням, фасеты).
- Проверка запроса по каталогу: неизвестное поле, недопустимый для типа оператор, размер страницы вне 1–500 → `400` в формате Problem Details с `errors[]` и кодами контракта §8 (`UNKNOWN_FIELD`, `OPERATOR_NOT_ALLOWED`, `PAGE_SIZE_OUT_OF_RANGE`). Неизвестный `gridId` → `404`.
- Регуляторы в адресе: `?slow=N` — задержка ровно N мс (есть); новый `?fail=search|facets|meta` — отказ `500` соответствующего запроса. Закрывает техдолг «демо без регуляторов для empty/error» (STATE §7).
- Сервер знает данные сущностей — это нормально: `app` — верхний слой.

## 6. Правки кита

### 6.1. Загружаемый каталог фильтров (`@katran/effector`)

`createFiltersModel({ meta })` сейчас принимает каталог только значением при создании (`meta: FilterMeta | null` в модели). Становится:

- `FiltersModelConfig.meta?: FilterMeta | Store<FilterMeta | null> | undefined`;
- модель отдаёт `$meta: Store<FilterMeta | null>` (значение оборачивается в стор); поле `meta` остаётся на переходный период с пометкой в JSDoc, `useFilters` отдаёт текущее значение `$meta`;
- пока каталога нет, `DocRegistry` вместо `FilterPanel` показывает недоступную кнопку «Фильтры» (`FilterPanel` в ките не меняется); лейн работает (поле лейна задано конфигом, каталог ему не нужен).

Существующие вызовы со значением работают без изменений.

### 6.2. Длина хвоста сокращённого счёта (`@katran/ui`)

После F3 (план 5) `shortAccount` даёт 8…4. Рублёвому реестру нужно 8…3 (эталон). Параметр `shortAccount(acc, tail = 4)` и проп `AccountValue.tail?: 3 | 4 | undefined`; по умолчанию — поведение F3. Если план 5 введёт такой параметр сам, пункт снимается.

## 7. Виджет реестра, страницы, модели

### 7.1. `createRegistry` (`widgets/doc-registry/lib`)

```ts
createRegistry<Row>({
  id: string,                                   // gridId и ключ persist
  layout: RecordLayout<Row>,
  ports: { searchFx, facetsFx, filterMetaFx },
  lifecycle: PageLifecycle,
}) → { filters: FiltersModel, grid: GridModel<Row>, lifecycle: PageLifecycle, $metaReady: Store<boolean>,
      openRequested: EventCallable<{ id: string; secondary: boolean }>, refreshRequested: EventCallable<void> }
```

Внутри:

- `createFiltersModel({ meta: $meta, laneField: 'status' })`, `$meta` наполняется из `filterMetaFx.doneData`;
- `createGridModel({ id, columns, $filter: filters.$conditions, fetchFx: searchFx, facets: { field: 'status', fetchFx: facetsFx }, persist: localStoragePersist('katran-pi'), rowKey })`;
- `pageOpened` → `grid.refresh`; `filterMetaFx` — только если каталог ещё не загружен (за сессию он не меняется). Отказ каталога не трогает грид и лейн; повтор — при следующем `pageOpened`;
- `pageClosed` → `grid.clearSelection`. Фильтры, сортировка и страница **сохраняются**: при возврате пользователь видит тот же срез реестра, обновлённый свежим запросом. Выделение снимается: массовое действие над невидимыми записями опасно;
- `refreshRequested` — шов внешних действий (например, аннулирование в деталке среза 2): перезапрос только пока экран открыт, гейт `lifecycle.$opened` (`effector-fsd.md`, раздел 4); закрыт — событие игнорируется, свежие данные придут при следующем `pageOpened`;
- `openRequested` — шов деталки среза 2; сейчас страница только объявляет открытие через `announce`, как в демо.

Фабрика вызывается на верхнем уровне модуля страницы:

```ts
// pages/fx-docs/model/registry.model.ts
export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'fx-docs', layout: fxDocLayout, ports: fxDocPorts, lifecycle })
```

### 7.2. `DocRegistry` (`widgets/doc-registry/ui`)

Пропы: `registry`, `layout`, `title`, `describe` (строка для объявления открытия), `note`, `bulkActions: { label, onClick(count) }[]`. Внутри `useGrid` и `useFilters`, заголовок со счётчиком, `StatusLane` (пункты — `laneItems` из `entities/doc-status`: статусы у обоих реестров общие), `FilterPanel`, `DataGrid` со слотом `toolbar`, `BulkBar`. Обучающий блок демо о сквозных строках в продуктовый экран не переносится. Всё переносится из нынешнего `GridPage` без изменения поведения: сверка валютного реестра с эталоном и e2e-замер остаются зелёными.

### 7.3. Страницы и сущности

- Страница (`pages/*/ui`) — около 20 строк: `<DocRegistry registry={registry} title="Валютные документы" … />`; массовые действия — заглушки с `announce`, как в демо.
- `entities/doc-status`: 9 статусов, `STATUS_LABEL`, `STATUS_TONE`, порядок лейна, `laneItems(facets, counted)`. Правило «до первого ответа фасетов чисел нет, дальше пропущенный статус — 0» переезжает сюда из компонента.
- `entities/fx-doc`: тип `FxDoc`, `fxDocLayout` (ячейки — из `ui/`), каталог simple (9 полей нынешнего `docsFilterMeta` — как пример формы; настоящий приходит с бека), порты, мапперы.

### 7.4. Публичные API

| Слайс | Экспорт |
|---|---|
| `entities/doc-status` | `Status`, `STATUSES`, `STATUS_LABEL`, `STATUS_TONE`, `laneItems`; для соседних сущностей — `@x/fx-doc`, `@x/rub-doc` |
| `entities/fx-doc` | `FxDoc`, `fxDocLayout`, `fxDocPorts` |
| `entities/rub-doc` | `RubDoc`, `rubDocLayout`, `rubDocPorts` |
| `widgets/doc-registry` | `createRegistry`, `DocRegistry`, типы `Registry`, `RegistryConfig`, `BulkAction` |
| `pages/fx-docs`, `pages/rub-docs` | компонент страницы, `lifecycle` |
| `shared/api` | `requestFx`, `ApiError`, `toApiError`, `contractError`, `createGridPorts`, маппинг контракта грида, гарды формы, типы `HttpRequest`, `Problem`, `GridPorts` |
| `shared/lib/lifecycle` | `createPageLifecycle`, тип `PageLifecycle` |

## 8. Рублёвый реестр

### 8.1. Заморозка и сверка

- В начале среза `HEAD` стенда фиксируется эталоном рублёвого реестра и вносится в STATE §10 (на 28.09 — `0da1f48`). Берётся коммит стенда целиком, а не `rub-grid.tpl.html`: `build.py` вклеивает в реестр стили и скрипт `index.html`. С этого момента новое поведение рублёвого реестра — только через кит.
- С эталона снимается геометрия: запись и шапка, Chromium 1600×1000.
- **Сверка — первая задача среза, до кода.** Раздел «Рублёвый реестр» в `registry-drift.md` становится полным списком расхождений классов A/B/C/D. Пункты B — владельцу на решение; всё, что решения не требует, делается как на эталоне.
- Класс C, зафиксированный заранее: многоуровневая сортировка, как в валютном (решение В1; на эталоне одноуровневая); один стор условий для лейна и панели; каталог — плоский список режима simple (группы эталона «Основные / Даты / Финансы / Отправитель / Получатель / Системы» — advanced, срез 1f).

### 8.2. `entities/rub-doc`

- `RubDoc`: `id`, `docNumber`, `uuid`, `txId`, `docRef`, `created`, `changed`, `type`, `edCode` (`ED101` / `ED104` / `ED105`), `direction`, `dirTxt`, `amount`, `queue`, `prio`, `fromName`, `fromAcc`, `fromInn`, `fromKpp`, `fromBic`, `fromBank`, `toName`, `toAcc`, `toInn`, `toKpp`, `toBic`, `toBank`, `initiator`, `source`, `destination`, `purpose`, `status`, `reason`. Окончательный состав — по сверке 8.1.
- Колонки по эталону: статус + ▣; «ID» (№, линк-кнопки `uuid`/`txId`/`docRef`); «Дата / Время» (создан, второй строкой «Изм. дд.мм чч:мм»); «Тип» (тег + код ЭС); «Направление»; «Сумма» (подзаголовок «RUB»); «Отправитель» и «Получатель» (счёт 8…3, под ним наименование); «Банк отправителя» и «Банк получателя» (БИК, под ним наименование); «Системы» (I / S / D); «Очерёдн.» (очерёдность + «СРОЧНО» при приоритете).
- Сквозные строки: причина статуса (как в валютном) и «НАЗН.» над четырьмя колонками от «Отправителя» до «Банка получателя».
- Статусная точка без буквы (`StatusDot` без `letter`), как на эталоне.
- Каталог simple, 10 полей: номер документа, статус, тип документа, направление, сумма, очерёдность, дата создания, наименование отправителя, наименование получателя, ИНН получателя.
- Порты и мапперы — как у `fx-doc`, `gridId = rub-docs`.

### 8.3. Данные

Детерминированные вымышленные записи с соблюдением валидаций: счёт — 20 цифр, у клиентских счетов `810` в знаках 6–8 (казначейский счёт УФК — исключение, как на эталоне); БИК — 9 цифр; ИНН — 10 или 12; КПП — 9 или пусто у ИП и физлиц. Системы и наименования — из обезличенного словаря стенда. С фото прода ничего не переносится.

## 9. Документация

Пишется по готовому коду, отдельной задачей среза.

| Документ | Для кого | Содержание |
|---|---|---|
| `docs/guides/pi-usage.md` | команда внутри | Что это и из чего состоит: схема слоёв и шва. Два пути переноса (раздел 1) и для каждого — по шагам: подключить обработчик `requestFx` (готовые примеры на `fetch` и на axios с `toApiError`), привязать `pageOpened`/`pageClosed` к своему роутеру, смонтировать страницы; для remote — `bootstrap` и shared из спеки совместимости §2.4. Если строка бека отличается — правятся только `api/*.mapper.ts`. Контрактные тесты против своего бека (свой обработчик в `fork`). Farfetched — обёртка портов в `createQuery`. Чек-лист «перенос завершён» |
| `docs/reference/pi-api.md` | бекенд | Эндпоинты, которыми пользуется фронт: `search` и `filter-meta` из контракта `vtb-filters`, предложение `/facets`; наш вариант состава `content[]` для `fx-docs` и `rub-docs`; примеры запросов и ответов — те же, на которых гоняются тесты мапперов |
| `apps/pi/README.md` | разработчик кита | Запуск, регуляторы `?slow` и `?fail`, ссылки на два документа выше |
| `docs/guides/effector-fsd.md` | все | Примеры приводятся к реальным именам (`fx-doc`, `doc-registry`, `createPageLifecycle`), ссылка на `apps/pi` как живой образец |
| STATE, CHANGELOG, основная спека §10–11 | мы | Экраны в `apps/pi`, срез в таблице работ, эталон рубля в §10 |

Для пересылки в Telegram документ использования собирается в PDF под телефон — по запросу владельца.

## 10. Проверки

- **Мапперы** — модульные тесты на примерах из `pi-api.md`: полный ответ, пустая страница, битая форма (`urn:katran:contract`), Problem Details с `errors[]`.
- **Порты** — цепочка `порт → requestFx → фейковый сервер` через `fork({ handlers })`: search с фильтром, сортировкой по двум уровням и страницей; facets; filter-meta; `400` на недопустимый оператор; `404` на неизвестный грид. Это же — контрактные тесты для команды.
- **`createRegistry`** без DOM: `pageOpened` → `refresh`; каталог запрашивается один раз за несколько открытий; `pageClosed` снимает выделение и сохраняет фильтры, сортировку, страницу; отказ каталога не меняет `$state` грида и лейн; при `$opened = false` внешняя реакция не срабатывает.
- **Правки кита:** `createFiltersModel` со стором каталога (значение → стор, обновление стора видно в `useFilters`); `shortAccount`/`AccountValue` с `tail: 3` и по умолчанию.
- **`shared/api`:** `toApiError` — Problem Details, не-JSON тело, пустое тело; обработчик по умолчанию — понятная ошибка.
- **`DocRegistry`** под `renderK` + axe для обоих реестров; `?fail=search` показывает состояние ошибки, `retry` его снимает.
- **Границы слоёв** — eslint в `pnpm check`.
- **e2e** на production-сборке `apps/pi`: запись, скелетон, шапка, 125 % для обоих реестров в коридорах основной спеки (раздел 9), сравнение с замерами эталонов стенда.
- **Совместимость:** `apps/pi` проходит проверки плана 4 (React 17, `chrome88`).

## 11. Порядок работ

| # | Задача | Проверка |
|---|---|---|
| 1 | Заморозка рублёвого реестра, замер эталона, сверка; решения владельца по пунктам B | STATE §10, `registry-drift.md` |
| 2 | Правки кита 6.1–6.2 | тесты кита |
| 3 | Каркас `apps/pi`: `shared/api`, `shared/lib/lifecycle`, `app` с hash-роутером и транспортом, eslint-границы, `pnpm check` | тесты `shared`, линт |
| 4 | `entities/doc-status`, `entities/fx-doc` (порты, мапперы), фейковый сервер | тесты мапперов и портов |
| 5 | `widgets/doc-registry`, `pages/fx-docs`; перенос экрана, данных и e2e из демо; ссылка в демо | тесты `createRegistry`, axe, e2e валютного |
| 6 | `entities/rub-doc`, `pages/rub-docs` | тесты, axe, e2e рублёвого |
| 7 | Pages `/katran/pi/`; документы раздела 9 | деплой, чтение документа использования «с нуля» |

## 12. Открытые вопросы к команде

Срез не блокируют; ответы уточняют документ использования и, возможно, мапперы.

| Вопрос | На что влияет |
|---|---|
| Какой роутер и как экран узнаёт, что открыт | пример адаптера `pageOpened`/`pageClosed` |
| HTTP-клиент; есть ли Farfetched | пример обработчика `requestFx`; обёртка портов |
| Есть ли API ПИ на беке и какой состав `content[]` | мапперы `parseFxDoc`/`parseRubDoc` |
| Принимают ли `POST /grids/{gridId}/facets` | порт `facetsFx`, `pi-api.md` |
| Живёт ли приложение по FSD | путь «слайсы» против «remote» в документе использования |
