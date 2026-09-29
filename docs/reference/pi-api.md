# API `apps/pi` для бекенда

Документ для команды бекенда: какими запросами пользуется фронт `apps/pi` (реестры «Валютные документы» и «Рублёвые документы»), какой состав строки ожидает каждый грид, и примеры запросов/ответов. Контракт транспорта — `POST /grids/{gridId}/search`, `GET /grids/{gridId}/filter-meta` — из `vtb-filters` (`/Users/shaman/_CODE/VTB/vtb-filters/docs/filter-contract.md`, §5–6 «Запрос поиска», «Каталог фильтров»; здесь контракт не копируется, только состав строки и примеры под наши гриды). Эндпоинт `POST /grids/{gridId}/facets` в контракте `vtb-filters` не описан — это наше предложение (раздел 1.3).

Реализация на фронте — `apps/pi/src/shared/api/grid-contract.ts` (сборка тела запроса и разбор ответа) и `apps/pi/src/app/fake/server.ts` (фейковый сервер на этом же контракте, для разработки без бека).

## 1. Эндпоинты

### 1.1. `POST /grids/{gridId}/search`

Тело и ответ — контракт `vtb-filters` §5 «Запрос поиска» дословно: `{ filter: { conditions }, sort, page: { number, size }, includeTotal }` на входе, `{ content: [...], page: { number, size, totalElements, totalPages, hasNext } }` на выходе. `sort` — массив уровней `{ field, direction: 'ASC' | 'DESC' }` (первый уровень — основной, второй и далее — доуточнение при равенстве первого). `page.number` — с нуля.

### 1.2. `GET /grids/{gridId}/filter-meta`

Контракт `vtb-filters` §6 «Каталог фильтров» дословно: `{ gridId?, groups?, fields: [{ id, label, type, operators, dictionary? }], dictionaries? }`. Оба грида `apps/pi` — режим simple: `groups` не используется (плоский список полей), справочники — `INLINE` (значения перечислены в самом ответе, без отдельного запроса).

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

## 2. Ошибки

RFC 9457 Problem Details, как в контракте `vtb-filters` §8: `{ type, title, status?, detail?, errors?: [{ path, code, message }] }`. `apps/pi` разбирает `errors[].code` только для отображения — коды не фиксированы контрактом на нашей стороне, использовать любые говорящие (в фейковом сервере — `UNKNOWN_FIELD`, `OPERATOR_NOT_ALLOWED`, `PAGE_SIZE_OUT_OF_RANGE`).

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
| `queue` | число, `1`–`5` — очерёдность платежа | да | `3` |
| `prio` | `0` или `1` — приоритетный платёж | да | `0` |
| `fromName` | строка — наименование отправителя | да | `"ООО «ЛЕЗЯФОТЫ ВЕФО»"` |
| `fromAcc` | строка, 20 цифр — счёт отправителя | да | `"40702810999377318571"` |
| `fromInn` | строка, 10 или 12 цифр | да | `"5790280657"` |
| `fromKpp` | строка, 9 цифр или пусто | да | `"899351656"` |
| `fromBic` | строка, 9 цифр | да | `"049757384"` |
| `fromBank` | строка — наименование банка отправителя | да | `"АО «МУЛАПЯ БАНК»"` |
| `toName` | строка — наименование получателя | да | `"АО «МЕФЯ ФОТЕ»"` |
| `toAcc` | строка, 20 цифр — счёт получателя | да | `"40702810547442693048"` |
| `toInn` | строка, 10 или 12 цифр | да | `"1265428092"` |
| `toKpp` | строка, 9 цифр или пусто | да | `"409490573"` |
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

Данные ниже — из тестов `apps/pi/src/app/fake/contract.test.ts` и `apps/pi/src/app/fake/server.test.ts`, где не сказано иное. Строки документов — иллюстративные (собраны по составу раздела 4, не взяты дословно из теста).

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

Ответ — 200 (иллюстративно, состав строки — раздел 4.1):

```json
{
  "content": [
    {
      "id": "0f3c0031-7b1d-4c8e-9f0a-284511392017", "docNumber": 804123, "refIn": "REF20260923031", "refOut": null,
      "uetr": "04012233-1c2d-4e5f-8a9b-560012349087", "created": "2026-09-23T10:31:20", "vdDt": "2026-09-23", "vdKt": "2026-09-23",
      "type": "MT103", "direction": "IN", "dirTxt": "Входящий от ЦБ", "amount": 4820000.5, "currency": "USD",
      "f50name": "ООО «Северный ветер»", "f50acc": "40702840012345678901", "purpose": null,
      "f52": "VKRBRU8KXXX", "f57": "NRDIRUMMXXX", "f59name": "АО «Прибой»", "f59acc": "40702840098765432109",
      "status": "ERROR", "reason": "Не найден счёт получателя",
      "sender": "VKRBRU8KXXX", "receiver": "HSTBDEHHXXX", "provS": "ЕРС", "provR": "LORO",
      "lock": null, "inactive": null, "f50opt": "F", "f59opt": "F",
      "f52name": "VOSTOCHNY KREDIT BANK KHABAROVSK BR", "f57name": "NORDINVEST BANK MOSCOW",
      "f58": null, "f58name": null, "outSender": "NRDIRUMMXXX", "outReceiver": "VKRBRU8KXXX",
      "routeType": "NOSTRO", "routeRecv": "HSTBDEHHXXX", "routeAcc": "301108100123451000432"
    }
  ],
  "page": { "number": 0, "size": 5, "totalElements": 8, "totalPages": 2, "hasNext": true }
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

Ответ — ровно то, что отдаёт `GET /grids/fx-docs/filter-meta` в фейковом сервере (`apps/pi/src/app/fake/fx-docs.data.ts`, `fxDocsMeta`), 9 полей режима simple:

```json
{
  "gridId": "fx-docs",
  "fields": [
    { "id": "docNumber", "label": "Номер документа", "type": "NUMBER", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "status", "label": "Статус", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "docStatus" },
    { "id": "type", "label": "Тип сообщения", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "fxType" },
    { "id": "direction", "label": "Направление", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "direction" },
    { "id": "currency", "label": "Валюта", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "currency" },
    { "id": "amount", "label": "Сумма", "type": "NUMBER", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "created", "label": "Дата документа", "type": "DATE", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "f50name", "label": "Приказодатель", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "f59name", "label": "Бенефициар", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] }
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

Запрос — фильтр по очерёдности `5` (`apps/pi/src/app/fake/contract.test.ts`, тест «search и filter-meta (10 полей)»):

```json
POST /grids/rub-docs/search
{
  "filter": { "conditions": [{ "field": "queue", "op": "EQ", "value": "5" }] },
  "sort": [], "page": { "number": 0, "size": 20 }, "includeTotal": true
}
```

Ответ — 200 (иллюстративно, состав строки — раздел 4.2):

```json
{
  "content": [
    {
      "id": "rub-0058", "docNumber": "3074", "uuid": "58e0c7a2-5b1d-4c8e-9f0a-000459502000", "txId": "TX00007598", "docRef": "ED101-2609240001860",
      "created": "2026-09-22T13:26:11", "changed": "2026-09-22T14:03:00",
      "type": "PAYDOCRU", "edCode": "ED101", "direction": "IN", "dirTxt": "входящий от ЦБ на клиента",
      "amount": 128340.55, "queue": 5, "prio": 0,
      "fromName": "ООО «ЛЕЗЯФОТЫ ВЕФО»", "fromAcc": "40702810999377318571", "fromInn": "5790280657", "fromKpp": "899351656",
      "fromBic": "049757384", "fromBank": "АО «МУЛАПЯ БАНК»",
      "toName": "АО «МЕФЯ ФОТЕ»", "toAcc": "40702810547442693048", "toInn": "1265428092", "toKpp": "409490573",
      "toBic": "042242532", "toBank": "ФИЛИАЛ № 8771 БАНКА «ТЯПЯ» (ПАО)",
      "initiator": "NCB.NCB_IN", "source": "UFX", "destination": "RTL",
      "purpose": "Оплата по счёту № 2923-2915 от 07.03.2026 за работы по договору 14-56 от 02.08.2026. В том числе НДС 20% — 13 148.08 руб.",
      "status": "DONE", "reason": null, "lock": null, "inactive": null
    }
  ],
  "page": { "number": 0, "size": 20, "totalElements": 17, "totalPages": 1, "hasNext": false }
}
```

Порт (`rubDocPorts.searchFx`) проверяет: непустая выборка, все строки `queue === 5`.

### 5.6. `rub-docs`: `filter-meta`

Ответ — ровно то, что отдаёт `GET /grids/rub-docs/filter-meta` (`apps/pi/src/app/fake/rub-docs.data.ts`, `rubDocsMeta`), 10 полей режима simple:

```json
{
  "gridId": "rub-docs",
  "fields": [
    { "id": "docNumber", "label": "Номер документа", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "status", "label": "Статус", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "docStatus" },
    { "id": "type", "label": "Тип документа", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "rubType" },
    { "id": "direction", "label": "Группа направления", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "direction" },
    { "id": "amount", "label": "Сумма", "type": "NUMBER", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "queue", "label": "Очерёдность", "type": "ENUM", "operators": ["EQ", "NE", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"], "dictionary": "queue" },
    { "id": "created", "label": "Дата создания", "type": "DATE", "operators": ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "fromName", "label": "Наименование отправителя", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "toName", "label": "Наименование получателя", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] },
    { "id": "toInn", "label": "ИНН получателя", "type": "STRING", "operators": ["EQ", "NE", "CONTAINS", "STARTS_WITH", "ENDS_WITH", "IN", "NOT_IN", "IS_EMPTY", "IS_NOT_EMPTY"] }
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

Тот же класс ошибки, что у `fx-docs` (раздел 5.4), на неизвестном поле фильтра (иллюстративно — по правилу валидации фейкового сервера, `apps/pi/src/app/fake/server.ts`):

```json
POST /grids/rub-docs/search
{
  "filter": { "conditions": [{ "field": "fromInn", "op": "GT", "value": "100" }] },
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
    { "path": "filter.conditions[0].op", "code": "OPERATOR_NOT_ALLOWED", "message": "Оператор GT недопустим для поля fromInn типа STRING" }
  ]
}
```

## 6. Что не проверяет фейковый сервер (не полагаться на это в проде)

Фейковый сервер `apps/pi/src/app/fake/server.ts` — упрощение для разработки без бека, а не образец полной валидации:

- HTTP-метод маршрута не проверяется (`GET` на `search` тоже пройдёт).
- `FacetsBody.field` не сверяется с каталогом — неизвестное поле вернёт пустой массив, а не `400`.

Настоящий бек должен проверять оба случая.
