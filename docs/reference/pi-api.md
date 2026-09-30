# API `apps/pi` для бекенда

Документ для команды бекенда: какими запросами пользуется фронт `apps/pi` (реестры «Валютные документы» и «Рублёвые документы»), какой состав строки ожидает каждый грид, и примеры запросов/ответов. Контракт транспорта — `POST /grids/{gridId}/search`, `GET /grids/{gridId}/filter-meta` — из `vtb-filters` (`/Users/shaman/_CODE/VTB/vtb-filters/docs/filter-contract.md`, §5–6 «Запрос поиска», «Каталог фильтров»; здесь контракт не копируется, только состав строки и примеры под наши гриды). Эндпоинты `POST /grids/{gridId}/facets`, `GET /grids/{gridId}/documents/{id}` и `POST /grids/{gridId}/suggest`, а также признак поля `suggest` в каталоге в контракте `vtb-filters` не описаны — это наши предложения (разделы 1.3, 1.4 и 1.5, состав детали — раздел 7).

Реализация на фронте — `apps/pi/src/shared/api/grid-contract.ts` (сборка тела запроса и разбор ответа) и `apps/pi/src/app/fake/server.ts` (фейковый сервер на этом же контракте, для разработки без бека).

## 1. Эндпоинты

### 1.1. `POST /grids/{gridId}/search`

Тело и ответ — контракт `vtb-filters` §5 «Запрос поиска» дословно: `{ filter: { conditions }, sort, page: { number, size }, includeTotal }` на входе, `{ content: [...], page: { number, size, totalElements, totalPages, hasNext } }` на выходе. `sort` — массив уровней `{ field, direction: 'ASC' | 'DESC' }` (первый уровень — основной, второй и далее — доуточнение при равенстве первого). `page.number` — с нуля.

### 1.2. `GET /grids/{gridId}/filter-meta`

Контракт `vtb-filters` §6 «Каталог фильтров» дословно: `{ gridId?, groups?, fields: [{ id, label, type, operators, dictionary?, defaultOperator?, suggest? }], dictionaries? }`. Оба грида `apps/pi` — режим simple: `groups` не используется (плоский список полей), справочники — `INLINE` (значения перечислены в самом ответе, без отдельного запроса).

Два необязательных свойства поля определяют, какой контрол панель фильтров покажет для поля:

- `defaultOperator` — оператор по умолчанию (контракт §6), один из `operators` поля. `IN` у полей `STRING` и `NUMBER` включает ввод **списка значений**: пользователь вставляет или вводит номера и референсы через пробел, запятую или с новой строки, панель шлёт одно условие `IN` (до 500 значений). Без `defaultOperator` поле `STRING` — ввод фраз, `NUMBER` — одно значение или диапазон.
- `suggest: true` — **предложение** (`docs/reference/suggest-proposal.md`): у поля есть подсказки при вводе, панель запрашивает их через `POST /grids/{gridId}/suggest` (раздел 1.5). Без свойства или с `false` подсказок нет, и `suggest` для такого поля бек отклоняет `400`.

Как панель складывает условия (для сведения бека):

- фразы одного поля приходят **несколькими условиями `CONTAINS` по этому полю** — все должны выполняться (AND, контракт §4.4): `[{ "field": "purpose", "op": "CONTAINS", "value": "договор" }, { "field": "purpose", "op": "CONTAINS", "value": "НДС" }]`;
- списки номеров и референсов — одно условие `IN` со значениями, не больше 500 (предел контракта).

### 1.3. `POST /grids/{gridId}/facets` (предложение)

В контракте `vtb-filters` не описан. Нужен строке статусов над гридом («лейну») — счётчик записей по каждому значению статуса без отдельного запроса `search` на каждое значение. Предлагаемая форма — то же тело фильтра, что у `search`, плюс поле, по которому считать:

**Тело запроса:**

```json
{ "filter": { "conditions": [] }, "field": "status" }
```

**Ответ — 200:**

```json
[
  { "value": "IN_PROGRESS", "count": 9 },
  { "value": "ERROR", "count": 8 },
  { "value": "DONE", "count": 24 }
]
```

Семантика:

- `filter.conditions` — тот же формат условий, что у `search` §5.1 контракта `vtb-filters`; фронт присылает применённый фильтр **без условия по самому полю `field`** (иначе лейн статуса всегда показал бы счётчик только активного фильтра статуса).
- `field` — идентификатор поля из каталога фильтров (`filter-meta.fields[].id`).
- Ответ — массив пар «значение поля · число записей, попадающих под текущий фильтр и это значение». Значения, которых нет ни у одной записи, можно не включать в ответ (фронт трактует отсутствие как 0) — фейковый сервер `apps/pi` включает.
- Ошибки — тот же формат Problem Details, что у `search` (раздел 2 ниже): неизвестное поле фильтра — `400`, неизвестный `gridId` — `404`.

### 1.4. `GET /grids/{gridId}/documents/{id}` (предложение)

В контракте `vtb-filters` не описан. Нужен деталке «Платёжная инструкция» (срез 2a): документ целиком — строка реестра плюс поля «Общих данных», которых в `content[]` нет.

- `id` — значение поля `id` строки `content[]` (раздел 4); фронт кодирует его в пути (`encodeURIComponent`), так что `/`, `?` и `#` в идентификаторе бека маршрут не ломают. Тела запроса нет, query-параметров нет.
- `200` — объект документа, состав — раздел 7 (`fx-docs` — 7.2, `rub-docs` — 7.3).
- `404` — Problem Details «Документ не найден» (пример — раздел 7.5); неизвестный `gridId` — тоже `404`.
- Ошибки транспорта и `5xx` — как у `search` (раздел 2): фронт показывает текст ошибки внутри drawer'а с кнопкой «Повторить», реестр продолжает работать.

### 1.5. `POST /grids/{gridId}/suggest` (предложение)

В контракте `vtb-filters` не описан. Нужен полю ввода фраз в панели фильтров: пока пользователь печатает, под полем — значения этого поля, которые реально встречаются в выборке. Вызывается только для полей с `suggest: true` в каталоге (раздел 1.2); фронт ждёт паузу ввода (250 мс) и не шлёт пустой запрос. Подробное обоснование — `docs/reference/suggest-proposal.md`.

**Тело запроса:**

```json
{ "filter": { "conditions": [{ "field": "status", "op": "EQ", "value": "ERROR" }] }, "field": "reason", "query": "с", "limit": 10 }
```

**Ответ — 200:**

```json
{ "items": ["Санкционный стоп-лист", "Не найден счёт получателя", "Просрочена дата валютирования"] }
```

Семантика:

- `filter.conditions` — тот же формат условий, что у `search` §5.1 контракта `vtb-filters`; фронт присылает применённый фильтр **без условий по самому полю `field`** (как у `facets`, раздел 1.3): подсказки не должны сужаться уже введёнными фразами этого же поля.
- `field` — идентификатор поля из каталога с `suggest: true`.
- `query` — введённый текст (фронт обрезает пробелы по краям); совпадение — **вхождение без учёта регистра**.
- `limit` — от 1 до 50 (фронт шлёт 10).
- `items` — **различные** значения поля среди записей, попадающих под `filter`, содержащие `query`, **по убыванию частоты** (при равной частоте — по алфавиту); не больше `limit`. Пустые значения не включаются.
- Ошибки — Problem Details (раздел 2): поле без `suggest: true` или неизвестное — `400` с кодом `SUGGEST_NOT_SUPPORTED` (путь `field`), `limit` вне 1–50 — `400` с кодом `LIMIT_OUT_OF_RANGE` (путь `limit`); условия `filter` проверяются как у `search`; неизвестный `gridId` — `404`. Отказ подсказок не мешает работе с фильтром: фронт просто не показывает список.

## 2. Ошибки

RFC 9457 Problem Details, как в контракте `vtb-filters` §8: `{ type, title, status?, detail?, errors?: [{ path, code, message }] }`. `apps/pi` разбирает `errors[].code` только для отображения — коды не фиксированы контрактом на нашей стороне, использовать любые говорящие (в фейковом сервере — `UNKNOWN_FIELD`, `OPERATOR_NOT_ALLOWED`, `PAGE_SIZE_OUT_OF_RANGE`; у подсказок — `SUGGEST_NOT_SUPPORTED`, `LIMIT_OUT_OF_RANGE`).

## 3. `gridId`

Два грида: `fx-docs` — валютные документы, `rub-docs` — рублёвые документы. Каждый — свой набор полей `filter-meta` и свой состав `content[]` (раздел 4).

## 4. Состав строки `content[]`

### 4.1. `fx-docs` — `FxDoc`

Источник типа: `apps/pi/src/entities/fx-doc/model/fxDoc.ts`. Маппер (что можно переименовать без правки остального кода, только `apps/pi/src/entities/fx-doc/api/fxDoc.mapper.ts`) — `parseFxDoc`.

| Поле | Тип | Обязательно | Пример |
|---|---|---|---|
| `id` | строка | да | `"0f3c0005-7b1d-4c8e-9f0a-284511392017"` |
| `docNumber` | число | да | `800412` |
| `refIn` | строка или `null` | да (может быть `null`) | `"REF20260923042"` |
| `refOut` | строка или `null` | да (может быть `null`) | `null` |
| `uetr` | строка | да | `"04012233-1c2d-4e5f-8a9b-560012349087"` |
| `created` | строка ISO 8601 (дата-время) | да | `"2026-09-23T10:49:12"` |
| `vdDt` | строка ISO 8601 (дата) — дата валютирования дебета | да | `"2026-09-23"` |
| `vdKt` | строка ISO 8601 (дата) — дата валютирования кредита | да | `"2026-09-23"` |
| `type` | одно из `MT103`, `MT202`, `MT202COV`, `MT199` | да | `"MT103"` |
| `direction` | одно из `IN`, `OUT`, `TRANSIT`, `OTHER` | да | `"IN"` |
| `dirTxt` | строка — подпись направления | да | `"Входящий от ЦБ"` |
| `amount` | число | да | `1234567.89` |
| `currency` | одно из `USD`, `EUR`, `CNY`, `RUB` | да | `"USD"` |
| `f50name` | строка — наименование приказодателя (поле 50) | да | `"ООО «Северный ветер»"` |
| `f50acc` | строка — счёт приказодателя | да | `"40702840012345678901"` |
| `purpose` | строка или `null` | да (может быть `null`) | `"Оплата по договору № 4021 от 03.09.2026, без НДС"` |
| `f52` | строка — BIC поля 52 | да | `"VKRBRU8KXXX"` |
| `f57` | строка — BIC поля 57 | да | `"NRDIRUMMXXX"` |
| `f59name` | строка — наименование бенефициара (поле 59) | да | `"АО «Прибой»"` |
| `f59acc` | строка — счёт бенефициара | да | `"40702840098765432109"` |
| `status` | одно из значений `Status` (раздел 5.3) | да | `"IN_PROGRESS"` |
| `reason` | строка или `null` — причина статуса (`ERROR`/`DEFERRED`/`REJECTED`) | да (может быть `null`) | `"Не найден счёт получателя"` |
| `sender` | строка — BIC отправителя | да | `"VKRBRU8KXXX"` |
| `receiver` | строка — BIC получателя | да | `"HSTBDEHHXXX"` |
| `provS` | строка — провайдер S | да | `"ЕРС"` |
| `provR` | строка — провайдер R | да | `"LORO"` |
| `lock` | `{ who: string; since: string }` или `null` — заблокирован другим пользователем | да (может быть `null`) | `{ "who": "Иванова М. П.", "since": "2026-09-23T09:26:00" }` |
| `inactive` | `{ why: string }` или `null` — не участвует в массовом выделении | да (может быть `null`) | `{ "why": "Документ в архиве" }` |
| `f50opt` | строка — буква опции поля 50 | да | `"F"` |
| `f59opt` | строка — буква опции поля 59 | да | `"F"` |
| `f52name` | строка — наименование банка по BIC поля 52 | да | `"VOSTOCHNY KREDIT BANK KHABAROVSK BR"` |
| `f57name` | строка — наименование банка по BIC поля 57 | да | `"NORDINVEST BANK MOSCOW"` |
| `f58` | строка или `null` — BIC поля 58 (только `MT202`/`MT202COV`) | да (может быть `null`) | `null` |
| `f58name` | строка или `null` — наименование банка поля 58 | да (может быть `null`) | `null` |
| `outSender` | строка — S out | да | `"NRDIRUMMXXX"` |
| `outReceiver` | строка — R out | да | `"VKRBRU8KXXX"` |
| `routeType` | одно из `LORO`, `NOSTRO`, `INTERNAL` | да | `"NOSTRO"` |
| `routeRecv` | строка — BIC получателя по маршруту | да | `"HSTBDEHHXXX"` |
| `routeAcc` | строка — балансовый счёт маршрута | да | `"301108100123451000432"` |

### 4.2. `rub-docs` — `RubDoc`

Источник типа: `apps/pi/src/entities/rub-doc/model/rubDoc.ts`. Маппер — `apps/pi/src/entities/rub-doc/api/rubDoc.mapper.ts` (`parseRubDoc`). Даты — тот же формат, что у `fx-docs` (ISO 8601 без смещения зоны); главная строка даты в гриде выводится без секунд (`formatDateTimeMinutes`), колонка «Изм.» — коротким форматом `formatDayMonthMinutes` («дд.мм чч:мм»).

| Поле | Тип | Обязательно | Пример |
|---|---|---|---|
| `id` | строка | да | `"rub-0042"` |
| `docNumber` | строка | да | `"3026"` |
| `uuid` | строка | да | `"42e0c7a2-5b1d-4c8e-9f0a-000332598000"` |
| `txId` | строка | да | `"TX00005502"` |
| `docRef` | строка (может быть пустой строкой `""` — «нет значения») | да | `"ED101-260924000012600"` |
| `created` | строка ISO 8601 (дата-время) | да | `"2026-09-22T10:34:11"` |
| `changed` | строка ISO 8601 (дата-время) | да | `"2026-09-22T11:02:00"` |
| `type` | одно из `PAYDOCRU`, `REQDOCRU`, `PAYORDRU` | да | `"PAYDOCRU"` |
| `edCode` | одно из `ED101`, `ED104`, `ED105` (соответствует `type`) | да | `"ED101"` |
| `direction` | одно из `IN`, `OUT`, `TRANSIT`, `OTHER` | да | `"IN"` |
| `dirTxt` | строка — подпись направления | да | `"входящий от ЦБ на клиента"` |
| `amount` | число | да | `54321.08` |
| `queue` | число — очерёдность платежа (в фильтре `filter-meta` — справочник `1`–`5`, раздел 5.6; тип и маппер (`rubDoc.mapper.ts`) диапазон не ограничивают) | да | `3` |
| `prio` | `0` или `1` — приоритетный платёж | да | `0` |
| `fromName` | строка — наименование отправителя | да | `"ООО «ЛЕЗЯФОТЫ ВЕФО»"` |
| `fromAcc` | строка, 20 цифр — счёт отправителя | да | `"40702810999377318571"` |
| `fromInn` | строка, 10 или 12 цифр | да | `"5790280657"` |
| `fromKpp` | строка: 9 цифр, `"0"` или пусто (физлица, ИП) | да | `"899351656"` |
| `fromBic` | строка, 9 цифр | да | `"049757384"` |
| `fromBank` | строка — наименование банка отправителя | да | `"АО «МУЛАПЯ БАНК»"` |
| `toName` | строка — наименование получателя | да | `"АО «МЕФЯ ФОТЕ»"` |
| `toAcc` | строка, 20 цифр — счёт получателя | да | `"40702810547442693048"` |
| `toInn` | строка, 10 или 12 цифр | да | `"1265428092"` |
| `toKpp` | строка: 9 цифр, `"0"` или пусто (физлица, ИП) | да | `"409490573"` |
| `toBic` | строка, 9 цифр | да | `"042242532"` |
| `toBank` | строка — наименование банка получателя | да | `"ФИЛИАЛ № 8771 БАНКА «ТЯПЯ» (ПАО)"` |
| `initiator` | строка — код системы-инициатора | да | `"NCB.NCB_IN"` |
| `source` | строка — код системы-источника | да | `"UFX"` |
| `destination` | строка — код системы-назначения | да | `"RTL"` |
| `purpose` | строка — назначение платежа | да | `"Оплата по счёту № 2923-2915 от 07.03.2026…"` |
| `status` | одно из значений `Status` (раздел 5.3, общий с `fx-docs`) | да | `"DONE"` |
| `reason` | строка или `null` — причина статуса | да (может быть `null`) | `null` |
| `lock` | `{ who: string; since: string }` или `null` | да (может быть `null`) | `null` |
| `inactive` | `{ why: string }` или `null` | да (может быть `null`) | `null` |

### 4.3. Статусы (общий словарь `fx-docs`/`rub-docs`)

`Status` — `IN_PROGRESS | TO_EXPORT | PROCESSING | ERROR | DEFERRED | EXPORTED | INVALID | REJECTED | DONE`. `INVALID` — термин владельца продукта, без перевода на русский (остальные подписи см. каталог `docStatus` в разделе 6).

## 5. Примеры запросов и ответов

Данные ниже — из тестов `apps/pi/src/app/fake/contract.test.ts` и `apps/pi/src/app/fake/server.test.ts`, где не сказано иное. Строки документов — настоящие ответы фейкового сервера на эти запросы (`makeFxDocs()`/`makeRubDocs()`), показана первая строка `content`; `page` — как в ответе.

### 5.1. `fx-docs`: `search`

Запрос — фильтр по статусу `ERROR`, сортировка по сумме по убыванию, первая страница по 5 записей (`apps/pi/src/app/fake/contract.test.ts`, тест «search: фильтр по статусу, сортировка по сумме, страница»):

```json
POST /grids/fx-docs/search
{
  "filter": { "conditions": [{ "field": "status", "op": "EQ", "value": "ERROR" }] },
  "sort": [{ "field": "amount", "direction": "DESC" }],
  "page": { "number": 0, "size": 5 },
  "includeTotal": true
}
```

Ответ — 200, первая из 5 строк страницы (состав строки — раздел 4.1):

```json
{
  "content": [
    {
      "id": "0f3c0005-7b1d-4c8e-9f0a-897088053636", "docNumber": 164275, "refIn": null, "refOut": "OUT4929193",
      "uetr": "47867615-1c2d-4e5f-8a9b-495768832741", "created": "2026-09-23T10:37:56", "vdDt": "2026-09-23", "vdKt": "2026-09-23",
      "type": "MT202", "direction": "OUT", "dirTxt": "Исходящий на Лоро", "amount": 4425396.3, "currency": "CNY",
      "f50name": "ООО «Ромашка»", "f50acc": "4070215670167206879", "purpose": "Оплата по договору № 8545 от 08.09.2026, НДС не облагается",
      "f52": "PLKZHKHHXXX", "f57": "VKRBRU8KXXX", "f59name": "ООО «Северный ветер»", "f59acc": "4070215697320128511",
      "status": "ERROR", "reason": "Просрочена дата валютирования",
      "sender": "NRDIRUMMXXX", "receiver": "VKRBRU8KXXX", "provS": "LORO", "provR": "LORO",
      "lock": null, "inactive": null, "f50opt": "F", "f59opt": "F",
      "f52name": "POLARIS KREDIT BANK HELSINKI", "f57name": "VOSTOCHNY KREDIT BANK KHABAROVSK BR",
      "f58": "VKRBRU8KXXX", "f58name": "VOSTOCHNY KREDIT BANK KHABAROVSK BR", "outSender": "VKRBRU8KXXX", "outReceiver": "PLKZHKHHXXX",
      "routeType": "NOSTRO", "routeRecv": "BCLHLV22XXX", "routeAcc": "30114156514461469752"
    }
  ],
  "page": { "number": 0, "size": 5, "totalElements": 6, "totalPages": 2, "hasNext": true }
}
```

Порт (`fxDocPorts.searchFx`) проверяет: не больше 5 строк, все `status === 'ERROR'`, суммы отсортированы по убыванию, `total >= rows.length`.

### 5.2. `fx-docs`: `facets`

Запрос — счётчик по полю `status` без фильтра (`apps/pi/src/app/fake/contract.test.ts`, тест «facets и filter-meta»):

```json
POST /grids/fx-docs/facets
{ "filter": { "conditions": [] }, "field": "status" }
```

Ответ — 200 (иллюстративно; тест проверяет только, что сумма `count` по всем значениям равна 87 — размеру набора):

```json
[
  { "value": "IN_PROGRESS", "count": 9 },
  { "value": "TO_EXPORT", "count": 14 },
  { "value": "PROCESSING", "count": 9 },
  { "value": "ERROR", "count": 7 },
  { "value": "DEFERRED", "count": 7 },
  { "value": "EXPORTED", "count": 14 },
  { "value": "INVALID", "count": 7 },
  { "value": "REJECTED", "count": 7 },
  { "value": "DONE", "count": 13 }
]
```

### 5.3. `fx-docs`: `filter-meta`

Ответ — ровно то, что отдаёт `GET /grids/fx-docs/filter-meta` в фейковом сервере (`apps/pi/src/app/fake/fx-docs.data.ts`, `fxDocsMeta`), 14 полей режима simple в порядке панели. Номер документа и референсы (поле 20 входящего и исходящего) — `defaultOperator: "IN"` (ввод списком), наименования сторон, BIC 52, назначение и причина статуса — `suggest: true` (подсказки, раздел 1.5):

```json
{
  "gridId": "fx-docs",
  "fields": [
    { "id": "docNumber", "label": "Номер документа", "type": "NUMBER", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "defaultOperator": "IN" },
    { "id": "refIn", "label": "20 вх", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "defaultOperator": "IN" },
    { "id": "refOut", "label": "20 исх", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "defaultOperator": "IN" },
    { "id": "status", "label": "Статус", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "docStatus" },
    { "id": "type", "label": "Тип сообщения", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "fxType" },
    { "id": "direction", "label": "Направление", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "direction" },
    { "id": "currency", "label": "Валюта", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "currency" },
    { "id": "amount", "label": "Сумма", "type": "NUMBER", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "created", "label": "Дата документа", "type": "DATE", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "f50name", "label": "Приказодатель", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "suggest": true },
    { "id": "f59name", "label": "Бенефициар", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "suggest": true },
    { "id": "f52", "label": "BIC 52", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "suggest": true },
    { "id": "purpose", "label": "Назначение", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "suggest": true },
    { "id": "reason", "label": "Причина статуса", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "suggest": true }
  ],
  "dictionaries": {
    "docStatus": { "mode": "INLINE", "items": [
      { "value": "IN_PROGRESS", "label": "В работе" }, { "value": "TO_EXPORT", "label": "К экспорту" }, { "value": "PROCESSING", "label": "В обработке" },
      { "value": "ERROR", "label": "Ошибка" }, { "value": "DEFERRED", "label": "Отложенный" }, { "value": "EXPORTED", "label": "Экспортирован" },
      { "value": "INVALID", "label": "INVALID" }, { "value": "REJECTED", "label": "Отказ" }, { "value": "DONE", "label": "Обработан" }
    ] },
    "fxType": { "mode": "INLINE", "items": [
      { "value": "MT103", "label": "MT103" }, { "value": "MT202", "label": "MT202" }, { "value": "MT202COV", "label": "MT202COV" }, { "value": "MT199", "label": "MT199" }
    ] },
    "direction": { "mode": "INLINE", "items": [
      { "value": "IN", "label": "IN" }, { "value": "OUT", "label": "OUT" }, { "value": "TRANSIT", "label": "TRANSIT" }, { "value": "OTHER", "label": "OTHER" }
    ] },
    "currency": { "mode": "INLINE", "items": [
      { "value": "USD", "label": "USD" }, { "value": "EUR", "label": "EUR" }, { "value": "CNY", "label": "CNY" }, { "value": "RUB", "label": "RUB" }
    ] }
  }
}
```

Направление отдаётся в фильтре кодом (`IN`/`OUT`/`TRANSIT`/`OTHER`), а не подписью — так же, как в самом гриде (STATE §8, F7).

### 5.4. `fx-docs`: ошибка 400

Недопустимый оператор для числового поля (`apps/pi/src/app/fake/contract.test.ts`, тест «400 на недопустимый оператор, 404 на неизвестный грид»):

```json
POST /grids/fx-docs/search
{
  "filter": { "conditions": [{ "field": "amount", "op": "CONTAINS", "value": "1" }] },
  "sort": [], "page": { "number": 0, "size": 20 }, "includeTotal": true
}
```

Ответ — 400:

```json
{
  "type": "urn:vtb:grid:filter-validation",
  "title": "Некорректный фильтр",
  "status": 400,
  "detail": "Ошибок: 1",
  "errors": [
    { "path": "filter.conditions[0].op", "code": "OPERATOR_NOT_ALLOWED", "message": "Оператор CONTAINS недопустим для поля amount типа NUMBER" }
  ]
}
```

### 5.5. `rub-docs`: `search`

Запрос — фильтр по очерёдности `5`, значение — число, как `value` справочника `queue` (раздел 5.6) (`apps/pi/src/app/fake/contract.test.ts`, тест «search и filter-meta (10 полей)»):

```json
POST /grids/rub-docs/search
{
  "filter": { "conditions": [{ "field": "queue", "op": "EQ", "value": 5 }] },
  "sort": [], "page": { "number": 0, "size": 20 }, "includeTotal": true
}
```

Ответ — 200, первая из 17 строк (состав строки — раздел 4.2):

```json
{
  "content": [
    {
      "id": "rub-0002", "docNumber": "2906", "uuid": "02e0c7a2-5b1d-4c8e-9f0a-000000015838", "txId": "TX00000262", "docRef": "ED104-2609220001814",
      "created": "2026-09-22T13:34:14", "changed": "2026-09-22T15:58:00",
      "type": "REQDOCRU", "edCode": "ED104", "direction": "OUT", "dirTxt": "исходящий на ЦБ · взыскание",
      "amount": 212.43, "queue": 5, "prio": 0,
      "fromName": "ФЯБЕРИОВА ПИРАС ГИЗАОВНА", "fromAcc": "40817810516762861162", "fromInn": "256169407365", "fromKpp": "0",
      "fromBic": "015920113", "fromBank": "ГЕВАХИСКОЕ ГУ БАНКА РОССИИ // УФК ПО ДИЗАДОСКОЙ ОБЛАСТИ",
      "toName": "ИП ПОТОВЯОВА ПОСЯС БЕПЯОВИЧ", "toAcc": "40802810904985101300", "toInn": "409237987347", "toKpp": "",
      "toBic": "045542573", "toBank": "ФИЛИАЛ № 9292 БАНКА «ХЕВЯ» (ПАО)",
      "initiator": "CLT.CLT_DCR", "source": "CLX", "destination": "PRM",
      "purpose": "Предоплата по договору поставки № 54-62 от 14.07.2026 за оборудование. НДС не облагается",
      "status": "DONE", "reason": null, "lock": {"who": "Смирнова Е. В.", "since": "2026-09-23T11:26:00"}, "inactive": null
    }
  ],
  "page": { "number": 0, "size": 20, "totalElements": 17, "totalPages": 1, "hasNext": false }
}
```

Порт (`rubDocPorts.searchFx`) проверяет: непустая выборка, все строки `queue === 5`.

### 5.6. `rub-docs`: `filter-meta`

Ответ — ровно то, что отдаёт `GET /grids/rub-docs/filter-meta` (`apps/pi/src/app/fake/rub-docs.data.ts`, `rubDocsMeta`), 10 полей режима simple. Номер документа и ИНН получателя — `defaultOperator: "IN"` (ввод списком), наименования отправителя и получателя — `suggest: true`. Справочник `queue` — единственный с числовыми `value` (`1`…`5`): поле `queue` в строке — число, поэтому и значение в условии фильтра — число (`"value": 5`, раздел 5.5), не строка `"5"`:

```json
{
  "gridId": "rub-docs",
  "fields": [
    { "id": "docNumber", "label": "Номер документа", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "defaultOperator": "IN" },
    { "id": "status", "label": "Статус", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "docStatus" },
    { "id": "type", "label": "Тип документа", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "rubType" },
    { "id": "direction", "label": "Группа направления", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "direction" },
    { "id": "amount", "label": "Сумма", "type": "NUMBER", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "queue", "label": "Очерёдность", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "queue" },
    { "id": "created", "label": "Дата создания", "type": "DATE", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "fromName", "label": "Наименование отправителя", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "suggest": true },
    { "id": "toName", "label": "Наименование получателя", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "suggest": true },
    { "id": "toInn", "label": "ИНН получателя", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "defaultOperator": "IN" }
  ],
  "dictionaries": {
    "docStatus": { "mode": "INLINE", "items": [
      { "value": "IN_PROGRESS", "label": "В работе" }, { "value": "TO_EXPORT", "label": "К экспорту" }, { "value": "PROCESSING", "label": "В обработке" },
      { "value": "ERROR", "label": "Ошибка" }, { "value": "DEFERRED", "label": "Отложенный" }, { "value": "EXPORTED", "label": "Экспортирован" },
      { "value": "INVALID", "label": "INVALID" }, { "value": "REJECTED", "label": "Отказ" }, { "value": "DONE", "label": "Обработан" }
    ] },
    "rubType": { "mode": "INLINE", "items": [
      { "value": "PAYDOCRU", "label": "Платёжное поручение" }, { "value": "REQDOCRU", "label": "Инкассовое поручение" }, { "value": "PAYORDRU", "label": "Платёжный ордер" }
    ] },
    "direction": { "mode": "INLINE", "items": [
      { "value": "IN", "label": "IN" }, { "value": "OUT", "label": "OUT" }, { "value": "TRANSIT", "label": "TRANSIT" }, { "value": "OTHER", "label": "OTHER" }
    ] },
    "queue": { "mode": "INLINE", "items": [
      { "value": 1, "label": "1" }, { "value": 2, "label": "2" }, { "value": 3, "label": "3" }, { "value": 4, "label": "4" }, { "value": 5, "label": "5" }
    ] }
  }
}
```

### 5.7. `rub-docs`: ошибка 400

Другой класс ошибки, чем у `fx-docs` (раздел 5.4) — неизвестное поле фильтра, а не недопустимый оператор: `fromInn` (ИНН отправителя) есть в строке `content[]` (раздел 4.2), но не входит в каталог `filter-meta` рублёвого реестра (раздел 5.6 — 10 полей, `fromInn` среди них нет; фильтровать можно только по `toInn`). Иллюстративно — по правилу валидации фейкового сервера, `apps/pi/src/app/fake/server.ts` (`validate`: поле условия не найдено в `meta.fields` → `UNKNOWN_FIELD`):

```json
POST /grids/rub-docs/search
{
  "filter": { "conditions": [{ "field": "fromInn", "op": "EQ", "value": "5790280657" }] },
  "sort": [], "page": { "number": 0, "size": 20 }, "includeTotal": true
}
```

Ответ — 400:

```json
{
  "type": "urn:vtb:grid:filter-validation",
  "title": "Некорректный фильтр",
  "status": 400,
  "detail": "Ошибок: 1",
  "errors": [
    { "path": "filter.conditions[0].field", "code": "UNKNOWN_FIELD", "message": "Поле fromInn неизвестно" }
  ]
}
```

### 5.8. `fx-docs`: `suggest` (предложение)

Запрос — подсказки по приказодателю на ввод «ооо» без фильтра (`apps/pi/src/app/fake/contract.test.ts`, тест «suggest: различные значения поля по выборке…»; здесь `limit` 10, в тесте — 3):

```json
POST /grids/fx-docs/suggest
{ "filter": { "conditions": [] }, "field": "f50name", "query": "ооо", "limit": 10 }
```

Ответ — 200 (настоящий ответ фейкового сервера; значений с «ооо» в наборе пять, поэтому их меньше `limit`):

```json
{ "items": ["ООО «Ромашка»", "ООО «Кедр»", "ООО «Лотос»", "ООО «Меридиан»", "ООО «Северный ветер»"] }
```

С фильтром по другому полю выборка сужается — подсказки причины статуса среди документов в статусе «Ошибка» (пример раздела 1.5):

```json
POST /grids/fx-docs/suggest
{ "filter": { "conditions": [{ "field": "status", "op": "EQ", "value": "ERROR" }] }, "field": "reason", "query": "с", "limit": 5 }
```

```json
{ "items": ["Санкционный стоп-лист", "Не найден счёт получателя", "Просрочена дата валютирования"] }
```

### 5.9. `fx-docs`: `suggest`, ошибка 400

Поле без `suggest: true` (сумма) и `limit` вне диапазона — обе ошибки в одном ответе (`apps/pi/src/app/fake/server.ts`):

```json
POST /grids/fx-docs/suggest
{ "filter": { "conditions": [] }, "field": "amount", "query": "1", "limit": 100 }
```

Ответ — 400:

```json
{
  "type": "urn:vtb:grid:filter-validation",
  "title": "Некорректный запрос подсказок",
  "status": 400,
  "detail": "Ошибок: 2",
  "errors": [
    { "path": "field", "code": "SUGGEST_NOT_SUPPORTED", "message": "У поля amount нет подсказок" },
    { "path": "limit", "code": "LIMIT_OUT_OF_RANGE", "message": "limit — от 1 до 50" }
  ]
}
```

## 6. Что не проверяет фейковый сервер (не полагаться на это в проде)

Фейковый сервер `apps/pi/src/app/fake/server.ts` — упрощение для разработки без бека, а не образец полной валидации:

- HTTP-метод маршрута не проверяется (`GET` на `search` тоже пройдёт).
- `FacetsBody.field` не сверяется с каталогом — неизвестное поле вернёт пустой массив, а не `400`.
- Границы `DATETIME` сравниваются строкой настенного времени: смещение зоны в значении условия не учитывается. Настоящий бек обязан приводить момент к одной зоне.
- Подсказки (`suggest`, раздел 1.5) считаются по данным стенда (87 валютных и набор рублёвых документов) полным перебором; частоты и порядок — свойство этих данных, не образец. Регулятор `?fail=suggest` (ответ `500`) есть только у фейка.
- Деталь документа (`GET …/documents/{id}`, раздел 7) строится из строки реестра формулами по номеру строки (`apps/pi/src/app/fake/fx-docs.detail.ts`, `rub-docs.detail.ts`); метод запроса не проверяется. Регулятор `?fail=detail` (ответ `500`) есть только у фейка; `404` фейк отдаёт на любой `id`, которого нет среди строк реестра, с `type` `urn:katran:fake` (пример — раздел 7.5) — у настоящего бека правило «документа нет» и `type` свои, фронт смотрит только на статус и текст (раздел 1.4).

Настоящий бек должен проверять метод, поле фасетов и зону в границах `DATETIME`.

## 7. Деталь документа (предложение)

Ответ `GET /grids/{gridId}/documents/{id}` (раздел 1.4) для деталки «Платёжная инструкция».

### 7.1. Семантика

- **Деталь = строка реестра + поля деталки.** Объект содержит все поля строки `content[]` своего грида (раздел 4.1 или 4.2 — те же имена и типы) и сверх них — поля ниже. Строку фронт разбирает тем же маппером, что и в реестре (`parseFxDoc`/`parseRubDoc`), поэтому все обязательные поля строки обязательны и здесь.
- **Номер, сумма и статус обязаны совпадать со строкой реестра** того же `id`: шапка и лейн деталки до загрузки показываются из строки, после — из детали, и расхождение было бы видно пользователю.
- Пустой строковый реквизит — пустая строка `""`, а не отсутствие ключа (маппер требует каждый ключ); пустое SWIFT-поле — `lines: []` или отсутствие тега в `fields`. Фронт показывает пустое бледной строкой «не заполнено», чтобы два документа рядом (drawer A и B) совпадали построчно.
- **«да (может быть `null`)»** в таблицах ниже (`inSender`, `inReceiver`, `time` проводки) — правило предложения строже маппера: бек отдаёт ключ всегда, `null` — «значения нет». Маппер фронта (`strOrNull`) сейчас мягче и отсутствующий ключ тоже читает как `null`, но на это не полагайтесь — так же устроены поля строки `refIn`/`refOut`/`reason` (раздел 4).
- `tabsOff` — ключи вкладок, у которых для этого документа нет данных (таблица 7.4): они уходят второй группой полосы вкладок, недоступными, с подсказкой «Нет данных». Неизвестные фронту ключи игнорируются; с набором вкладок грида `tabsOff` не сверяется — опечатка в ключе просто не выключит вкладку.
- Реализация на фронте: типы — `apps/pi/src/entities/fx-doc/model/detail.ts` (`FxDocDetail`), `apps/pi/src/entities/rub-doc/model/detail.ts` (`RubDocDetail`); мапперы — `entities/*/api/detail.mapper.ts` (`parseFxDocDetail`, `parseRubDocDetail`): если бек называет поля иначе, правятся только они.

### 7.2. `fx-docs` — `FxDocDetail`

Поля строки `FxDoc` (раздел 4.1) плюс:

| Поле | Тип | Обязательно | Пример |
|---|---|---|---|
| `numDate` | строка ISO 8601 (дата) — дата документа («№ 812345 от 23.09.2026») | да | `"2026-09-23"` |
| `valueDates` | массив ровно из 4 дат ISO 8601: вх, исх, по Дт, по Кт | да | `["2026-09-23", "2026-09-23", "2026-09-23", "2026-09-23"]` |
| `fields` | объект «тег SWIFT-поля → значение»; значение — `{ opt?: string; acc?: string; lines: string[] }` (буква опции, счёт у полей 50/59, строки поля) | да (может быть `{}`) | `{ "50": { "opt": "F", "acc": "40817840500010042371", "lines": ["LAVRENTIEV DMITRY OLEGOVICH", "…"] } }` |
| `inSender` | строка — BIC отправителя входящего сообщения, или `null` — входящего нет | да (может быть `null`) | `"NRDIRUMMXXX"` |
| `inReceiver` | строка — BIC получателя входящего, или `null` | да (может быть `null`) | `"VKRBRU8KXXX"` |
| `accDt` | строка — счёт дебета (20 знаков) | да | `"30110840700000001842"` |
| `accKt` | строка — счёт кредита (20 знаков) | да | `"40817840100050017762"` |
| `routeDesc` | строка — описание счёта маршрута (подсказка к `routeAcc` строки) | да | `"Счёт ностро в Baltic Clearing Bank (Рига), USD"` |
| `routeText` | строка — правило маршрута | да | `"Маршрут через Baltic Clearing по правилу для USD от контрагентов ЕС"` |
| `txId` | строка — идентификатор транзакции | да | `"ba5ac473-d0a4-40ea-b639-47326d3b8e45"` |
| `txAt` | строка ISO 8601 (дата-время) — время транзакции | да | `"2026-09-23T10:52:21"` |
| `txs` | массив проводок (ниже) | да (может быть `[]`) | см. пример 7.5 |
| `tabsOff` | массив ключей вкладок без данных (таблица 7.4) | да (может быть `[]`) | `["mpu"]` |

**Правила `fields`:**

- Ключ — тег поля без двоеточий: `20`, `21`, `33B`, `36`, `50`, `52`–`59`, `70`, `71A`, `71F`, `72`, `77B`, `79` и т. п. (реестр полей — `FX_FIELDS`, `apps/pi/src/entities/fx-doc/model/swift.ts`). Какие поля показываются, задаёт профиль типа сообщения (`FX_PROFILES` там же): MT103 — сетка 50, 52–57, 59 (55 и 56 скрываются, если пусты), текст 70, 72, строка 33B, 36, 77B, в сводке 20 и 71A; MT202 и MT202COV — сетка 52–58, текст 72, в сводке 20 и 21; MT199 — 79, в сводке 20 и 21.
- **Тег с префиксом `B.`** (`B.50`, `B.52`, `B.56`, `B.57`, `B.59`, `B.70`, `B.72`, `B.33B`) — поле последовательности B MT202COV (покрываемый клиентский платёж). У других типов таких ключей нет.
- `lines: []` или отсутствие ключа — поле не заполнено. `opt: ""` и `acc: ""` фронт трактует как отсутствие (у поля 59 опция без буквы допустима).
- Поле 32A в `fields` не нужно: сумма и валюта сводки берутся из строки (`amount`, `currency`), даты валютирования — из `valueDates`.

**Проводка** (`txs[]`, общая форма `fx-docs` и `rub-docs`, `apps/pi/src/entities/posting/model/posting.ts`):

| Поле | Тип | Обязательно | Пример |
|---|---|---|---|
| `dir` | одно из `DEBIT`, `CREDIT` | да | `"DEBIT"` |
| `st` | одно из `EXECUTED`, `PENDING`, `CANCELED` | да | `"EXECUTED"` |
| `acc` | строка — счёт | да | `"30110840700000001842"` |
| `reg` | строка — регистр учёта | да | `"00000_NostroUSD"` |
| `time` | строка ISO 8601 (дата-время) — время проведения, или `null` — ещё не проведена | да (может быть `null`) | `"2026-09-23T07:52:22.730Z"` |
| `amount` | число | да | `1500.5` |
| `currency` | строка — код валюты | да | `"USD"` |

### 7.3. `rub-docs` — `RubDocDetail`

Поля строки `RubDoc` (раздел 4.2) плюс (все строковые реквизиты обязательны, пустой — `""`):

| Поле | Тип | Обязательно | Пример |
|---|---|---|---|
| `numDate` | строка ISO 8601 (дата) — дата документа | да | `"2026-09-24"` |
| `opCode` | строка — код операции (`"01"` — платёжное поручение, `"06"` — инкассовое; у платёжного ордера `PAYORDRU` кода нет — `""`) | да | `"01"` |
| `opName` | строка — название операции | да | `"Платёжное поручение"` |
| `scenario` | строка — код сценария | да | `"SC_NCB_IN_CREDIT"` |
| `sysFrom` | строка — система S | да | `"DB01"` |
| `sysTo` | строка — система R | да | `"DB02"` |
| `party` | `{ s: Party; r: Party }` — отправитель и получатель, 11 реквизитов каждый (ниже) | да | см. пример 7.5 |
| `purposeExtra` | `{ instr, uip, reserve, f20 }` — инструкция получателю, УИП, резервное поле, назначение платежа поле 20 | да | `{ "instr": "…", "uip": "68578800898192015437", "reserve": "…", "f20": "…" }` |
| `agents` | массив посредников `{ name, bic, bankAcc, acc }` | да (может быть `[]`) | `[{ "name": "БАНК «ВЯХИЛЯ» (АО)", "bic": "041916658", "bankAcc": "…", "acc": "…" }]` |
| `budget` | `{ b101, b104, b105, b106, b107, b108, b109, b110 }` — бюджетные реквизиты по номерам полей платёжного документа | да | все `""` — секция «нет данных» |
| `ed107` | `{ relId, initId, relDate, execDate, v }` — шапка ED107 и значения узлов; `v` — объект «`узел/реквизит` → строка» | да (`v` может быть `{}`) | `{ "relId": "5108", …, "v": { "OrderingBank/BIC": "045131779" } }` |
| `collect` | `{ c48, cLimit, c70, c38, c39, c40, c41 }` — параметры инкассового поручения | да | все `""` у платёжного поручения |
| `txAt` | строка ISO 8601 (дата-время) — время транзакции | да | `"2026-09-24T11:08:20"` |
| `txs` | массив проводок — та же форма, что у `fx-docs` (раздел 7.2) | да (может быть `[]`) | см. пример 7.5 |
| `tabsOff` | массив ключей вкладок без данных (таблица 7.4) | да (может быть `[]`) | `["stream", "mpu"]` |

**Реквизиты стороны** (`party.s`, `party.r`, порядок строк таблицы «отправитель | получатель» — `RUB_PARTY`, `apps/pi/src/entities/rub-doc/model/profiles.ts`): `name` — наименование, `opt` — опция, `acc` — номер счёта, `inn` — ИНН, `kpp` — КПП, `info` — доп. информация, `addr` — адрес, `bank` — наименование банка, `bic` — БИК, `bankAcc` — счёт банка, `bankInfo` — доп. информация банка. Все 11 ключей обязательны.

**Пути `ed107.v`** — `узел/реквизит` по группам `ED107_GROUPS` (там же): узлы `OrderingBank`, `AcctWithInst`, `Beneficiary`, `PrevInstrAgent` — реквизиты `BIC`, `ed:Name`, `BankAccount`, `SWBIC`; узлы `InstructingAgent`, `InstructedAgent` — `BIC`, `CorrespAcc`, `SWBIC`. Написание узлов — как в макете стенда (решение владельца 30.09, `docs/reference/detail-drift.md`, В-Д3). Отсутствующий путь — пустое значение; лишние пути фронт не показывает.

### 7.4. Ключи вкладок (`tabsOff`)

Порядок вкладок фиксированный (`FX_TABS` — `entities/fx-doc/model/swift.ts`, `RUB_TABS` — `entities/rub-doc/model/profiles.ts`). В срезе 2a содержимое есть только у «Общих данных»; остальные вкладки показывают «будет в срезе 2b», но `tabsOff` уже управляет их доступностью.

| Ключ | Вкладка | `fx-docs` | `rub-docs` |
|---|---|---|---|
| `main` | Общие данные | да | да |
| `extra` | Доп. поля | да | — |
| `statuses` | Статусы | да | да |
| `compliance` | Комплаенс | да | да |
| `linked` | Связанные документы | да | да |
| `tasks` | Задачи | да | да |
| `notif` | Нотификации | да | да |
| `source` | Исходный текст | да | — |
| `ed244` | ED244 | — | да |
| `stream` | Стриминг | да | да |
| `mpu` | MPU | да | да |
| `audit` | Аудит | да | да |

### 7.5. Примеры

Ответы ниже — объекты `FX_DETAIL_EXAMPLE` (`apps/pi/src/entities/fx-doc/api/detail.example.ts`) и `RUB_DETAIL_EXAMPLE` (`apps/pi/src/entities/rub-doc/api/detail.example.ts`) дословно, в JSON; разбор проверяется тестами `apps/pi/src/entities/fx-doc/api/detail.mapper.test.ts` и `apps/pi/src/entities/rub-doc/api/detail.mapper.test.ts` (там же — битые формы: неверный тип строк поля, не 4 даты валютирования, недопустимое состояние проводки, пропущенный реквизит стороны). Данные вымышленные.

**`fx-docs`, MT103:**

```json
GET /grids/fx-docs/documents/u1
```

Ответ — 200:

```json
{
  "id": "u1", "docNumber": 812345, "refIn": "FX2609220000417", "refOut": null,
  "uetr": "eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10", "created": "2026-09-23T10:52:11", "vdDt": "2026-09-23", "vdKt": "2026-09-23",
  "type": "MT103", "direction": "IN", "dirTxt": "Входящий от ЦБ", "amount": 1500.5,
  "currency": "USD", "f50name": "LAVRENTIEV DMITRY OLEGOVICH", "f50acc": "40817840500010042371", "purpose": "Оплата по договору № 12-45 от 01.03.2026",
  "f52": "NRDIRUMMXXX", "f57": "VKRBRU8KXXX", "f59name": "SEMENOVA IRINA VLADIMIROVNA", "f59acc": "40817840100050017762",
  "status": "ERROR", "reason": "Превышен лимит", "sender": "NRDIRUMMXXX", "receiver": "VKRBRU8KXXX",
  "provS": "LORO", "provR": "NOSTRO", "lock": null, "inactive": null,
  "f50opt": "F", "f59opt": "F", "f52name": "NORDINVEST BANK MOSCOW", "f57name": "VOSTOCHNY KREDIT BANK KHABAROVSK BR",
  "f58": null, "f58name": null, "outSender": "VKRBRU8KXXX", "outReceiver": "BCLHLV22XXX",
  "routeType": "NOSTRO", "routeRecv": "BCLHLV22XXX", "routeAcc": "30114840900000000517", "numDate": "2026-09-23",
  "valueDates": ["2026-09-23", "2026-09-23", "2026-09-23", "2026-09-23"],
  "fields": {
    "20": { "lines": ["FX2609220000417"] },
    "21": { "lines": ["NONREF"] },
    "36": { "lines": ["1,0886"] },
    "50": { "opt": "F", "acc": "40817840500010042371", "lines": ["LAVRENTIEV DMITRY OLEGOVICH", "ULITSA PROFSOYUZNAYA 83-1-214", "RU/ MOSCOW, 117279"] },
    "52": { "opt": "A", "lines": ["NORDINVEST BANK MOSCOW", "NRDIRUMMXXX"] },
    "53": { "opt": "A", "lines": ["BALTIC CLEARING BANK RIGA", "BCLHLV22XXX"] },
    "54": { "opt": "A", "lines": ["HANSEATIC TRADE BANK HAMBURG", "HSTBDEHHXXX"] },
    "55": { "lines": [] },
    "56": { "opt": "A", "lines": ["MERIDIAN INTERMEDIARY BANK LONDON", "MRDNGB2LXXX"] },
    "57": { "opt": "A", "lines": ["VOSTOCHNY KREDIT BANK KHABAROVSK BR", "VKRBRU8KXXX"] },
    "59": { "opt": "F", "acc": "40817840100050017762", "lines": ["SEMENOVA IRINA VLADIMIROVNA", "PROSPEKT MIRA 101-2-45", "RU/ MOSCOW, 129085"] },
    "70": { "lines": ["/INV/ 2026-0417 DD 15.09.2026", "PAYMENT FOR CONSULTING SERVICES", "UNDER CONTRACT 12-45 DD 01.03.2026", "VAT NOT APPLICABLE"] },
    "72": { "lines": ["/INS/ NRDIRUMMXXX", "/ACC/ PLEASE CREDIT WITHOUT DELAY", "/REC/ REF FX2609220000417", "/BNF/ CONTRACT 12-45 DD 01.03.2026", "/INT/ MRDNGB2LXXX", "//CHARGES OUR"] },
    "71A": { "lines": ["OUR"] },
    "71F": { "lines": ["USD 35,00"] },
    "33B": { "lines": ["EUR 1148300,00"] },
    "77B": { "lines": [] }
  },
  "inSender": "NRDIRUMMXXX", "inReceiver": "VKRBRU8KXXX", "accDt": "30110840700000001842", "accKt": "40817840100050017762",
  "routeDesc": "Счёт ностро в Baltic Clearing Bank (Рига), USD", "routeText": "Маршрут через Baltic Clearing по правилу для USD от контрагентов ЕС", "txId": "ba5ac473-d0a4-40ea-b639-47326d3b8e45", "txAt": "2026-09-23T10:52:21",
  "txs": [
    { "dir": "DEBIT", "st": "EXECUTED", "acc": "30110840700000001842", "reg": "00000_NostroUSD", "time": "2026-09-23T07:52:22.730Z", "amount": 1500.5, "currency": "USD" },
    { "dir": "CREDIT", "st": "EXECUTED", "acc": "40817840100050017762", "reg": "00010_ClientCurrent", "time": "2026-09-23T07:52:22.731Z", "amount": 1500.5, "currency": "USD" },
    { "dir": "CREDIT", "st": "PENDING", "acc": "47422840500000000311", "reg": "00030_FxConversion", "time": null, "amount": 1500.5, "currency": "USD" }
  ],
  "tabsOff": ["mpu"]
}
```

**`rub-docs`, PAYDOCRU:**

```json
GET /grids/rub-docs/documents/r1
```

Ответ — 200:

```json
{
  "id": "r1", "docNumber": "3741", "uuid": "72aa73fb-dae6-4672-8d09-e15afc0a523d", "txId": "03d45fed-f505-4fca-a267-60cba12b82f2",
  "docRef": "ED101-5210472026066", "created": "2026-09-24T11:08:14", "changed": "2026-09-24T11:08:20", "type": "PAYDOCRU",
  "edCode": "ED101", "direction": "IN", "dirTxt": "входящий от ЦБ на клиента", "amount": 76394.81,
  "queue": 5, "prio": 0, "fromName": "ООО «ХУРЫГУПЯ»", "fromAcc": "40702810064578557830",
  "fromInn": "4340195751", "fromKpp": "473897776", "fromBic": "049597373", "fromBank": "АО «ЗОДО БАНК»",
  "toName": "ИП ТЫСЫЛИОВ ГИБАС ЗУДЫОВИЧ", "toAcc": "40802810820980451081", "toInn": "394831189084", "toKpp": "",
  "toBic": "042993195", "toBank": "БАНК «ХАРОГА» (АО)", "initiator": "NCB.NCB_IN", "source": "UFX",
  "destination": "RTL", "purpose": "Оплата по счёту № 6945-2101 от 18.07.2026 за оборудование по договору 65-89 от 27.02.2026. В том числе НДС 20% — 18 658.24 руб.", "status": "DONE", "reason": null,
  "lock": null, "inactive": null, "numDate": "2026-09-24", "opCode": "01",
  "opName": "Платёжное поручение", "scenario": "SC_NCB_IN_CREDIT", "sysFrom": "DB01", "sysTo": "DB02",
  "party": {
    "s": { "name": "ООО «ХУРЫГУПЯ»", "opt": "", "acc": "40702810064578557830", "inn": "4340195751", "kpp": "473897776", "info": "", "addr": "740828, Г. ЛЫСУЛА, УЛ. НИФЕМЯ, Д. 133, ПОМ. 520", "bank": "АО «ЗОДО БАНК»", "bic": "049597373", "bankAcc": "30101810508469019375", "bankInfo": "" },
    "r": { "name": "ИП ТЫСЫЛИОВ ГИБАС ЗУДЫОВИЧ", "opt": "", "acc": "40802810820980451081", "inn": "394831189084", "kpp": "", "info": "", "addr": "057617, Г. СОЛОКЫ, УЛ. МЕСОБО, Д. 83, КВ. 143", "bank": "БАНК «ХАРОГА» (АО)", "bic": "042993195", "bankAcc": "30101810664602335376", "bankInfo": "Филиал в г. Хупево" }
  },
  "purposeExtra": { "instr": "Гяналу тыпепо вуза факе пысему вя ни лидефе фотохо ва мезе мокефо", "uip": "68578800898192015437", "reserve": "Зувивофе дыто симу", "f20": "Руди фибеку собыве сясе" },
  "agents": [
    { "name": "ФИЛИАЛ № 3826 БАНКА «НУВОСЕ» (ПАО)", "bic": "041550162", "bankAcc": "30101810951233369033", "acc": "30110810217115096554" },
    { "name": "БАНК «ВЯХИЛЯ» (АО)", "bic": "041916658", "bankAcc": "30101810196704420940", "acc": "30110810928566570883" }
  ],
  "budget": { "b101": "", "b104": "", "b105": "", "b106": "", "b107": "", "b108": "", "b109": "", "b110": "" },
  "ed107": {
    "relId": "5108", "initId": "46713", "relDate": "2026-09-24", "execDate": "2026-09-24",
    "v": {
      "OrderingBank/BIC": "045131779", "OrderingBank/ed:Name": "БАНК «ВУХИДО» (АО)",
      "OrderingBank/BankAccount": "30101810105950215060", "OrderingBank/SWBIC": "DUZFRUY9",
      "InstructingAgent/BIC": "047485823", "InstructingAgent/CorrespAcc": "30101810372488940093",
      "InstructingAgent/SWBIC": "XEANRURA"
    }
  },
  "collect": { "c48": "", "cLimit": "", "c70": "", "c38": "", "c39": "", "c40": "", "c41": "" }, "txAt": "2026-09-24T11:08:20",
  "txs": [
    { "dir": "DEBIT", "st": "EXECUTED", "acc": "30102810738223744290", "reg": "00000_CorrCBR", "time": "2026-09-24T08:08:20.114Z", "amount": 76394.81, "currency": "RUB" },
    { "dir": "CREDIT", "st": "EXECUTED", "acc": "40802810820980451081", "reg": "00010_ClientCurrent", "time": "2026-09-24T08:08:20.118Z", "amount": 76394.81, "currency": "RUB" }
  ],
  "tabsOff": ["stream", "mpu"]
}
```

**Документа нет** — ответ фейкового сервера на неизвестный `id` (`apps/pi/src/app/fake/contract.test.ts`, тест «404 на неизвестный id; 500 по регулятору detail»; `type` — фейка, у бека свой):

```json
GET /grids/fx-docs/documents/nope
```

Ответ — 404:

```json
{ "type": "urn:katran:fake", "title": "Документ не найден", "status": 404, "detail": "fx-docs/nope" }
```

Фронт показывает внутри drawer'а «Не удалось загрузить документ» с текстом ошибки (`title` и `detail`) и кнопкой «Повторить»; шапка и лейн остаются из строки реестра.
