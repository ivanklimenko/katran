# План 7: поля ввода для фильтров — даты и время, справочники с поиском, списки и фразы, подсказки

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Пять новых контролов `@katran/ui` (`DateInput`, `DateRange`, `SearchSelect`, `MultiSelect`, `TagInput`), несколько условий на поле и подсказки с бека в модели фильтров, новая раскладка полей `FilterPanel` и подключение в реестрах `apps/pi`.

**Architecture:** Всё своё, без новых зависимостей: выпадающие части — существующий `Popover` (у него появляется роль `presentation` для списков), даты — строки `ГГГГ-ММ-ДД` / `ГГГГ-ММ-ДДTчч:мм` с арифметикой без `new Date()`-разбора, формат вывода — шаблон `DD.MM.YYYY`. Модель фильтров получает `setField` (все условия поля разом) и подсказки (`suggestFx` приложения, задержка, отсечение устаревших ответов). `FilterPanel` выбирает контрол по типу поля и `defaultOp` из `filter-meta`, чипы — по полю.

**Tech Stack:** React 17–19, effector 23 / effector-react 23, TypeScript strict (`exactOptionalPropertyTypes`), CSS Modules, `@floating-ui/dom`, vitest + jsdom + Testing Library + jest-axe, Playwright (e2e `apps/pi`), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-30-katran-filter-inputs-design.md` (binding authority). Затрагивает основную спеку `docs/superpowers/specs/2026-09-23-katran-design.md` §5.1, 7.1, 8.3, 8.4 и спеку среза 1e `docs/superpowers/specs/2026-09-24-katran-slice1e-registry-design.md` §3, §6.2 — их правит задача 14.

## Global Constraints

- Без новых зависимостей: ни в `packages/*`, ни в `apps/*` (спека §2).
- React 17: идентификаторы — `useStableId` из `packages/ui/src/compat/useStableId.ts`, никогда `useId`; никаких API React 18+ (линт `no-restricted-syntax` в `eslint.config.js` это ловит).
- Chromium 88: без `:has`, `inert`, `Array.prototype.at`, `structuredClone`, `String.prototype.replaceAll`, `Object.hasOwn`, `findLast`, `toSorted`; без `Intl.DateTimeFormat` — названия месяцев и дней — словарь кита.
- Даты: значения — строки `IsoDay = 'ГГГГ-ММ-ДД'` и `IsoMinute = 'ГГГГ-ММ-ДДTчч:мм'`; ISO-строки никогда не разбираются через `new Date(string)`. Локальный объект `Date` допустим только в `todayLocal()` и в вычислении смещения зоны (`new Date(y, m − 1, d, hh, mm)` из чисел).
- `ui` не импортирует `effector`; `effector` берёт из `@katran/ui` только `import type`; типы фильтра объявлены в `packages/ui/src/filters/types.ts`, `packages/effector/src/types.ts` их реэкспортирует.
- CSS только токенами `var(--k-…)`: голые `px` лишь в `border*`/`outline*`/`box-shadow`/`letter-spacing`; никаких hex/rgba; локальные классы camelCase; пустая строка перед комментарием (stylelint). Новые размеры — только через `packages/tokens/src/tokens.src.ts` + `pnpm gen`, регенерация (`tokens.css`, `tokens.ts`) коммитится. План добавляет `cal-cell: 28`, `preset-w: 140`, `tag-max-h: 84`.
- Никаких `eslint-disable`/`stylelint-disable`.
- Опциональные пропы публичных типов — `?: T | undefined` (`exactOptionalPropertyTypes`).
- Интерактив — настоящие `<button>`/`<input>` с доступным именем; `jsx-a11y` в линте, `axe` в тестах; тесты под `renderK` ищут по ролям и атрибутам, не `container.firstElementChild`. jsdom не видит каскад CSS-модулей — визуальные проверки только в e2e (Chromium).
- effector: публичные события — `EventCallable<T>`; `.reset(ev)` откатывает к initial — для «пусто» `.on(ev, () => …)`; редьюсеры `.on` объявляются раньше `sample`, читающего тот же стор; побочные эффекты только эффектами-таргетами; тесты — `fork`/`allSettled`, таймеры — `vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync`.
- Русский язык интерфейса, комментариев, JSDoc и коммитов. **Коммиты без трейлеров `Co-Authored-By` и подписей «Generated with»** (правило владельца: код уходит в закрытый контур).
- Перед каждым коммитом `pnpm check` из корня (gen:check + lint + test + build) зелёный. e2e `apps/pi` (`pnpm --filter pi e2e`) вне `pnpm check`; прогонять **на переднем плане** и дожидаться результата (грабля исполнения SDD, STATE §9).

## Карта файлов

```
packages/tokens/src/tokens.src.ts            + 'cal-cell', 'preset-w', 'tag-max-h'                      T1
packages/ui/src/date/dateStr.ts (+test)      типы дат, календарная арифметика, формат-шаблон, смещения   T1
packages/ui/src/date/presets.ts (+test)      DatePreset, 7 пресетов, QUICK_PRESETS, DEFAULT_PRESETS      T1
packages/ui/src/date/ruNames.ts              месяцы и дни недели по-русски                               T1
packages/ui/src/date/Calendar.tsx (+test)    сетка месяца, WAI-ARIA grid                                  T2
packages/ui/src/date/Date.module.css         стили календаря, полей дат, горячих кнопок                  T2–T4
packages/ui/src/date/MaskedDateField.tsx     поле с маской по шаблону (внутреннее)                        T3
packages/ui/src/date/TimeField.tsx           поле «чч:мм» в поповере (внутреннее)                        T3
packages/ui/src/date/DateInput.tsx (+test)   одна дата / дата со временем                                 T3
packages/ui/src/date/DateRange.tsx (+test)   период, пресеты, горячие кнопки                              T4
packages/ui/src/date/index.ts                экспорт папки                                                 T1–T4
packages/ui/src/overlay/Popover.tsx          role: + 'presentation'                                         T5
packages/ui/src/select/options.ts (+test)    Option, фильтр, ключ                                          T5
packages/ui/src/select/Listbox.tsx           список вариантов role=listbox (внутренний)                   T5
packages/ui/src/select/SearchSelect.tsx (+test)                                                           T5
packages/ui/src/select/MultiSelect.tsx (+test)                                                            T6
packages/ui/src/select/Select.module.css, index.ts                                                         T5–T6
packages/ui/src/tag/parseTags.ts (+test)     разбор значений и фраз, слияние с пределом                  T7
packages/ui/src/tag/TagInput.tsx (+test), Tag.module.css, index.ts                                        T7
packages/ui/src/index.ts                     + date, select, tag                                            T1, T5, T7
packages/ui/src/filters/types.ts             FilterField.defaultOp/suggest, SuggestState                   T8
packages/effector/src/types.ts               + SuggestQuery, реэкспорт SuggestState                         T8
packages/effector/src/createFiltersModel.ts (+test)   setField, $lane по полю, подсказки                  T8
packages/effector/src/useFilters.ts, hooks.test.tsx                                                        T8
packages/ui/src/filters/fieldOps.ts (+test)  fieldControl, FieldRaw, draftOf, conditionsFrom              T9
packages/ui/src/filters/opLabels.ts (+test)  describeField, fieldParts, даты в формате                     T9
packages/ui/src/filters/FilterField.tsx      контролы по fieldControl                                       T10
packages/ui/src/filters/FilterPanel.tsx (+test), Filters.module.css   чипы по полю, onSetField, подсказки, dateFormat   T10
apps/demo/src/pages/InputsPage.tsx, Page.module.css   витрина пяти контролов                               T11
apps/pi/src/shared/api/grid-contract.ts (+test), ports.ts, index.ts   defaultOperator, suggest, suggestFx  T12
apps/pi/src/app/fake/{server,grid,meta,fx-docs.data,rub-docs.data}.ts, contract.test.ts                      T12
apps/pi/src/widgets/doc-registry/lib/createRegistry.ts, ui/DocRegistry.tsx                                   T12
docs/reference/pi-api.md                                                                                     T12
apps/pi/e2e/filters.spec.ts                                                                                  T13
docs/reference/suggest-proposal.md, спеки, CHANGELOG.md, README.md, docs/STATE.md                           T14
```

---

### Task 1: Токены и помощники дат

**Files:**
- Modify: `packages/tokens/src/tokens.src.ts` (+ регенерация `packages/tokens/src/tokens.css`, `tokens.ts`)
- Create: `packages/ui/src/date/dateStr.ts`, `packages/ui/src/date/dateStr.test.ts`, `packages/ui/src/date/presets.ts`, `packages/ui/src/date/presets.test.ts`, `packages/ui/src/date/ruNames.ts`, `packages/ui/src/date/index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Produces (`@katran/ui`): типы `IsoDay`, `IsoMinute`, `DateValue`, `DateFormat`; функции `isValidDay`, `isValidMinute`, `daysInMonth`, `makeDay`, `dayOf`, `timeOf`, `addDays`, `addMonths`, `startOfMonth`, `endOfMonth`, `weekday`, `monthGrid`, `todayLocal`, `compareDates`, `withTime`, `datePartOf`, `maskDateText`, `parseDateText`, `formatDateText`, `isComplete`, `isoMinuteStart`, `isoMinuteEnd`, `isoDayStart`, `isoDayEnd`; `DatePreset`, `PRESET_TODAY`, `PRESET_YESTERDAY`, `PRESET_LAST3`, `PRESET_LAST7`, `PRESET_LAST30`, `PRESET_THIS_MONTH`, `PRESET_LAST_MONTH`, `QUICK_PRESETS`, `DEFAULT_PRESETS`, `presetMatches`; внутренние `MONTHS`, `MONTHS_GEN`, `WEEKDAYS_SHORT`, `WEEKDAYS_FULL`.

- [ ] **Step 1: Токены.** В `sizes` файла `packages/tokens/src/tokens.src.ts` после строки `'filter-field': 220, // минимальная ширина поля панели фильтров` добавить:

```ts
  // поля ввода фильтров (спека 2026-09-30): ячейка календаря, колонка пресетов периода,
  // предел высоты поля с чипами — три строки чипа h-ctl-s с зазорами sp-1: 3 × 24 + 3 × 4
  'cal-cell': 28, 'preset-w': 140, 'tag-max-h': 84,
```

Run: `pnpm gen && pnpm gen:check` → без диффа после регенерации; `tokens.css` и `tokens.ts` в коммит.

- [ ] **Step 2: Тест помощников.** `packages/ui/src/date/dateStr.test.ts`:

```ts
import {
  addDays, addMonths, compareDates, dayOf, daysInMonth, endOfMonth, formatDateText, isComplete, isoDayEnd, isoDayStart,
  isoMinuteEnd, isoMinuteStart, isValidDay, isValidMinute, maskDateText, monthGrid, parseDateText, startOfMonth, timeOf,
  todayLocal, weekday, withTime, datePartOf,
} from './dateStr'

const ZONES = ['UTC', 'Europe/Moscow', 'America/New_York']

describe('календарь', () => {
  it('валидность дня и минуты', () => {
    expect(isValidDay('2024-02-29')).toBe(true)
    expect(isValidDay('2026-02-29')).toBe(false)
    expect(isValidDay('2026-02-31')).toBe(false)
    expect(isValidDay('2026-13-01')).toBe(false)
    expect(isValidDay('2026-9-1')).toBe(false)
    expect(isValidMinute('2026-09-01T23:59')).toBe(true)
    expect(isValidMinute('2026-09-01T24:00')).toBe(false)
    expect(isValidMinute('2026-09-01T23:60')).toBe(false)
    expect(daysInMonth(1900, 2)).toBe(28)
    expect(daysInMonth(2000, 2)).toBe(29)
  })
  it('арифметика дней и месяцев', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2026-09-30', 365)).toBe('2027-09-30')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2026-03-15', -3)).toBe('2025-12-15')
    expect(startOfMonth('2026-09-17')).toBe('2026-09-01')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
    expect(dayOf('2026-09-01T18:30')).toBe('2026-09-01')
    expect(timeOf('2026-09-01T18:30')).toBe('18:30')
    expect(timeOf('2026-09-01')).toBe('')
  })
  it('день недели с понедельника и сетка месяца', () => {
    expect(weekday('1970-01-01')).toBe(4)
    expect(weekday('2026-09-28')).toBe(1)
    expect(weekday('2026-09-27')).toBe(7)
    const g = monthGrid('2026-09-15')
    expect(g).toHaveLength(42)
    expect(g[0]).toBe('2026-08-31')
    expect(g[1]).toBe('2026-09-01')
    expect(g[41]).toBe('2026-10-11')
  })
  it('сравнение строк дат', () => {
    expect(compareDates('2026-09-01', '2026-09-02')).toBe(-1)
    expect(compareDates('2026-09-01T10:00', '2026-09-01T09:59')).toBe(1)
    expect(compareDates('2026-09-01', '2026-09-01')).toBe(0)
  })
  it('сегодня — по локальным часам', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 23, 23, 30))
    expect(todayLocal()).toBe('2026-09-23')
    vi.useRealTimers()
  })
})

describe('формат-шаблон', () => {
  it('время дописывается и снимается', () => {
    expect(withTime('DD.MM.YYYY', true)).toBe('DD.MM.YYYY HH:mm')
    expect(withTime('DD.MM.YYYY HH:mm', true)).toBe('DD.MM.YYYY HH:mm')
    expect(withTime('DD.MM.YYYY HH:mm', false)).toBe('DD.MM.YYYY')
    expect(datePartOf('YYYY-MM-DD HH:mm')).toBe('YYYY-MM-DD')
  })
  it('маска ставит разделители по мере ввода и отбрасывает лишнее', () => {
    expect(maskDateText('0', 'DD.MM.YYYY')).toBe('0')
    expect(maskDateText('01', 'DD.MM.YYYY')).toBe('01')
    expect(maskDateText('010', 'DD.MM.YYYY')).toBe('01.0')
    expect(maskDateText('01.09.2026', 'DD.MM.YYYY')).toBe('01.09.2026')
    expect(maskDateText('0109202699', 'DD.MM.YYYY')).toBe('01.09.2026')
    expect(maskDateText('2026x09', 'YYYY-MM-DD')).toBe('2026-09')
    expect(maskDateText('010920261830', 'DD.MM.YYYY HH:mm')).toBe('01.09.2026 18:30')
    expect(maskDateText('01092026', 'DD.MM.YYYY HH:mm')).toBe('01.09.2026')
    expect(maskDateText('', 'DD.MM.YYYY')).toBe('')
  })
  it('полнота: дата обязательна, время — только целиком', () => {
    expect(isComplete('01.09.202', 'DD.MM.YYYY')).toBe(false)
    expect(isComplete('01.09.2026', 'DD.MM.YYYY')).toBe(true)
    expect(isComplete('01.09.2026', 'DD.MM.YYYY HH:mm')).toBe(true)
    expect(isComplete('01.09.2026 1', 'DD.MM.YYYY HH:mm')).toBe(false)
    expect(isComplete('01.09.2026 18:30', 'DD.MM.YYYY HH:mm')).toBe(true)
  })
  it('разбор по шаблону', () => {
    expect(parseDateText('01.09.2026', 'DD.MM.YYYY')).toBe('2026-09-01')
    expect(parseDateText('2026-09-01', 'YYYY-MM-DD')).toBe('2026-09-01')
    expect(parseDateText('01/09/2026', 'DD/MM/YYYY')).toBe('2026-09-01')
    expect(parseDateText('01.09.2026 18:30', 'DD.MM.YYYY HH:mm')).toBe('2026-09-01T18:30')
    expect(parseDateText('01.09.2026', 'DD.MM.YYYY HH:mm')).toBe('2026-09-01')
    expect(parseDateText('31.02.2026', 'DD.MM.YYYY')).toBeNull()
    expect(parseDateText('01.09.2026 24:00', 'DD.MM.YYYY HH:mm')).toBeNull()
    expect(parseDateText('01.09.202', 'DD.MM.YYYY')).toBeNull()
  })
  it('вывод по шаблону; день без времени по шаблону со временем — без времени', () => {
    expect(formatDateText('2026-09-01', 'DD.MM.YYYY')).toBe('01.09.2026')
    expect(formatDateText('2026-09-01', 'YYYY-MM-DD')).toBe('2026-09-01')
    expect(formatDateText('2026-09-01T18:30', 'DD.MM.YYYY HH:mm')).toBe('01.09.2026 18:30')
    expect(formatDateText('2026-09-01', 'DD.MM.YYYY HH:mm')).toBe('01.09.2026')
    expect(formatDateText('2026-09-01T18:30', 'DD.MM.YYYY')).toBe('01.09.2026')
  })
})

describe.each(ZONES)('границы со смещением зоны, TZ=%s', (tz) => {
  beforeEach(() => { vi.stubEnv('TZ', tz) })
  afterEach(() => { vi.unstubAllEnvs() })
  it('день и минута не сдвигаются, смещение — на эту минуту', () => {
    expect(isoDayStart('2026-09-01').slice(0, 19)).toBe('2026-09-01T00:00:00')
    expect(isoDayEnd('2026-09-01').slice(0, 19)).toBe('2026-09-01T23:59:59')
    expect(isoMinuteStart('2026-09-01T18:30').slice(0, 19)).toBe('2026-09-01T18:30:00')
    expect(isoMinuteEnd('2026-09-01T18:30').slice(0, 19)).toBe('2026-09-01T18:30:59')
    expect(isoDayStart('2026-09-01')).toMatch(/[+-]\d\d:\d\d$/)
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(formatDateText('2026-09-01', 'DD.MM.YYYY')).toBe('01.09.2026')
  })
})

describe('переход на летнее время (America/New_York, 08.03.2026)', () => {
  beforeEach(() => { vi.stubEnv('TZ', 'America/New_York') })
  afterEach(() => { vi.unstubAllEnvs() })
  it('смещение берётся на минуту границы, а не на полночь', () => {
    expect(isoDayStart('2026-03-08')).toBe('2026-03-08T00:00:00-05:00')
    expect(isoDayEnd('2026-03-08')).toBe('2026-03-08T23:59:59-04:00')
  })
})
```

Run: `pnpm --filter @katran/ui exec vitest run src/date/dateStr.test.ts` → FAIL (модуля нет).

- [ ] **Step 3: Реализация.** `packages/ui/src/date/dateStr.ts`:

```ts
/** Даты как строки (спека 2026-09-30 §3): ISO-строки не разбираются через new Date(string) — разбор строки без зоны
 * браузер трактует как UTC и сдвигает день в западных зонах. Арифметика — число дней от эпохи (алгоритм Хиннанта). */
export type IsoDay = string
export type IsoMinute = string
export type DateValue = IsoDay | IsoMinute | ''
export type DateFormat = string

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MIN_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const p2 = (n: number) => String(n).padStart(2, '0')
const p4 = (n: number) => String(n).padStart(4, '0')
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export const daysInMonth = (y: number, m: number): number => (m === 2 && isLeap(y) ? 29 : MONTH_DAYS[m - 1]!)
export const makeDay = (y: number, m: number, d: number): IsoDay => `${p4(y)}-${p2(m)}-${p2(d)}`

export function isValidDay(s: string): boolean {
  const m = DAY_RE.exec(s)
  if (!m) return false
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3])
  return y >= 1 && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo)
}
export function isValidMinute(s: string): boolean {
  const m = MIN_RE.exec(s)
  return m !== null && isValidDay(`${m[1]}-${m[2]}-${m[3]}`) && Number(m[4]) <= 23 && Number(m[5]) <= 59
}

const split = (day: IsoDay): [number, number, number] => [Number(day.slice(0, 4)), Number(day.slice(5, 7)), Number(day.slice(8, 10))]

function toDays(y0: number, m: number, d: number): number {
  const y = m <= 2 ? y0 - 1 : y0
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}
function fromDays(z0: number): [number, number, number] {
  const z = z0 + 719468
  const era = Math.floor(z / 146097)
  const doe = z - era * 146097
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp = Math.floor((5 * doy + 2) / 153)
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1
  const m = mp < 10 ? mp + 3 : mp - 9
  return [yoe + era * 400 + (m <= 2 ? 1 : 0), m, d]
}

export const dayOf = (v: IsoDay | IsoMinute): IsoDay => v.slice(0, 10)
/** 'чч:мм' у IsoMinute, '' у IsoDay. */
export const timeOf = (v: IsoDay | IsoMinute): string => (v.length > 10 ? v.slice(11, 16) : '')
export function addDays(day: IsoDay, n: number): IsoDay {
  const [y, m, d] = split(day)
  return makeDay(...fromDays(toDays(y, m, d) + n))
}
/** Сдвиг на месяцы; день, которого нет в целевом месяце, становится последним днём месяца (31.01 + 1 → 28/29.02). */
export function addMonths(day: IsoDay, n: number): IsoDay {
  const [y, m, d] = split(day)
  const t = y * 12 + (m - 1) + n
  const ny = Math.floor(t / 12)
  const nm = t - ny * 12 + 1
  return makeDay(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}
export const startOfMonth = (day: IsoDay): IsoDay => `${day.slice(0, 8)}01`
export function endOfMonth(day: IsoDay): IsoDay {
  const [y, m] = split(day)
  return makeDay(y, m, daysInMonth(y, m))
}
/** День недели: понедельник = 1 … воскресенье = 7. 1970-01-01 — четверг. */
export function weekday(day: IsoDay): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const [y, m, d] = split(day)
  const z = toDays(y, m, d)
  return ((((z + 3) % 7) + 7) % 7 + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7
}
/** 42 дня: 6 недель с понедельника, начиная с недели, где 1-е число месяца. */
export function monthGrid(month: IsoDay): IsoDay[] {
  const first = startOfMonth(month)
  const start = addDays(first, 1 - weekday(first))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}
/** Сегодня по локальным часам машины. */
export function todayLocal(): IsoDay {
  const d = new Date()
  return makeDay(d.getFullYear(), d.getMonth() + 1, d.getDate())
}
export const compareDates = (a: IsoDay | IsoMinute, b: IsoDay | IsoMinute): -1 | 0 | 1 => (a < b ? -1 : a > b ? 1 : 0)

// --- формат-шаблон: токены DD MM YYYY HH mm и любые разделители между ними ---
const TOKENS = /YYYY|DD|MM|HH|mm/g
type Part = { tok: 'YYYY' | 'DD' | 'MM' | 'HH' | 'mm' } | { sep: string }
function partsOf(format: DateFormat): Part[] {
  const out: Part[] = []
  let last = 0
  for (const m of format.matchAll(TOKENS)) {
    if (m.index! > last) out.push({ sep: format.slice(last, m.index) })
    out.push({ tok: m[0] as 'YYYY' | 'DD' | 'MM' | 'HH' | 'mm' })
    last = m.index! + m[0].length
  }
  if (last < format.length) out.push({ sep: format.slice(last) })
  return out
}
/** Часть шаблона до времени: 'DD.MM.YYYY HH:mm' → 'DD.MM.YYYY'. */
export function datePartOf(format: DateFormat): DateFormat {
  const i = format.indexOf('HH')
  return i < 0 ? format : format.slice(0, i).replace(/[^A-Za-z]+$/, '')
}
/** Шаблон с временем или без: время дописывается как ' HH:mm', если его нет. */
export const withTime = (format: DateFormat, time: boolean): DateFormat =>
  (time ? (format.includes('HH') ? format : `${format} HH:mm`) : datePartOf(format))

/** Оставляет цифры и расставляет разделители шаблона по мере ввода; лишние цифры отбрасываются. */
export function maskDateText(text: string, format: DateFormat): string {
  const digits = text.replace(/\D/g, '')
  let i = 0
  let out = ''
  for (const p of partsOf(format)) {
    if (i >= digits.length) break
    if ('sep' in p) { out += p.sep; continue }
    const chunk = digits.slice(i, i + p.tok.length)
    out += chunk
    i += chunk.length
    if (chunk.length < p.tok.length) break
  }
  // разделитель в конце ставится, только если за ним уже пошли цифры
  return out.replace(/[^0-9]+$/, '')
}
/** Полная строка: вся дата по шаблону; если в шаблоне есть время — или без времени, или с ним целиком. */
export function isComplete(text: string, format: DateFormat): boolean {
  const dateLen = datePartOf(format).length
  return text.length === dateLen || text.length === format.length
}
/** Полная строка по шаблону → ISO; неполная или невалидная — null. */
export function parseDateText(text: string, format: DateFormat): IsoDay | IsoMinute | null {
  if (!isComplete(text, format)) return null
  const fmt = text.length === format.length ? format : datePartOf(format)
  const got: Record<string, string> = {}
  let i = 0
  for (const p of partsOf(fmt)) {
    if ('sep' in p) {
      if (text.slice(i, i + p.sep.length) !== p.sep) return null
      i += p.sep.length
      continue
    }
    const chunk = text.slice(i, i + p.tok.length)
    if (!/^\d+$/.test(chunk) || chunk.length !== p.tok.length) return null
    got[p.tok] = chunk
    i += p.tok.length
  }
  const day = `${got.YYYY}-${got.MM}-${got.DD}`
  if (got.HH === undefined) return isValidDay(day) ? day : null
  const minute = `${day}T${got.HH}:${got.mm}`
  return isValidMinute(minute) ? minute : null
}
/** ISO → строка по шаблону; у дня без времени часть шаблона со временем не выводится. */
export function formatDateText(value: IsoDay | IsoMinute, format: DateFormat): string {
  const fmt = value.length > 10 ? format : datePartOf(format)
  const [y, m, d] = split(value)
  const t = timeOf(value)
  return fmt.replace(TOKENS, (tok) => (tok === 'YYYY' ? p4(y) : tok === 'MM' ? p2(m) : tok === 'DD' ? p2(d) : tok === 'HH' ? t.slice(0, 2) : t.slice(3, 5)))
}

// --- границы со смещением зоны: смещение — на эту минуту (день перехода на летнее время — верно) ---
function offset(y: number, m: number, d: number, hh: number, mm: number): string {
  const o = -new Date(y, m - 1, d, hh, mm).getTimezoneOffset()
  const a = Math.abs(o)
  return `${o < 0 ? '-' : '+'}${p2(Math.floor(a / 60))}:${p2(a % 60)}`
}
function bound(minute: IsoMinute, sec: string): string {
  const [y, m, d] = split(minute)
  const hh = Number(minute.slice(11, 13)), mm = Number(minute.slice(14, 16))
  return `${minute}:${sec}${offset(y, m, d, hh, mm)}`
}
export const isoMinuteStart = (minute: IsoMinute): string => bound(minute, '00')
export const isoMinuteEnd = (minute: IsoMinute): string => bound(minute, '59')
export const isoDayStart = (day: IsoDay): string => isoMinuteStart(`${day}T00:00`)
export const isoDayEnd = (day: IsoDay): string => isoMinuteEnd(`${day}T23:59`)
```

`matchAll` есть в Chromium 73+ — допустим.

- [ ] **Step 4: Пресеты и словари.** `packages/ui/src/date/ruNames.ts`:

```ts
/** Названия по-русски — словарь кита (Intl.DateTimeFormat не используется: Chromium 88, единый вид). */
export const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
export const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
export const WEEKDAYS_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
```

`packages/ui/src/date/presets.ts`:

```ts
import { addDays, addMonths, endOfMonth, startOfMonth, type IsoDay } from './dateStr'

/** Пресет периода — целые дни относительно «сегодня» (спека §3.4). */
export type DatePreset = { id: string; label: string; range: (today: IsoDay) => { from: IsoDay; to: IsoDay } }

export const PRESET_TODAY: DatePreset = { id: 'today', label: 'Сегодня', range: (t) => ({ from: t, to: t }) }
export const PRESET_YESTERDAY: DatePreset = { id: 'yesterday', label: 'Вчера', range: (t) => ({ from: addDays(t, -1), to: addDays(t, -1) }) }
export const PRESET_LAST3: DatePreset = { id: 'last3', label: '3 дня', range: (t) => ({ from: addDays(t, -2), to: t }) }
export const PRESET_LAST7: DatePreset = { id: 'last7', label: '7 дней', range: (t) => ({ from: addDays(t, -6), to: t }) }
export const PRESET_LAST30: DatePreset = { id: 'last30', label: '30 дней', range: (t) => ({ from: addDays(t, -29), to: t }) }
export const PRESET_THIS_MONTH: DatePreset = { id: 'thisMonth', label: 'Текущий месяц', range: (t) => ({ from: startOfMonth(t), to: t }) }
export const PRESET_LAST_MONTH: DatePreset = {
  id: 'lastMonth', label: 'Прошлый месяц',
  range: (t) => { const p = addMonths(startOfMonth(t), -1); return { from: p, to: endOfMonth(p) } },
}

/** Горячие кнопки под полем периода по умолчанию. */
export const QUICK_PRESETS: DatePreset[] = [PRESET_TODAY, PRESET_YESTERDAY, PRESET_LAST3, PRESET_LAST7]
/** Список пресетов в поповере периода по умолчанию. */
export const DEFAULT_PRESETS: DatePreset[] = [PRESET_TODAY, PRESET_YESTERDAY, PRESET_LAST3, PRESET_LAST7, PRESET_LAST30, PRESET_THIS_MONTH, PRESET_LAST_MONTH]

/** Период совпадает с пресетом на этот «сегодня» (значения — дни без времени). */
export function presetMatches(p: DatePreset, today: IsoDay, value: { from: string; to: string }): boolean {
  const r = p.range(today)
  return value.from === r.from && value.to === r.to
}
```

`packages/ui/src/date/presets.test.ts`:

```ts
import { DEFAULT_PRESETS, PRESET_LAST3, PRESET_LAST7, PRESET_LAST_MONTH, PRESET_THIS_MONTH, PRESET_YESTERDAY, QUICK_PRESETS, presetMatches } from './presets'

describe('пресеты периода', () => {
  const t = '2026-03-02'
  it('считают сегодняшний день и предыдущие', () => {
    expect(PRESET_YESTERDAY.range(t)).toEqual({ from: '2026-03-01', to: '2026-03-01' })
    expect(PRESET_LAST3.range(t)).toEqual({ from: '2026-02-28', to: '2026-03-02' })
    expect(PRESET_LAST7.range(t)).toEqual({ from: '2026-02-24', to: '2026-03-02' })
    expect(PRESET_THIS_MONTH.range(t)).toEqual({ from: '2026-03-01', to: '2026-03-02' })
    expect(PRESET_LAST_MONTH.range(t)).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
  it('состав списков по умолчанию', () => {
    expect(QUICK_PRESETS.map((p) => p.label)).toEqual(['Сегодня', 'Вчера', '3 дня', '7 дней'])
    expect(DEFAULT_PRESETS.map((p) => p.id)).toEqual(['today', 'yesterday', 'last3', 'last7', 'last30', 'thisMonth', 'lastMonth'])
  })
  it('совпадение значения с пресетом', () => {
    expect(presetMatches(PRESET_LAST3, t, { from: '2026-02-28', to: '2026-03-02' })).toBe(true)
    expect(presetMatches(PRESET_LAST3, t, { from: '2026-02-28', to: '' })).toBe(false)
  })
})
```

`packages/ui/src/date/index.ts`:

```ts
export * from './dateStr'
export * from './presets'
```

В `packages/ui/src/index.ts` после `export * from './format'` добавить `export * from './date'`. Проверить, что имена не конфликтуют с `format/` (`formatDate`, `formatDateTimeShort`, `formatDateTimeFull` — другие имена; `dayOf`/`timeOf` в `format/` нет): `grep -rn "export.*\b\(dayOf\|timeOf\|makeDay\|addDays\)\b" packages/ui/src` — только `date/`.

- [ ] **Step 5: Прогон.** `pnpm --filter @katran/ui exec vitest run src/date` → PASS (если `vi.stubEnv('TZ', …)` не меняет зону в этой версии Node — заменить на `process.env.TZ = tz` в `beforeEach` и вернуть исходное в `afterEach`; так уже сделано в тестах `format/date.test.ts` плана 4 — посмотреть и повторить их способ). `pnpm check` → зелёный.

- [ ] **Step 6: Commit** — `Даты: помощники над строками без зоны, формат-шаблон, пресеты периода, токены полей ввода`.

---

### Task 2: `Calendar`

**Files:**
- Create: `packages/ui/src/date/Calendar.tsx`, `packages/ui/src/date/Calendar.test.tsx`, `packages/ui/src/date/Date.module.css`
- Modify: `packages/ui/src/date/index.ts`

**Interfaces:**
- Consumes: `dateStr`, `ruNames` (Task 1), `IconButton` (`packages/ui/src/button`).
- Produces: `Calendar`, `CalendarProps` (спека §3.3): `{ month; onMonthChange; value?; range?; onPick; min?; max?; today?; label?; autoFocus?; onHoverDay? }`.

- [ ] **Step 1: Тест.** `packages/ui/src/date/Calendar.test.tsx`:

```tsx
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Calendar } from './Calendar'
import type { IsoDay } from './dateStr'

function Host({ start = '2026-09-15', min, onPick = () => {} }: { start?: IsoDay; min?: IsoDay; onPick?: (d: IsoDay) => void }) {
  const [month, setMonth] = useState<IsoDay>(start)
  const [value, setValue] = useState<IsoDay | ''>(start)
  return <Calendar month={month} onMonthChange={setMonth} value={value} min={min} today="2026-09-23" onPick={(d) => { setValue(d); onPick(d) }} />
}

describe('Calendar', () => {
  it('сетка месяца: имя, дни недели, 42 дня, сегодня, выбранный', async () => {
    const { container } = renderK(<Host />)
    const grid = screen.getByRole('grid', { name: 'Сентябрь 2026' })
    expect(grid.querySelectorAll('th')).toHaveLength(7)
    expect(grid.querySelectorAll('button[data-day]')).toHaveLength(42)
    expect(screen.getByRole('button', { name: '23 сентября 2026, среда' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: '15 сентября 2026, вторник' }).closest('td')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: '15 сентября 2026, вторник' })).toHaveAttribute('tabindex', '0')
    expect(await axe(container)).toHaveNoViolations()
  })
  it('клик выбирает день; день вне min не выбирается', async () => {
    const u = userEvent.setup()
    const onPick = vi.fn()
    renderK(<Host min="2026-09-10" onPick={onPick} />)
    await u.click(screen.getByRole('button', { name: '20 сентября 2026, воскресенье' }))
    expect(onPick).toHaveBeenCalledWith('2026-09-20')
    const early = screen.getByRole('button', { name: '5 сентября 2026, суббота' })
    expect(early).toHaveAttribute('aria-disabled', 'true')
    await u.click(early)
    expect(onPick).toHaveBeenCalledTimes(1)
  })
  it('клавиатура: стрелки, край месяца листает, PgDn, Shift+PgUp, Home/End, Enter', async () => {
    const u = userEvent.setup()
    const onPick = vi.fn()
    renderK(<Host start="2026-09-29" onPick={onPick} />)
    screen.getByRole('button', { name: /^29 сентября/ }).focus()
    await u.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('grid', { name: 'Октябрь 2026' })).toBeInTheDocument()
    expect(document.activeElement).toHaveAccessibleName('1 октября 2026, четверг')
    await u.keyboard('{ArrowDown}')
    expect(document.activeElement).toHaveAccessibleName('8 октября 2026, четверг')
    await u.keyboard('{Home}')
    expect(document.activeElement).toHaveAccessibleName('5 октября 2026, понедельник')
    await u.keyboard('{End}')
    expect(document.activeElement).toHaveAccessibleName('11 октября 2026, воскресенье')
    await u.keyboard('{PageDown}')
    expect(screen.getByRole('grid', { name: 'Ноябрь 2026' })).toBeInTheDocument()
    await u.keyboard('{Shift>}{PageUp}{/Shift}')
    expect(screen.getByRole('grid', { name: 'Ноябрь 2025' })).toBeInTheDocument()
    await u.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith('2025-11-11')
  })
  it('кнопки месяцев листают', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.click(screen.getByRole('button', { name: 'Следующий месяц' }))
    expect(screen.getByRole('grid', { name: 'Октябрь 2026' })).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Предыдущий месяц' }))
    await u.click(screen.getByRole('button', { name: 'Предыдущий месяц' }))
    expect(screen.getByRole('grid', { name: 'Август 2026' })).toBeInTheDocument()
  })
  it('диапазон: края и середина отмечены', () => {
    renderK(<Calendar month="2026-09-01" onMonthChange={() => {}} range={{ from: '2026-09-10', to: '2026-09-12' }} onPick={() => {}} today="2026-09-23" />)
    expect(screen.getByRole('button', { name: /^10 сентября/ })).toHaveAttribute('data-edge', 'true')
    expect(screen.getByRole('button', { name: /^11 сентября/ })).toHaveAttribute('data-in', 'true')
    expect(screen.getByRole('button', { name: /^12 сентября/ })).toHaveAttribute('data-edge', 'true')
    expect(screen.getByRole('button', { name: /^13 сентября/ })).not.toHaveAttribute('data-in')
  })
})
```

Run: `pnpm --filter @katran/ui exec vitest run src/date/Calendar.test.tsx` → FAIL.

- [ ] **Step 2: Реализация.** `packages/ui/src/date/Calendar.tsx`:

```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { IconButton } from '../button'
import { addDays, addMonths, monthGrid, startOfMonth, todayLocal, weekday, type IsoDay } from './dateStr'
import { MONTHS, MONTHS_GEN, WEEKDAYS_FULL, WEEKDAYS_SHORT } from './ruNames'
import s from './Date.module.css'

export type CalendarProps = {
  /** Любой день показываемого месяца. */
  month: IsoDay
  onMonthChange: (month: IsoDay) => void
  value?: IsoDay | '' | undefined
  /** Подсветка диапазона: края — заливка, середина — val-soft. */
  range?: { from: IsoDay | ''; to: IsoDay | '' } | undefined
  onPick: (day: IsoDay) => void
  min?: IsoDay | undefined
  max?: IsoDay | undefined
  /** По умолчанию todayLocal(); проп — для тестов. */
  today?: IsoDay | undefined
  /** Доступное имя сетки; по умолчанию месяц и год: «Сентябрь 2026». */
  label?: string | undefined
  /** При монтировании фокус на выбранный или сегодняшний день (поповер дат). */
  autoFocus?: boolean | undefined
  /** Наведение на день — DateRange подсвечивает будущий диапазон; null — курсор ушёл с сетки. */
  onHoverDay?: ((day: IsoDay | null) => void) | undefined
}

const Prev = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
const Next = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 3.5 10.5 8 6 12.5" /></svg>

const monthOf = (d: IsoDay) => d.slice(0, 7)
const dayLabel = (d: IsoDay) => `${Number(d.slice(8, 10))} ${MONTHS_GEN[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}, ${WEEKDAYS_FULL[weekday(d) - 1]}`

/** Сетка месяца по паттерну APG Date Picker: один таб-стоп, стрелки, Home/End, PgUp/PgDn (Shift — год), Enter/Space. */
export function Calendar({ month, onMonthChange, value, range, onPick, min, max, today, label, autoFocus, onHoverDay }: CalendarProps) {
  const t = today ?? todayLocal()
  const first = startOfMonth(month)
  const days = monthGrid(first)
  const title = `${MONTHS[Number(first.slice(5, 7)) - 1]} ${first.slice(0, 4)}`
  const inMonth = (d: IsoDay) => monthOf(d) === monthOf(first)
  const off = (d: IsoDay) => (min !== undefined && d < min) || (max !== undefined && d > max)
  const anchor = value || range?.from || t
  const [focused, setFocused] = useState<IsoDay>(anchor)
  // активный день всегда в показанном месяце: после листания кнопками — выбранный, иначе 1-е число
  const active = inMonth(focused) ? focused : inMonth(anchor) ? anchor : first
  const grid = useRef<HTMLTableElement>(null)
  const wantFocus = useRef(autoFocus === true)

  useEffect(() => {
    if (!wantFocus.current) return
    wantFocus.current = false
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${active}"]`)?.focus()
  }, [active])

  const moveTo = (d: IsoDay) => {
    wantFocus.current = true
    setFocused(d)
    if (!inMonth(d)) onMonthChange(startOfMonth(d))
  }
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const w = weekday(active)
    const step: Record<string, IsoDay | undefined> = {
      ArrowLeft: addDays(active, -1), ArrowRight: addDays(active, 1), ArrowUp: addDays(active, -7), ArrowDown: addDays(active, 7),
      Home: addDays(active, 1 - w), End: addDays(active, 7 - w),
      PageUp: addMonths(active, e.shiftKey ? -12 : -1), PageDown: addMonths(active, e.shiftKey ? 12 : 1),
    }
    const next = step[e.key]
    if (next !== undefined) { e.preventDefault(); moveTo(next); return }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!off(active)) onPick(active) }
  }

  const from = range?.from ?? ''
  const to = range?.to ?? ''
  return (
    <div className={s.cal}>
      <div className={s.calHead}>
        <IconButton size="s" label="Предыдущий месяц" onClick={() => onMonthChange(addMonths(first, -1))}><Prev /></IconButton>
        <span className={s.calTitle} aria-live="polite">{title}</span>
        <IconButton size="s" label="Следующий месяц" onClick={() => onMonthChange(addMonths(first, 1))}><Next /></IconButton>
      </div>
      <table ref={grid} role="grid" aria-label={label ?? title} className={s.grid} onMouseLeave={() => onHoverDay?.(null)}>
        <thead>
          <tr>{WEEKDAYS_SHORT.map((w, i) => <th key={w} scope="col" abbr={WEEKDAYS_FULL[i]} className={s.wd}>{w}</th>)}</tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((r) => (
            <tr key={r}>
              {days.slice(r * 7, r * 7 + 7).map((d) => {
                const edge = d === value || d === from || d === to
                const inside = from !== '' && to !== '' && d > from && d < to
                return (
                  <td key={d} role="gridcell" aria-selected={edge} className={s.cell}>
                    <button
                      type="button"
                      data-day={d}
                      tabIndex={d === active ? 0 : -1}
                      aria-label={dayLabel(d)}
                      aria-current={d === t ? 'date' : undefined}
                      aria-disabled={off(d) || undefined}
                      data-out={!inMonth(d) || undefined}
                      data-today={d === t || undefined}
                      data-edge={edge || undefined}
                      data-in={inside || undefined}
                      className={s.day}
                      onClick={() => { if (off(d)) return; setFocused(d); onPick(d) }}
                      onKeyDown={onKey}
                      onMouseEnter={() => onHoverDay?.(d)}
                    >
                      {Number(d.slice(8, 10))}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

`data-*={flag || undefined}` в DOM даёт `data-edge="true"` — тест проверяет `'true'`.

- [ ] **Step 3: Стили.** `packages/ui/src/date/Date.module.css` (этот файл дополняют задачи 3 и 4):

```css
.cal {
  display: grid;
  gap: var(--k-sp-2);
  padding: var(--k-sp-1);
}

.calHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--k-sp-2);
}

.calTitle {
  font: 600 var(--k-fs-1) / var(--k-lh-1) var(--k-sans);
  color: var(--k-ink);
}

.grid {
  border-collapse: separate;
  border-spacing: 0;
}

.wd {
  width: var(--k-cal-cell);
  height: var(--k-cal-cell);
  padding: 0;
  font: 500 var(--k-fs-3) / 1 var(--k-sans);
  color: var(--k-muted);
  text-align: center;
}

.cell {
  padding: 0;
}

.day {
  display: grid;
  place-items: center;
  width: var(--k-cal-cell);
  height: var(--k-cal-cell);
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--k-r-s);
  background: none;
  font: 400 var(--k-fs-1) / 1 var(--k-sans);
  color: var(--k-ink);
  cursor: pointer;
}

/* порядок — по каскаду: наведение ниже отметок диапазона, чтобы выбранный день не терял заливку под курсором */
.day:hover {
  background: var(--k-hover);
}

.day:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: -2px;
}

/* дни соседних месяцев — muted (faint не для читаемого текста, contrast.rules) */
.day[data-out] {
  color: var(--k-muted);
}

.day[data-today] {
  border-color: var(--k-val);
}

.day[data-in] {
  border-radius: 0;
  background: var(--k-val-soft);
}

.day[data-edge] {
  background: var(--k-val);
  color: var(--k-paper);
}

.day[aria-disabled="true"] {
  background: none;
  color: var(--k-muted);
  cursor: default;
}
```

`packages/ui/src/date/index.ts` дополнить: `export { Calendar, type CalendarProps } from './Calendar'`.

- [ ] **Step 4: Прогон.** `pnpm --filter @katran/ui exec vitest run src/date` → PASS; `pnpm check` → зелёный.

- [ ] **Step 5: Commit** — `Calendar: сетка месяца по WAI-ARIA grid — клавиатура, листание, диапазон, min/max`.

---

### Task 3: `DateInput`, поле с маской, поле времени; `Popover` — возврат фокуса и роль `presentation`

**Files:**
- Modify: `packages/ui/src/overlay/Popover.tsx`, `packages/ui/src/overlay/Overlay.test.tsx`
- Create: `packages/ui/src/date/MaskedDateField.tsx`, `packages/ui/src/date/TimeField.tsx`, `packages/ui/src/date/DateInput.tsx`, `packages/ui/src/date/DateInput.test.tsx`
- Modify: `packages/ui/src/date/Date.module.css`, `packages/ui/src/date/index.ts`

**Interfaces:**
- Consumes: `Calendar` (Task 2), `dateStr`, `DatePreset` (Task 1), `Input.module.css` (классы `field`, `sizeS`, `sizeM`, `invalid`, `input`), `Button`, `IconButton`, `Popover`.
- Produces: `PopoverProps.role?: 'dialog' | 'menu' | 'presentation'`, `PopoverProps.returnFocus?: RefObject<HTMLElement | null>`; `DateInput`, `DateInputProps` (спека §3.5); внутренние `MaskedDateField` (forwardRef на `<input>`, пропы `value, onChange, format, min?, max?, onInvalidChange?, id?, aria-label?, placeholder?, disabled?, className?`), `TimeField` (`value: 'чч:мм' | ''`, `onChange`, `label`), `placeholderOf(format)`.

- [ ] **Step 1: `Popover`.** В `packages/ui/src/overlay/Popover.tsx`:
  - в `PopoverProps` тип `role` → `'dialog' | 'menu' | 'presentation' | undefined` с JSDoc «presentation — всплывающий список комбобокса: роль несёт сам `listbox` внутри»;
  - новый проп `/** Куда вернуть фокус при закрытии; по умолчанию anchor (для полей с обёрткой-якорем — само поле). */ returnFocus?: RefObject<HTMLElement | null> | undefined`;
  - в эффекте фокуса: `const returnTo = (returnFocus ?? anchor).current`; в зависимости эффекта добавить `returnFocus` и `role`;
  - при `role === 'presentation'` эффект фокуса не делает ничего — ни переноса внутрь, ни возврата: фокус всё время в поле комбобокса, а возврат при закрытии по Tab вернул бы фокус из следующего поля обратно;
  - в разметке: `role={role}` и `aria-label={role === 'presentation' ? undefined : label}`.

В `Overlay.test.tsx` добавить тесты: `Popover` с `anchor` на `<span>` и `returnFocus` на `<input>` — после Escape фокус на `<input>`; с `role="presentation"` у панели нет `aria-label` и роли `dialog` (`screen.queryByRole('dialog')` — null), а при закрытии фокус остаётся там, где был (фокус на кнопке вне поповера, `open` → `false` — `document.activeElement` — та же кнопка).

- [ ] **Step 2: Тест `DateInput`.** `packages/ui/src/date/DateInput.test.tsx`:

```tsx
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { DateInput, type DateInputProps } from './DateInput'
import type { DateValue } from './dateStr'
import { PRESET_TODAY, PRESET_YESTERDAY } from './presets'

function Host({ initial = '', onValue = () => {}, ...p }: Partial<DateInputProps> & { initial?: DateValue; onValue?: (v: DateValue) => void }) {
  const [v, setV] = useState<DateValue>(initial)
  return <DateInput aria-label="Дата" today="2026-09-23" {...p} value={v} onChange={(x) => { setV(x); onValue(x) }} />
}

describe('DateInput', () => {
  it('маска по шаблону: полная валидная дата уходит ISO, неполная — пусто без подсветки', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Дата' })
    expect(input).toHaveAttribute('placeholder', 'дд.мм.гггг')
    await u.type(input, '0109')
    expect(input).toHaveValue('01.09')
    expect(input).not.toHaveAttribute('aria-invalid')
    await u.type(input, '2026')
    expect(input).toHaveValue('01.09.2026')
    expect(onValue).toHaveBeenLastCalledWith('2026-09-01')
  })
  it('невалидная полная дата — поле invalid, наружу пусто', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host initial="2026-09-01" onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Дата' })
    await u.clear(input)
    await u.type(input, '31022026')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onValue).toHaveBeenLastCalledWith('')
  })
  it('формат YYYY-MM-DD и время необязательно', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host format="YYYY-MM-DD" time initial="2026-09-01T18:30" onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Дата' })
    expect(input).toHaveValue('2026-09-01 18:30')
    await u.clear(input)
    await u.type(input, '20260902')
    expect(onValue).toHaveBeenLastCalledWith('2026-09-02')
    await u.type(input, '0915')
    expect(onValue).toHaveBeenLastCalledWith('2026-09-02T09:15')
  })
  it('календарь: выбор дня ставит значение, закрывает поповер и возвращает фокус в поле', async () => {
    const u = userEvent.setup()
    renderK(<Host initial="2026-09-01" />)
    await u.click(screen.getByRole('button', { name: 'Выбрать дату' }))
    const dialog = screen.getByRole('dialog', { name: 'Выбор даты' })
    expect(document.activeElement).toHaveAccessibleName('1 сентября 2026, вторник')
    await u.click(screen.getByRole('button', { name: /^15 сентября/ }))
    expect(dialog).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Дата' })).toHaveValue('15.09.2026')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Дата' }))
  })
  it('календарь со временем: день, время, «Готово»', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host time onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: 'Выбрать дату' }))
    await u.click(screen.getByRole('button', { name: /^15 сентября/ }))
    await u.type(screen.getByRole('textbox', { name: 'Время' }), '0930')
    expect(onValue).toHaveBeenLastCalledWith('2026-09-15T09:30')
    await u.click(screen.getByRole('button', { name: 'Готово' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('горячие кнопки: ставят день, отмеченная — снимает', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host quick={[PRESET_TODAY, PRESET_YESTERDAY]} onValue={onValue} />)
    const group = screen.getByRole('group', { name: 'Быстрый выбор' })
    await u.click(screen.getByRole('button', { name: 'Вчера' }))
    expect(onValue).toHaveBeenLastCalledWith('2026-09-22')
    expect(screen.getByRole('button', { name: 'Вчера' })).toHaveAttribute('aria-pressed', 'true')
    await u.click(screen.getByRole('button', { name: 'Вчера' }))
    expect(onValue).toHaveBeenLastCalledWith('')
    expect(group).toBeInTheDocument()
  })
  it('min: дата раньше — invalid', async () => {
    const u = userEvent.setup()
    renderK(<Host min="2026-09-10" />)
    await u.type(screen.getByRole('textbox', { name: 'Дата' }), '01092026')
    expect(screen.getByRole('textbox', { name: 'Дата' })).toHaveAttribute('aria-invalid', 'true')
  })
  it('axe: закрыт и открыт', async () => {
    const u = userEvent.setup()
    const { container } = renderK(<Host initial="2026-09-01" time quick={[PRESET_TODAY]} />)
    expect(await axe(container)).toHaveNoViolations()
    await u.click(screen.getByRole('button', { name: 'Выбрать дату' }))
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
```

Run → FAIL.

- [ ] **Step 3: Поле с маской и поле времени.** `packages/ui/src/date/MaskedDateField.tsx`:

```tsx
import { forwardRef, useEffect, useRef, useState } from 'react'
import { dayOf, formatDateText, isComplete, maskDateText, parseDateText, type DateFormat, type DateValue, type IsoDay } from './dateStr'

/** Подсказка формата: 'DD.MM.YYYY HH:mm' → 'дд.мм.гггг чч:мм'. */
export const placeholderOf = (format: DateFormat): string =>
  format.replace(/YYYY|DD|MM|HH|mm/g, (t) => ({ YYYY: 'гггг', DD: 'дд', MM: 'мм', HH: 'чч', mm: 'мм' })[t]!)

export type MaskedDateFieldProps = {
  value: DateValue
  onChange: (value: DateValue) => void
  format: DateFormat
  min?: IsoDay | undefined
  max?: IsoDay | undefined
  /** Полное, но невалидное или вне min/max — родитель подсвечивает рамку (без :has — Chromium 88). */
  onInvalidChange?: ((invalid: boolean) => void) | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
  placeholder?: string | undefined
  disabled?: boolean | undefined
  className?: string | undefined
}

/** Текстовое поле даты по шаблону. Показывает набираемое, пока значение снаружи совпадает с тем, что поле само отдало;
 * внешняя смена значения перерисовывает текст из значения (как у числового поля панели, спека 1e §6.2). */
export const MaskedDateField = forwardRef<HTMLInputElement, MaskedDateFieldProps>(function MaskedDateField(
  { value, onChange, format, min, max, onInvalidChange, id, placeholder, disabled, className, ...aria }, ref,
) {
  const [typed, setTyped] = useState<{ text: string; snap: DateValue } | null>(null)
  const text = typed !== null && typed.snap === value ? typed.text : value ? formatDateText(value, format) : ''
  const inRange = (v: string) => (min === undefined || dayOf(v) >= min) && (max === undefined || dayOf(v) <= max)
  const parsed = parseDateText(text, format)
  const invalid = text !== '' && isComplete(text, format) && (parsed === null || !inRange(parsed))

  const report = useRef(onInvalidChange)
  useEffect(() => { report.current = onInvalidChange })
  useEffect(() => { report.current?.(invalid) }, [invalid])

  return (
    <input
      ref={ref}
      id={id}
      aria-label={aria['aria-label']}
      aria-invalid={invalid || undefined}
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder ?? placeholderOf(format)}
      disabled={disabled}
      className={className}
      value={text}
      onChange={(e) => {
        const masked = maskDateText(e.target.value, format)
        const p = parseDateText(masked, format)
        const next: DateValue = p !== null && inRange(p) ? p : ''
        setTyped({ text: masked, snap: next })
        if (next !== value) onChange(next)
      }}
    />
  )
})
```

`packages/ui/src/date/TimeField.tsx`:

```tsx
import { useState } from 'react'
import { Input } from '../input'
import { maskDateText } from './dateStr'

const valid = (t: string) => /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) <= 23 && Number(t.slice(3)) <= 59

/** Время 'чч:мм' в поповере дат: неполное или невалидное — наружу ''. */
export function TimeField({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [typed, setTyped] = useState<{ text: string; snap: string } | null>(null)
  const text = typed !== null && typed.snap === value ? typed.text : value
  return (
    <Input
      size="s"
      aria-label={label}
      placeholder="чч:мм"
      inputMode="numeric"
      invalid={text.length === 5 && !valid(text)}
      value={text}
      onChange={(e) => {
        const masked = maskDateText(e.target.value, 'HH:mm')
        const next = valid(masked) ? masked : ''
        setTyped({ text: masked, snap: next })
        if (next !== value) onChange(next)
      }}
    />
  )
}
```

`maskDateText` с шаблоном `HH:mm` работает — токены любые (Task 1).

- [ ] **Step 4: `DateInput`.** `packages/ui/src/date/DateInput.tsx`:

```tsx
import { useRef, useState } from 'react'
import { Button, IconButton } from '../button'
import { Popover } from '../overlay'
import is from '../input/Input.module.css'
import { Calendar } from './Calendar'
import { dayOf, timeOf, todayLocal, withTime, type DateFormat, type DateValue, type IsoDay } from './dateStr'
import { MaskedDateField } from './MaskedDateField'
import type { DatePreset } from './presets'
import { TimeField } from './TimeField'
import s from './Date.module.css'

export type DateInputProps = {
  value: DateValue
  onChange: (value: DateValue) => void
  /** Разрешить время; по умолчанию false. */
  time?: boolean | undefined
  /** Шаблон: 'DD.MM.YYYY' (по умолчанию), 'YYYY-MM-DD', 'DD/MM/YYYY'…; при time дописывается ' HH:mm'. */
  format?: DateFormat | undefined
  /** Горячие кнопки под полем; кнопка ставит `from` пресета. По умолчанию нет. */
  quick?: DatePreset[] | undefined
  min?: IsoDay | undefined
  max?: IsoDay | undefined
  today?: IsoDay | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
  placeholder?: string | undefined
}

export const CalIcon = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>

/** Одна дата или дата со временем: маска по шаблону, календарь в поповере, горячие кнопки (спека §3.5). */
export function DateInput({ value, onChange, time = false, format = 'DD.MM.YYYY', quick, min, max, today, disabled, size = 'm', id, placeholder, ...aria }: DateInputProps) {
  const fmt = withTime(format, time)
  const t = today ?? todayLocal()
  const anchor = useRef<HTMLSpanElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<IsoDay>(value ? dayOf(value) : t)
  const [invalid, setInvalid] = useState(false)

  const toggle = () => { if (open) { setOpen(false); return } setMonth(value ? dayOf(value) : t); setOpen(true) }
  const pickDay = (d: IsoDay) => {
    if (!time) { onChange(d); setOpen(false); return }
    const tm = value ? timeOf(value) : ''
    onChange(tm ? `${d}T${tm}` : d)
  }
  const setTime = (tm: string) => {
    if (!value) return
    onChange(tm ? `${dayOf(value)}T${tm}` : dayOf(value))
  }

  return (
    <span className={s.dateBox}>
      <span ref={anchor} className={[is.field, size === 's' ? is.sizeS : is.sizeM, invalid ? is.invalid : '', s.dateField].filter(Boolean).join(' ')}>
        <MaskedDateField
          ref={input} id={id} aria-label={aria['aria-label']} value={value} onChange={onChange} format={fmt}
          min={min} max={max} placeholder={placeholder} disabled={disabled} className={is.input} onInvalidChange={setInvalid}
        />
        <IconButton size="s" label="Выбрать дату" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} className={s.calBtn} onClick={toggle}><CalIcon /></IconButton>
      </span>
      {quick && quick.length > 0 && (
        <span role="group" aria-label="Быстрый выбор" className={s.quick}>
          {quick.map((p) => {
            const d = p.range(t).from
            const on = value === d
            return <Button key={p.id} size="s" pressed={on} disabled={disabled} onClick={() => onChange(on ? '' : d)}>{p.label}</Button>
          })}
        </span>
      )}
      <Popover open={open} anchor={anchor} returnFocus={input} onClose={() => setOpen(false)} label="Выбор даты" manualFocus>
        <Calendar month={month} onMonthChange={setMonth} value={value ? dayOf(value) : ''} onPick={pickDay} min={min} max={max} today={t} autoFocus />
        {time && (
          <div className={s.timeRow}>
            <TimeField label="Время" value={value ? timeOf(value) : ''} onChange={setTime} />
            <Button size="s" variant="primary" onClick={() => setOpen(false)}>Готово</Button>
          </div>
        )}
      </Popover>
    </span>
  )
}
```

Если `IconButton` не пробрасывает `aria-haspopup`/`aria-expanded` (он принимает `ButtonProps` через `...rest` — проверить `packages/ui/src/button/IconButton.tsx`), атрибуты дойдут до `<button>`; иначе — добавить в `IconButton` проброс остальных пропов.

- [ ] **Step 5: Стили.** В конец `packages/ui/src/date/Date.module.css`:

```css
/* поле даты: обёртка для строки горячих кнопок под полем */
.dateBox {
  display: inline-grid;
  gap: var(--k-sp-1);
  min-width: 0;
}

.dateField {
  padding-right: 0;
}

.calBtn {
  flex: none;
  color: var(--k-muted);
}

.quick {
  display: flex;
  flex-wrap: wrap;
  gap: var(--k-sp-1);
}

.timeRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--k-sp-2);
  padding: var(--k-sp-1);
  border-top: 1px solid var(--k-line);
}
```

`packages/ui/src/date/index.ts`: `export { DateInput, type DateInputProps } from './DateInput'`.

- [ ] **Step 6: Прогон.** `pnpm --filter @katran/ui exec vitest run src/date src/overlay` → PASS без предупреждений `act`; `pnpm check` → зелёный.

- [ ] **Step 7: Commit** — `DateInput: маска по шаблону формата, время, календарь в поповере, горячие кнопки; Popover — returnFocus и роль presentation`.

---

### Task 4: `DateRange`

**Files:**
- Create: `packages/ui/src/date/DateRange.tsx`, `packages/ui/src/date/DateRange.test.tsx`
- Modify: `packages/ui/src/date/Date.module.css`, `packages/ui/src/date/index.ts`

**Interfaces:**
- Consumes: `Calendar`, `MaskedDateField`, `TimeField`, `CalIcon` (Task 2–3), `QUICK_PRESETS`, `DEFAULT_PRESETS`, `presetMatches` (Task 1).
- Produces: `DateRange`, `DateRangeProps`, `DateRangeValue = { from: DateValue; to: DateValue }` (спека §3.6).

- [ ] **Step 1: Тест.** `packages/ui/src/date/DateRange.test.tsx`:

```tsx
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { DateRange, type DateRangeProps, type DateRangeValue } from './DateRange'

const EMPTY: DateRangeValue = { from: '', to: '' }
function Host({ initial = EMPTY, onValue = () => {}, ...p }: Partial<DateRangeProps> & { initial?: DateRangeValue; onValue?: (v: DateRangeValue) => void }) {
  const [v, setV] = useState<DateRangeValue>(initial)
  return <DateRange label="Дата документа" today="2026-09-23" {...p} value={v} onChange={(x) => { setV(x); onValue(x) }} />
}

describe('DateRange', () => {
  it('два поля в группе; «по» раньше «с» — invalid, наружу только «с»', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    expect(screen.getByRole('group', { name: 'Дата документа' })).toBeInTheDocument()
    await u.type(screen.getByRole('textbox', { name: 'Дата документа, с' }), '10092026')
    await u.type(screen.getByRole('textbox', { name: 'Дата документа, по' }), '05092026')
    expect(screen.getByRole('textbox', { name: 'Дата документа, по' })).toHaveAttribute('aria-invalid', 'true')
    expect(onValue).toHaveBeenLastCalledWith({ from: '2026-09-10', to: '' })
  })
  it('горячие кнопки: «3 дня» — сегодня и два предыдущих, повторный клик снимает', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    const quick = screen.getByRole('group', { name: 'Быстрый период' })
    expect(quick).toHaveTextContent('Сегодня')
    await u.click(screen.getByRole('button', { name: '3 дня' }))
    expect(onValue).toHaveBeenLastCalledWith({ from: '2026-09-21', to: '2026-09-23' })
    expect(screen.getByRole('button', { name: '3 дня' })).toHaveAttribute('aria-pressed', 'true')
    await u.click(screen.getByRole('button', { name: '3 дня' }))
    expect(onValue).toHaveBeenLastCalledWith({ from: '', to: '' })
  })
  it('календарь: два клика в обратном порядке меняют границы местами и закрывают поповер', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: 'Выбрать период' }))
    await u.click(screen.getByRole('button', { name: /^10 сентября/ }))
    expect(onValue).toHaveBeenLastCalledWith({ from: '2026-09-10', to: '' })
    await u.hover(screen.getByRole('button', { name: /^7 сентября/ }))
    expect(screen.getByRole('button', { name: /^8 сентября/ })).toHaveAttribute('data-in', 'true')
    await u.click(screen.getByRole('button', { name: /^7 сентября/ }))
    expect(onValue).toHaveBeenLastCalledWith({ from: '2026-09-07', to: '2026-09-10' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('пресет в поповере ставит период и закрывает', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: 'Выбрать период' }))
    await u.click(screen.getByRole('button', { name: 'Прошлый месяц' }))
    expect(onValue).toHaveBeenLastCalledWith({ from: '2026-08-01', to: '2026-08-31' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('со временем: время границ и «Готово»; поля показывают время', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host time onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: 'Выбрать период' }))
    await u.click(screen.getByRole('button', { name: /^1 сентября/ }))
    await u.click(screen.getByRole('button', { name: /^3 сентября/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await u.type(screen.getByRole('textbox', { name: 'Время с' }), '0930')
    await u.type(screen.getByRole('textbox', { name: 'Время по' }), '1800')
    expect(onValue).toHaveBeenLastCalledWith({ from: '2026-09-01T09:30', to: '2026-09-03T18:00' })
    await u.click(screen.getByRole('button', { name: 'Готово' }))
    expect(screen.getByRole('textbox', { name: 'Дата документа, с' })).toHaveValue('01.09.2026 09:30')
  })
  it('без горячих кнопок и пресетов', async () => {
    const u = userEvent.setup()
    renderK(<Host quick={[]} presets={[]} />)
    expect(screen.queryByRole('group', { name: 'Быстрый период' })).not.toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Выбрать период' }))
    expect(screen.queryByRole('button', { name: 'Сегодня' })).not.toBeInTheDocument()
  })
  it('axe: закрыт и открыт', async () => {
    const u = userEvent.setup()
    const { container } = renderK(<Host initial={{ from: '2026-09-01', to: '2026-09-03' }} time />)
    expect(await axe(container)).toHaveNoViolations()
    await u.click(screen.getByRole('button', { name: 'Выбрать период' }))
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
```

Run → FAIL.

- [ ] **Step 2: Реализация.** `packages/ui/src/date/DateRange.tsx`:

```tsx
import { useRef, useState } from 'react'
import { Button, IconButton } from '../button'
import { Popover } from '../overlay'
import is from '../input/Input.module.css'
import { Calendar } from './Calendar'
import { CalIcon } from './DateInput'
import { dayOf, timeOf, todayLocal, withTime, type DateFormat, type DateValue, type IsoDay } from './dateStr'
import { MaskedDateField } from './MaskedDateField'
import { DEFAULT_PRESETS, QUICK_PRESETS, presetMatches, type DatePreset } from './presets'
import { TimeField } from './TimeField'
import s from './Date.module.css'

export type DateRangeValue = { from: DateValue; to: DateValue }
export type DateRangeProps = {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  time?: boolean | undefined
  format?: DateFormat | undefined
  /** Горячие кнопки под полем; по умолчанию QUICK_PRESETS; [] — без кнопок. */
  quick?: DatePreset[] | undefined
  /** Список в поповере; по умолчанию DEFAULT_PRESETS; [] — без списка. */
  presets?: DatePreset[] | undefined
  min?: IsoDay | undefined
  max?: IsoDay | undefined
  today?: IsoDay | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  /** Имя группы — название поля; поля получают «…, с» и «…, по». */
  label: string
}

const EMPTY: DateRangeValue = { from: '', to: '' }
const withDay = (v: DateValue, tm: string): DateValue => (v ? (tm ? `${dayOf(v)}T${tm}` : dayOf(v)) : v)

/** Период «с — по» (спека §3.6): поля по маске, календарь двумя кликами, пресеты, горячие кнопки под полем. */
export function DateRange({ value, onChange, time = false, format = 'DD.MM.YYYY', quick = QUICK_PRESETS, presets = DEFAULT_PRESETS, min, max, today, disabled, size = 'm', label }: DateRangeProps) {
  const fmt = withTime(format, time)
  const t = today ?? todayLocal()
  const anchor = useRef<HTMLSpanElement>(null)
  const fromInput = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<IsoDay>(value.from ? dayOf(value.from) : t)
  const [pending, setPending] = useState<IsoDay | null>(null)
  const [hover, setHover] = useState<IsoDay | null>(null)
  const [invFrom, setInvFrom] = useState(false)
  const [invTo, setInvTo] = useState(false)

  const fromDay = value.from ? dayOf(value.from) : ''
  const toDay = value.to ? dayOf(value.to) : ''
  const shown = pending === null
    ? { from: fromDay, to: toDay }
    : hover === null ? { from: pending, to: '' } : hover < pending ? { from: hover, to: pending } : { from: pending, to: hover }

  const close = () => { setOpen(false); setPending(null); setHover(null) }
  const toggle = () => { if (open) { close(); return } setMonth(fromDay || t); setOpen(true) }
  const pick = (d: IsoDay) => {
    if (pending === null) { setPending(d); onChange({ from: d, to: '' }); return }
    const [a, b] = d < pending ? [d, pending] : [pending, d]
    setPending(null)
    setHover(null)
    onChange({ from: a, to: b })
    if (!time) setOpen(false)
  }
  const applyPreset = (p: DatePreset) => { onChange(p.range(t)); close() }
  const toMin = fromDay && (min === undefined || fromDay > min) ? fromDay : min

  return (
    <span className={s.dateBox}>
      <span ref={anchor} role="group" aria-label={label} className={[is.field, size === 's' ? is.sizeS : is.sizeM, invFrom || invTo ? is.invalid : '', s.dateField, s.rangeField].filter(Boolean).join(' ')}>
        <MaskedDateField ref={fromInput} aria-label={`${label}, с`} value={value.from} onChange={(v) => onChange({ ...value, from: v })} format={fmt} min={min} max={max} disabled={disabled} className={[is.input, s.rangeInput].join(' ')} onInvalidChange={setInvFrom} />
        <span className={s.dash} aria-hidden="true">–</span>
        <MaskedDateField aria-label={`${label}, по`} value={value.to} onChange={(v) => onChange({ ...value, to: v })} format={fmt} min={toMin} max={max} disabled={disabled} className={[is.input, s.rangeInput].join(' ')} onInvalidChange={setInvTo} />
        <IconButton size="s" label="Выбрать период" aria-haspopup="dialog" aria-expanded={open} disabled={disabled} className={s.calBtn} onClick={toggle}><CalIcon /></IconButton>
      </span>
      {quick.length > 0 && (
        <span role="group" aria-label="Быстрый период" className={s.quick}>
          {quick.map((p) => {
            const on = presetMatches(p, t, value)
            return <Button key={p.id} size="s" pressed={on} disabled={disabled} onClick={() => onChange(on ? EMPTY : p.range(t))}>{p.label}</Button>
          })}
        </span>
      )}
      <Popover open={open} anchor={anchor} returnFocus={fromInput} onClose={close} label={`${label}: выбор периода`} manualFocus>
        <div className={s.rangePop}>
          {presets.length > 0 && (
            <ul className={s.presets} aria-label="Пресеты периода">
              {presets.map((p) => (
                <li key={p.id}><button type="button" className={s.preset} aria-pressed={presetMatches(p, t, value)} onClick={() => applyPreset(p)}>{p.label}</button></li>
              ))}
            </ul>
          )}
          <div>
            <Calendar month={month} onMonthChange={setMonth} range={shown} onPick={pick} onHoverDay={(d) => { if (pending !== null) setHover(d) }} min={min} max={max} today={t} autoFocus />
            {time && (
              <div className={s.timeRow}>
                <TimeField label="Время с" value={value.from ? timeOf(value.from) : ''} onChange={(tm) => onChange({ ...value, from: withDay(value.from, tm) })} />
                <TimeField label="Время по" value={value.to ? timeOf(value.to) : ''} onChange={(tm) => onChange({ ...value, to: withDay(value.to, tm) })} />
                <Button size="s" variant="primary" onClick={close}>Готово</Button>
              </div>
            )}
          </div>
        </div>
      </Popover>
    </span>
  )
}
```

- [ ] **Step 3: Стили.** В конец `Date.module.css`:

```css
/* поля «с» и «по» делят рамку поровну и сжимаются в узкой колонке */
.rangeInput {
  width: 100%;
  min-width: 0;
}

.dash {
  flex: none;
  color: var(--k-muted);
}

.rangePop {
  display: flex;
  gap: var(--k-sp-2);
}

.presets {
  display: grid;
  align-content: start;
  gap: var(--k-sp-1);
  width: var(--k-preset-w);
  margin: 0;
  padding: var(--k-sp-1) var(--k-sp-2) var(--k-sp-1) 0;
  border-right: 1px solid var(--k-line);
  list-style: none;
}

.preset {
  width: 100%;
  height: var(--k-h-ctl-s);
  padding: 0 var(--k-sp-2);
  border: 0;
  border-radius: var(--k-r-s);
  background: none;
  font: 400 var(--k-fs-1) / 1 var(--k-sans);
  color: var(--k-ink);
  text-align: left;
  cursor: pointer;
}

.preset:hover {
  background: var(--k-hover);
}

.preset:focus-visible {
  outline: 2px solid var(--k-val);
  outline-offset: -2px;
}

.preset[aria-pressed="true"] {
  background: var(--k-val-soft);
  color: var(--k-val);
}
```

Класс полей — локальный `.rangeInput`: класс `input` из `Input.module.css` — другой модуль, по нему из этого файла не выбрать.

`packages/ui/src/date/index.ts`: `export { DateRange, type DateRangeProps, type DateRangeValue } from './DateRange'`.

- [ ] **Step 4: Прогон.** `pnpm --filter @katran/ui exec vitest run src/date` → PASS; `pnpm check` → зелёный.

- [ ] **Step 5: Commit** — `DateRange: период с календарём двумя кликами, пресетами в поповере, горячими кнопками и временем`.

---

### Task 5: Общая основа списков и `SearchSelect`

**Files:**
- Create: `packages/ui/src/select/options.ts`, `packages/ui/src/select/options.test.ts`, `packages/ui/src/select/Listbox.tsx`, `packages/ui/src/select/SearchSelect.tsx`, `packages/ui/src/select/SearchSelect.test.tsx`, `packages/ui/src/select/Select.module.css`, `packages/ui/src/select/index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `Popover` с `role="presentation"` (Task 3), `useStableId`, `IconButton`, `Input.module.css`, тип `Scalar` (`packages/ui/src/filters/types.ts`, только `import type`).
- Produces: `Option = { value: Scalar; label: string; hint?: string | undefined }`, `filterOptions(options, query)`, `sameScalar(a, b)`; внутренние `Listbox`, `ListboxProps`, `optionId(listId, i)`, иконки `Cross`, `Chevron`; `SearchSelect`, `SearchSelectProps` (спека §4.2).

- [ ] **Step 1: Тест помощников.** `packages/ui/src/select/options.test.ts`:

```ts
import { filterOptions, sameScalar } from './options'

const opts = [
  { value: 'ERROR', label: 'Ошибка' },
  { value: 'DONE', label: 'Обработан', hint: 'DONE' },
  { value: 3, label: 'Третья очередь' },
]

describe('options', () => {
  it('поиск без учёта регистра по подписи, подсказке и значению', () => {
    expect(filterOptions(opts, 'ош').map((o) => o.value)).toEqual(['ERROR'])
    expect(filterOptions(opts, 'done').map((o) => o.value)).toEqual(['DONE'])
    expect(filterOptions(opts, '3').map((o) => o.value)).toEqual([3])
    expect(filterOptions(opts, '  ')).toHaveLength(3)
  })
  it('значения сравниваются строго: 3 и "3" — разные', () => {
    expect(sameScalar(3, 3)).toBe(true)
    expect(sameScalar(3, '3')).toBe(false)
  })
})
```

- [ ] **Step 2: Помощники и список.** `packages/ui/src/select/options.ts`:

```ts
import type { Scalar } from '../filters/types'

/** Вариант справочника: hint — приглушённо справа (код, BIC). */
export type Option = { value: Scalar; label: string; hint?: string | undefined }

export const sameScalar = (a: Scalar, b: Scalar): boolean => a === b

/** Поиск без учёта регистра по вхождению в подпись, подсказку и строковое значение; пустой запрос — все варианты. */
export function filterOptions(options: Option[], query: string): Option[] {
  const q = query.trim().toLowerCase()
  if (q === '') return options
  return options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? '').toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q))
}
```

`packages/ui/src/select/Listbox.tsx`:

```tsx
import { useEffect, type ReactNode } from 'react'
import type { Option } from './options'
import s from './Select.module.css'

export const Cross = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
export const Chevron = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>

export const optionId = (listId: string, i: number) => `${listId}-o${i}`

export type ListboxProps = {
  id: string
  label: string
  options: Option[]
  /** Активный пункт (aria-activedescendant у поля); -1 — нет. */
  active: number
  isSelected: (o: Option) => boolean
  multi?: boolean | undefined
  onPick: (o: Option, index: number) => void
  onActive: (index: number) => void
  emptyText?: string | undefined
  /** Выделить совпадение с набранным текстом полужирным (подсказки). */
  highlight?: string | undefined
}

function mark(text: string, q: string): ReactNode {
  const i = q.trim() === '' ? -1 : text.toLowerCase().indexOf(q.trim().toLowerCase())
  if (i < 0) return text
  const n = q.trim().length
  return <>{text.slice(0, i)}<b>{text.slice(i, i + n)}</b>{text.slice(i + n)}</>
}

/** Список вариантов role=listbox: фокус остаётся в поле (aria-activedescendant), мышь не уводит его (mousedown отменён). */
export function Listbox({ id, label, options, active, isSelected, multi, onPick, onActive, emptyText = 'Ничего не найдено', highlight }: ListboxProps) {
  useEffect(() => {
    const el = document.getElementById(optionId(id, active))
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [id, active])
  return (
    <ul id={id} role="listbox" aria-label={label} aria-multiselectable={multi || undefined} className={s.list}>
      {options.length === 0 && <li role="option" aria-disabled="true" aria-selected={false} className={s.empty}>{emptyText}</li>}
      {options.map((o, i) => {
        const sel = isSelected(o)
        return (
          <li
            key={`${typeof o.value}:${String(o.value)}`}
            id={optionId(id, i)}
            role="option"
            aria-selected={sel}
            tabIndex={-1}
            data-active={i === active || undefined}
            className={s.opt}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(o, i)}
            onKeyDown={(e) => { if (e.key === 'Enter') onPick(o, i) }}
            onMouseMove={() => { if (i !== active) onActive(i) }}
          >
            {multi && <span className={s.box} data-on={sel || undefined} aria-hidden="true" />}
            <span className={s.optLabel}>{highlight !== undefined ? mark(o.label, highlight) : o.label}</span>
            {o.hint && <span className={s.hint}>{o.hint}</span>}
          </li>
        )
      })}
    </ul>
  )
}
```

`onKeyDown` у пункта — для правила `jsx-a11y/click-events-have-key-events`: пункты не получают фокус (клавиатура — у поля), обработчик ничего не ломает.

- [ ] **Step 3: Тест `SearchSelect`.** `packages/ui/src/select/SearchSelect.test.tsx`:

```tsx
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import type { Scalar } from '../filters/types'
import type { Option } from './options'
import { SearchSelect, type SearchSelectProps } from './SearchSelect'

const MANY: Option[] = ['В работе', 'К экспорту', 'В обработке', 'Ошибка', 'Отложенный', 'Экспортирован', 'Невалидный', 'Отказ', 'Обработан']
  .map((label, i) => ({ value: `S${i}`, label }))
const FEW: Option[] = [{ value: 'true', label: 'да' }, { value: 'false', label: 'нет' }]

function Host({ initial = null, onValue = () => {}, ...p }: Partial<SearchSelectProps> & { initial?: Scalar | null; onValue?: (v: Scalar | null) => void }) {
  const [v, setV] = useState<Scalar | null>(initial)
  return <SearchSelect aria-label="Статус" options={MANY} {...p} value={v} onChange={(x) => { setV(x); onValue(x) }} />
}

describe('SearchSelect', () => {
  it('с поиском (вариантов больше 7): ввод фильтрует, стрелка и Enter выбирают', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    const box = screen.getByRole('combobox', { name: 'Статус' })
    expect(box.tagName).toBe('INPUT')
    await u.click(box)
    expect(screen.getByRole('listbox', { name: 'Статус' })).toBeInTheDocument()
    await u.type(box, 'отк')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Отказ'])
    await u.keyboard('{Enter}')
    expect(onValue).toHaveBeenLastCalledWith('S7')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(box).toHaveValue('Отказ')
  })
  it('aria-activedescendant следует за стрелками; Escape закрывает без выбора', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    const box = screen.getByRole('combobox', { name: 'Статус' })
    box.focus()
    await u.keyboard('{ArrowDown}{ArrowDown}')
    const opt = document.getElementById(box.getAttribute('aria-activedescendant')!)
    expect(opt).toHaveTextContent('К экспорту')
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onValue).not.toHaveBeenCalled()
  })
  it('без поиска: кнопка-комбобокс, Enter открывает, буква переходит, Enter выбирает', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host options={FEW} onValue={onValue} />)
    const box = screen.getByRole('combobox', { name: 'Статус' })
    expect(box.tagName).toBe('BUTTON')
    box.focus()
    await u.keyboard('{Enter}')
    await u.keyboard('н')
    expect(document.getElementById(box.getAttribute('aria-activedescendant')!)).toHaveTextContent('нет')
    await u.keyboard('{Enter}')
    expect(onValue).toHaveBeenLastCalledWith('false')
  })
  it('очистка кнопкой и Delete; Enter не отправляет форму', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    renderK(<form onSubmit={onSubmit}><Host initial="S3" onValue={onValue} /></form>)
    await u.click(screen.getByRole('button', { name: 'Очистить' }))
    expect(onValue).toHaveBeenLastCalledWith(null)
    const box = screen.getByRole('combobox', { name: 'Статус' })
    await u.click(box)
    await u.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    await u.keyboard('{Escape}')
    await u.keyboard('{Delete}')
    expect(onValue).toHaveBeenLastCalledWith(null)
  })
  it('пустой результат — «Ничего не найдено»', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.type(screen.getByRole('combobox', { name: 'Статус' }), 'яяя')
    expect(screen.getByRole('option')).toHaveTextContent('Ничего не найдено')
  })
  it('axe: закрыт и открыт', async () => {
    const u = userEvent.setup()
    const { container } = renderK(<Host initial="S1" />)
    expect(await axe(container)).toHaveNoViolations()
    await u.click(screen.getByRole('combobox', { name: 'Статус' }))
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
```

Run: `pnpm --filter @katran/ui exec vitest run src/select` → FAIL.

- [ ] **Step 4: Реализация.** `packages/ui/src/select/SearchSelect.tsx`:

```tsx
import { useRef, useState, type KeyboardEvent } from 'react'
import { IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import type { Scalar } from '../filters/types'
import is from '../input/Input.module.css'
import { Popover } from '../overlay'
import { Chevron, Cross, Listbox, optionId } from './Listbox'
import { filterOptions, sameScalar, type Option } from './options'
import s from './Select.module.css'

export type SearchSelectProps = {
  options: Option[]
  value: Scalar | null
  onChange: (value: Scalar | null) => void
  /** «Не выбрано». */
  placeholder?: string | undefined
  /** Кнопка ✕ «Очистить»; по умолчанию true. */
  clearable?: boolean | undefined
  /** Поле поиска; по умолчанию — если вариантов больше 7. */
  searchable?: boolean | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
}

/** Одно значение из справочника (спека §4.2): с поиском — input role=combobox, без — кнопка role=combobox. */
export function SearchSelect({ options, value, onChange, placeholder = 'Не выбрано', clearable = true, searchable, disabled, size = 'm', id, ...aria }: SearchSelectProps) {
  const withSearch = searchable ?? options.length > 7
  const name = aria['aria-label'] ?? 'Выбор'
  const listId = useStableId()
  const anchor = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const shown = withSearch ? filterOptions(options, query) : options
  const selected = value === null ? null : options.find((o) => sameScalar(o.value, value)) ?? null

  const openList = () => { setOpen(true); setActive(Math.max(0, shown.findIndex((o) => selected !== null && sameScalar(o.value, selected.value)))) }
  const close = () => { setOpen(false); setQuery(''); setActive(-1) }
  const pick = (o: Option) => { onChange(o.value); close() }
  const typeahead = (ch: string) => {
    const n = shown.length
    for (let k = 1; k <= n; k++) {
      const i = (active + k) % n
      if (shown[i]!.label.toLowerCase().startsWith(ch.toLowerCase())) { setActive(i); return }
    }
  }
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    const last = shown.length - 1
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); if (!open) openList(); else setActive(Math.min(active + 1, last)); return
      case 'ArrowUp': e.preventDefault(); if (open) setActive(Math.max(active - 1, 0)); return
      case 'Home': if (open) { e.preventDefault(); setActive(0) } return
      case 'End': if (open) { e.preventDefault(); setActive(last) } return
      case 'Enter':
        // Enter в комбобоксе форму не отправляет (спека §6.6)
        e.preventDefault()
        if (open && shown[active]) pick(shown[active]!); else if (!open && !withSearch) openList()
        return
      case ' ':
        if (withSearch) return
        e.preventDefault()
        if (open && shown[active]) pick(shown[active]!); else openList()
        return
      case 'Tab': if (open) close(); return
      case 'Delete':
      case 'Backspace':
        if (!open && clearable && value !== null && (!withSearch || e.key === 'Delete')) { e.preventDefault(); onChange(null) }
        return
      default:
        if (!withSearch && open && e.key.length === 1) typeahead(e.key)
    }
  }

  const combo = {
    id,
    role: 'combobox' as const,
    'aria-label': name,
    'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-activedescendant': open && active >= 0 && shown[active] ? optionId(listId, active) : undefined,
    disabled,
    onKeyDown: onKey,
  }
  return (
    <>
      <span ref={anchor} className={[is.field, size === 's' ? is.sizeS : is.sizeM, s.selField].join(' ')}>
        {withSearch
          ? (
            <input
              {...combo}
              aria-autocomplete="list"
              autoComplete="off"
              className={is.input}
              placeholder={placeholder}
              value={open ? query : selected?.label ?? ''}
              onClick={() => { if (!open) openList() }}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
            />
          )
          : (
            <button {...combo} type="button" aria-haspopup="listbox" className={s.selBtn} onClick={() => (open ? close() : openList())}>
              {selected ? selected.label : <span className={s.ph}>{placeholder}</span>}
            </button>
          )}
        {clearable && selected !== null && !disabled && <IconButton size="s" tabIndex={-1} label="Очистить" className={s.clear} onClick={() => onChange(null)}><Cross /></IconButton>}
        <span className={s.chev} aria-hidden="true"><Chevron /></span>
      </span>
      <Popover open={open} anchor={anchor} onClose={close} role="presentation" className={s.pop}>
        <Listbox id={listId} label={name} options={shown} active={active} isSelected={(o) => selected !== null && sameScalar(o.value, selected.value)} onPick={pick} onActive={setActive} />
      </Popover>
    </>
  )
}
```

- [ ] **Step 5: Стили и экспорт.** `packages/ui/src/select/Select.module.css`:

```css
.selField {
  padding-right: var(--k-sp-1);
}

.selBtn {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selBtn:focus-visible {
  outline: 0;
}

.ph {
  color: var(--k-faint);
}

.clear {
  flex: none;
  color: var(--k-muted);
}

.chev {
  display: inline-grid;
  flex: none;
  place-items: center;
  color: var(--k-muted);
}

.chev > svg {
  width: var(--k-icon-s);
  height: var(--k-icon-s);
}

.pop {
  min-width: var(--k-filter-field);
}

.list {
  max-height: var(--k-menu-max-h);
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.opt {
  display: flex;
  align-items: center;
  gap: var(--k-sp-2);
  min-height: var(--k-h-ctl-m);
  padding: 0 var(--k-sp-2);
  border-radius: var(--k-r-s);
  font: 400 var(--k-fs-1) / var(--k-lh-1) var(--k-sans);
  color: var(--k-ink);
  cursor: pointer;
}

.opt[data-active] {
  background: var(--k-hover);
}

.opt[aria-selected="true"] {
  color: var(--k-val);
  font-weight: 500;
}

.optLabel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  flex: none;
  font: 400 var(--k-fs-3) / 1 var(--k-mono);
  color: var(--k-muted);
}

.empty {
  padding: var(--k-sp-2);
  color: var(--k-muted);
  cursor: default;
}

/* чекбокс мультиселекта — рисованный: пункт не содержит интерактива, состояние несёт aria-selected */
.box {
  flex: none;
  width: var(--k-icon-s);
  height: var(--k-icon-s);
  border: 1px solid var(--k-line);
  border-radius: var(--k-r-s);
  background: var(--k-paper);
}

.box[data-on] {
  border-color: var(--k-val);
  background: var(--k-val);
  box-shadow: inset 0 0 0 2px var(--k-paper);
}
```

`packages/ui/src/select/index.ts`:

```ts
export { filterOptions, sameScalar, type Option } from './options'
export { SearchSelect, type SearchSelectProps } from './SearchSelect'
```

В `packages/ui/src/index.ts` после `export * from './date'` добавить `export * from './select'`.

- [ ] **Step 6: Прогон.** `pnpm --filter @katran/ui exec vitest run src/select` → PASS; `pnpm check` → зелёный.

- [ ] **Step 7: Commit** — `SearchSelect: одно значение из справочника — WAI-ARIA combobox с поиском или кнопкой, Listbox как общая основа списков`.

---

### Task 6: `MultiSelect`

**Files:**
- Create: `packages/ui/src/select/MultiSelect.tsx`, `packages/ui/src/select/MultiSelect.test.tsx`
- Modify: `packages/ui/src/select/Select.module.css`, `packages/ui/src/select/index.ts`

**Interfaces:**
- Consumes: `Listbox`, `Cross`, `Chevron`, `optionId`, `filterOptions`, `sameScalar` (Task 5), `Input` (`packages/ui/src/input`), `Button`, `IconButton`, `Popover`.
- Produces: `MultiSelect`, `MultiSelectProps` (спека §4.3): `{ options; value: Scalar[]; onChange; placeholder?; maxChips?; max?; disabled?; size?; id?; 'aria-label'? }`.

- [ ] **Step 1: Тест.** `packages/ui/src/select/MultiSelect.test.tsx`:

```tsx
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import type { Scalar } from '../filters/types'
import { MultiSelect, type MultiSelectProps } from './MultiSelect'

const OPTS = [{ value: 'IN_WORK', label: 'В работе' }, { value: 'ERROR', label: 'Ошибка' }, { value: 'DEFERRED', label: 'Отложенный' }, { value: 'REJECTED', label: 'Отказ' }]

function Host({ initial = [], onValue = () => {}, ...p }: Partial<MultiSelectProps> & { initial?: Scalar[]; onValue?: (v: Scalar[]) => void }) {
  const [v, setV] = useState<Scalar[]>(initial)
  return <MultiSelect aria-label="Статус" options={OPTS} {...p} value={v} onChange={(x) => { setV(x); onValue(x) }} />
}

describe('MultiSelect', () => {
  it('поповер с поиском и списком; выбор в порядке справочника; список не закрывается', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    const trigger = screen.getByRole('button', { name: 'Статус: Не выбрано' })
    await u.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Статус' })
    expect(within(dialog).getByRole('combobox', { name: 'Поиск: Статус' })).toHaveFocus()
    expect(within(dialog).getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')
    await u.click(within(dialog).getByRole('option', { name: 'Отказ' }))
    await u.click(within(dialog).getByRole('option', { name: 'Ошибка' }))
    expect(onValue).toHaveBeenLastCalledWith(['ERROR', 'REJECTED'])
    expect(within(dialog).getByRole('option', { name: 'Ошибка' })).toHaveAttribute('aria-selected', 'true')
    expect(within(dialog).getByText('Выбрано 2')).toBeInTheDocument()
  })
  it('клавиатура в поиске: ввод, стрелка, Enter переключает', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: /^Статус:/ }))
    await u.keyboard('от')
    await u.keyboard('{ArrowDown}{Enter}')
    expect(onValue).toHaveBeenLastCalledWith(['REJECTED'])
  })
  it('чипы: два первых и «+N»; ✕ снимает значение, «Очистить» — все', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host initial={['IN_WORK', 'ERROR', 'REJECTED']} onValue={onValue} />)
    expect(screen.getByText('+1')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Убрать: В работе' }))
    expect(onValue).toHaveBeenLastCalledWith(['ERROR', 'REJECTED'])
    await u.click(screen.getByRole('button', { name: /^Статус:/ }))
    await u.click(screen.getByRole('button', { name: 'Очистить' }))
    expect(onValue).toHaveBeenLastCalledWith([])
  })
  it('max = 1: выбор заменяет выбранный', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host initial={['ERROR']} max={1} onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: /^Статус:/ }))
    await u.click(screen.getByRole('option', { name: 'Отказ' }))
    expect(onValue).toHaveBeenLastCalledWith(['REJECTED'])
  })
  it('значение не из справочника сохраняется в конце', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host initial={['LEGACY']} onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: /^Статус:/ }))
    await u.click(screen.getByRole('option', { name: 'Ошибка' }))
    expect(onValue).toHaveBeenLastCalledWith(['ERROR', 'LEGACY'])
  })
  it('axe: закрыт и открыт', async () => {
    const u = userEvent.setup()
    const { container } = renderK(<Host initial={['ERROR']} />)
    expect(await axe(container)).toHaveNoViolations()
    await u.click(screen.getByRole('button', { name: /^Статус:/ }))
    expect(await axe(document.body)).toHaveNoViolations()
  })
})
```

Run → FAIL.

- [ ] **Step 2: Реализация.** `packages/ui/src/select/MultiSelect.tsx`:

```tsx
import { useRef, useState, type KeyboardEvent } from 'react'
import { Button, IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import type { Scalar } from '../filters/types'
import { Input } from '../input'
import is from '../input/Input.module.css'
import { Popover } from '../overlay'
import { Chevron, Cross, Listbox, optionId } from './Listbox'
import { filterOptions, sameScalar, type Option } from './options'
import s from './Select.module.css'

export type MultiSelectProps = {
  options: Option[]
  value: Scalar[]
  onChange: (value: Scalar[]) => void
  placeholder?: string | undefined
  /** Сколько чипов видно в поле; дальше «+N». По умолчанию 2. */
  maxChips?: number | undefined
  /** Предел выбора; 1 — одиночный выбор в том же виде. По умолчанию без предела. */
  max?: number | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
}

/** Несколько значений из справочника (спека §4.3): чипы в поле, поиск и список с отметками в поповере. */
export function MultiSelect({ options, value, onChange, placeholder = 'Не выбрано', maxChips = 2, max, disabled, size = 'm', id, ...aria }: MultiSelectProps) {
  const name = aria['aria-label'] ?? 'Выбор'
  const listId = useStableId()
  const anchor = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const shown = filterOptions(options, query)
  const has = (v: Scalar) => value.some((x) => sameScalar(x, v))
  const chosen = options.filter((o) => has(o.value))

  // порядок значения — порядок справочника (условие IN стабильно); значения не из справочника — в конце
  const ordered = (next: Scalar[]) => [
    ...options.filter((o) => next.some((v) => sameScalar(v, o.value))).map((o) => o.value),
    ...next.filter((v) => !options.some((o) => sameScalar(o.value, v))),
  ]
  const toggle = (o: Option) => {
    if (max === 1) { onChange(has(o.value) ? [] : [o.value]); return }
    if (has(o.value)) { onChange(value.filter((v) => !sameScalar(v, o.value))); return }
    if (max !== undefined && value.length >= max) return
    onChange(ordered([...value, o.value]))
  }
  const close = () => { setOpen(false); setQuery(''); setActive(0) }
  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const last = shown.length - 1
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, last)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(last) }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) toggle(shown[active]!) }
  }

  return (
    <>
      <span ref={anchor} className={[is.field, size === 's' ? is.sizeS : is.sizeM, s.multiField].join(' ')}>
        {chosen.slice(0, maxChips).map((o) => (
          <span key={`${typeof o.value}:${String(o.value)}`} className={s.chip}>
            <span className={s.chipText}>{o.label}</span>
            {!disabled && <IconButton size="s" tabIndex={-1} label={`Убрать: ${o.label}`} className={s.chipX} onClick={() => toggle(o)}><Cross /></IconButton>}
          </span>
        ))}
        {chosen.length > maxChips && <span className={s.more}>+{chosen.length - maxChips}</span>}
        <button
          ref={trigger}
          id={id}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${name}: ${value.length > 0 ? `выбрано ${value.length}` : placeholder}`}
          disabled={disabled}
          className={s.multiBtn}
          onClick={() => (open ? close() : setOpen(true))}
          onKeyDown={(e) => { if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true) } }}
        >
          {value.length === 0 && <span className={s.ph}>{placeholder}</span>}
          <span className={s.chev} aria-hidden="true"><Chevron /></span>
        </button>
      </span>
      <Popover open={open} anchor={anchor} returnFocus={trigger} onClose={close} label={name} className={s.pop}>
        <div className={s.multiPop}>
          <Input
            size="s"
            role="combobox"
            aria-label={`Поиск: ${name}`}
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={shown[active] ? optionId(listId, active) : undefined}
            autoComplete="off"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0) }}
            onKeyDown={onSearchKey}
          />
          <Listbox id={listId} label={name} options={shown} active={active} isSelected={(o) => has(o.value)} multi onPick={toggle} onActive={setActive} />
          <div className={s.foot}>
            <span>Выбрано {value.length}</span>
            <Button size="s" disabled={value.length === 0} onClick={() => onChange([])}>Очистить</Button>
          </div>
        </div>
      </Popover>
    </>
  )
}
```

- [ ] **Step 3: Стили и экспорт.** В конец `Select.module.css`:

```css
.multiField {
  gap: var(--k-sp-1);
  padding-right: var(--k-sp-1);
  overflow: hidden;
}

.multiBtn {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: space-between;
  min-width: var(--k-sp-6);
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.multiBtn:focus-visible {
  outline: 0;
}

.chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  max-width: 50%;
  height: calc(var(--k-h-ctl-s) - var(--k-sp-1));
  padding-left: var(--k-sp-1);
  border-radius: var(--k-r-s);
  background: var(--k-val-soft);
  color: var(--k-ink);
  font-size: var(--k-fs-2);
}

.chipText {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chipX {
  flex: none;
  color: var(--k-muted);
}

.more {
  flex: none;
  font-size: var(--k-fs-2);
  color: var(--k-ink2);
}

.multiPop {
  display: grid;
  gap: var(--k-sp-1);
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--k-sp-2);
  padding: var(--k-sp-1) var(--k-sp-1) 0;
  border-top: 1px solid var(--k-line);
  font-size: var(--k-fs-2);
  color: var(--k-ink2);
}
```

`select/index.ts`: `export { MultiSelect, type MultiSelectProps } from './MultiSelect'`.

Проверить контраст новых пар по правилам токенов (`packages/tokens/src/contrast.rules.ts`): `ink` на `val-soft`, `ink2` на `paper` — уже покрыты; новых пар «цвет на цвете» не добавляется.

- [ ] **Step 4: Прогон.** `pnpm --filter @katran/ui exec vitest run src/select` → PASS; `pnpm check` → зелёный.

- [ ] **Step 5: Commit** — `MultiSelect: несколько значений из справочника — чипы с «+N», поиск, отметки, «Выбрано N · Очистить», предел выбора`.

---

### Task 7: `TagInput` — списки значений и фраз

**Files:**
- Create: `packages/ui/src/tag/parseTags.ts`, `packages/ui/src/tag/parseTags.test.ts`, `packages/ui/src/tag/TagInput.tsx`, `packages/ui/src/tag/TagInput.test.tsx`, `packages/ui/src/tag/Tag.module.css`, `packages/ui/src/tag/index.ts`
- Modify: `packages/ui/src/index.ts`

**Interfaces:**
- Consumes: `Listbox`, `Cross`, `optionId` (Task 5), `Popover` (`role="presentation"`), `useStableId`, `IconButton`, `Input.module.css`.
- Produces: `TagMode = 'values' | 'phrases'`, `splitTags(text, mode)`, `takeTags(text, mode) → { tags, rest }`, `mergeTags(current, add, mode, max) → { value, added, dropped }`, `TAG_LIMIT = { values: 500, phrases: 20 }`; `TagInput`, `TagInputProps` (спека §5).

- [ ] **Step 1: Тест разбора.** `packages/ui/src/tag/parseTags.test.ts`:

```ts
import { mergeTags, splitTags, takeTags } from './parseTags'

describe('splitTags', () => {
  it('values: переносы, ; , пробелы, табуляция — колонка и строка из Excel', () => {
    expect(splitTags('400\n403\r\n406', 'values')).toEqual(['400', '403', '406'])
    expect(splitTags('A1 B2,C3;D4\tE5', 'values')).toEqual(['A1', 'B2', 'C3', 'D4', 'E5'])
    expect(splitTags(' ;, ', 'values')).toEqual([])
  })
  it('phrases: кавычки обоих видов, ; и перенос — разделители, запятая и пробел — часть фразы', () => {
    expect(splitTags('"счёт не найден" "инструкция инвалидна"', 'phrases')).toEqual(['счёт не найден', 'инструкция инвалидна'])
    expect(splitTags('«нет покрытия»; лимит превышен', 'phrases')).toEqual(['нет покрытия', 'лимит превышен'])
    expect(splitTags('Оплата, НДС 20 %', 'phrases')).toEqual(['Оплата, НДС 20 %'])
    expect(splitTags('a\nb', 'phrases')).toEqual(['a', 'b'])
    expect(splitTags('"незакрытая фраза', 'phrases')).toEqual(['незакрытая фраза'])
    expect(splitTags('до "в кавычках" после', 'phrases')).toEqual(['до', 'в кавычках', 'после'])
  })
})

describe('takeTags', () => {
  it('values: готовые чипы до последнего разделителя, хвост остаётся текстом', () => {
    expect(takeTags('123 45', 'values')).toEqual({ tags: ['123'], rest: '45' })
    expect(takeTags('123,', 'values')).toEqual({ tags: ['123'], rest: '' })
    expect(takeTags('123', 'values')).toEqual({ tags: [], rest: '123' })
  })
  it('phrases: ; делит, открытая кавычка — ещё не делит', () => {
    expect(takeTags('abc; de', 'phrases')).toEqual({ tags: ['abc'], rest: 'de' })
    expect(takeTags('"a; b', 'phrases')).toEqual({ tags: [], rest: '"a; b' })
    expect(takeTags('abc de', 'phrases')).toEqual({ tags: [], rest: 'abc de' })
  })
})

describe('mergeTags', () => {
  it('повторы: values — точное совпадение, phrases — без учёта регистра', () => {
    expect(mergeTags(['A'], ['a', 'A'], 'values', 500)).toEqual({ value: ['A', 'a'], added: 1, dropped: 0 })
    expect(mergeTags(['Ошибка'], ['ошибка', 'Отказ'], 'phrases', 20)).toEqual({ value: ['Ошибка', 'Отказ'], added: 1, dropped: 0 })
  })
  it('предел: лишние не добавляются и считаются', () => {
    expect(mergeTags(['1'], ['2', '3', '4'], 'values', 3)).toEqual({ value: ['1', '2', '3'], added: 2, dropped: 1 })
  })
})
```

- [ ] **Step 2: Реализация разбора.** `packages/ui/src/tag/parseTags.ts`:

```ts
/** Разбор ввода TagInput (спека §5): values — ID, номера, коды; phrases — текст для поиска по вхождению. */
export type TagMode = 'values' | 'phrases'
export const TAG_LIMIT: Record<TagMode, number> = { values: 500, phrases: 20 }

const VALUE_SEP = /[\s;,]+/
const VALUE_SEP_CHAR = /[\s;,]/
const PHRASE_SEP = /[;\r\n]+/
const CLOSE: Record<string, string> = { '"': '"', '«': '»' }

function splitPhrases(text: string): string[] {
  const out: string[] = []
  let buf = ''
  const flush = () => {
    for (const p of buf.split(PHRASE_SEP)) { const t = p.trim(); if (t) out.push(t) }
    buf = ''
  }
  let i = 0
  while (i < text.length) {
    const ch = text[i]!
    const close = CLOSE[ch]
    if (close !== undefined) {
      flush()
      const j = text.indexOf(close, i + 1)
      const end = j < 0 ? text.length : j
      const t = text.slice(i + 1, end).trim()
      if (t) out.push(t)
      i = end + 1
      continue
    }
    buf += ch
    i++
  }
  flush()
  return out
}

/** Весь текст → чипы. */
export function splitTags(text: string, mode: TagMode): string[] {
  return mode === 'values' ? text.split(VALUE_SEP).map((t) => t.trim()).filter(Boolean) : splitPhrases(text)
}

const openQuote = (text: string) => (text.split('"').length - 1) % 2 === 1 || text.split('«').length > text.split('»').length

/** Набранное: чипы — до последнего разделителя, хвост — остаётся текстом. У фраз открытая кавычка ещё не делит. */
export function takeTags(text: string, mode: TagMode): { tags: string[]; rest: string } {
  if (mode === 'phrases' && openQuote(text)) return { tags: [], rest: text }
  let cut = -1
  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i]!
    if (mode === 'values' ? VALUE_SEP_CHAR.test(ch) : ch === ';' || ch === '\n' || ch === '\r') { cut = i; break }
  }
  if (cut < 0) return { tags: [], rest: text }
  return { tags: splitTags(text.slice(0, cut + 1), mode), rest: text.slice(cut + 1).trimStart() }
}

/** Добавить чипы: повторы пропускаются (values — точное совпадение, phrases — без учёта регистра), сверх max — не добавляются. */
export function mergeTags(current: string[], add: string[], mode: TagMode, max: number): { value: string[]; added: number; dropped: number } {
  const key = mode === 'phrases' ? (t: string) => t.toLowerCase() : (t: string) => t
  const seen = new Set(current.map(key))
  const value = current.slice()
  let added = 0
  let dropped = 0
  for (const t of add) {
    if (seen.has(key(t))) continue
    if (value.length >= max) { dropped++; continue }
    value.push(t)
    seen.add(key(t))
    added++
  }
  return { value, added, dropped }
}
```

Run: `pnpm --filter @katran/ui exec vitest run src/tag/parseTags.test.ts` → PASS.

- [ ] **Step 3: Тест `TagInput`.** `packages/ui/src/tag/TagInput.test.tsx`:

```tsx
import { useState } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { TagInput, type TagInputProps } from './TagInput'

function Host({ initial = [], onValue = () => {}, ...p }: Partial<TagInputProps> & { initial?: string[]; onValue?: (v: string[]) => void }) {
  const [v, setV] = useState<string[]>(initial)
  const [t, setT] = useState('')
  return <TagInput aria-label="Номер документа" mode="values" {...p} value={v} onChange={(x) => { setV(x); onValue(x) }} text={t} onTextChange={setT} />
}
const chips = () => within(screen.getByRole('list', { name: 'Номер документа' })).getAllByRole('listitem').map((li) => li.firstChild?.textContent)

describe('TagInput', () => {
  it('values: пробел, запятая и Enter делают чипы; хвост остаётся в поле', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const input = screen.getByRole('textbox', { name: 'Номер документа' })
    await u.type(input, '400 403,406')
    expect(chips()).toEqual(['400', '403'])
    expect(input).toHaveValue('406')
    await u.keyboard('{Enter}')
    expect(chips()).toEqual(['400', '403', '406'])
    expect(input).toHaveValue('')
  })
  it('вставка колонки из Excel — чип на строку', () => {
    renderK(<Host />)
    const input = screen.getByRole('textbox', { name: 'Номер документа' })
    fireEvent.paste(input, { clipboardData: { getData: () => '400\r\n403\r\n406\r\n' } })
    expect(chips()).toEqual(['400', '403', '406'])
  })
  it('phrases: две фразы в кавычках и Enter — два чипа', async () => {
    const u = userEvent.setup()
    renderK(<Host aria-label="Назначение" mode="phrases" />)
    const input = screen.getByRole('textbox', { name: 'Назначение' })
    await u.type(input, '"счёт не найден" "инструкция инвалидна"{Enter}')
    expect(within(screen.getByRole('list', { name: 'Назначение' })).getAllByRole('listitem').map((li) => li.firstChild?.textContent))
      .toEqual(['счёт не найден', 'инструкция инвалидна'])
  })
  it('Enter с пустым текстом не перехватывается — форма отправляется', async () => {
    const u = userEvent.setup()
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    renderK(<form onSubmit={onSubmit}><Host initial={['400']} /></form>)
    await u.type(screen.getByRole('textbox', { name: 'Номер документа' }), '401{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    await u.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
  it('Backspace: первый выделяет последний чип, второй снимает; ← и Delete', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host initial={['400', '403', '406']} onValue={onValue} />)
    screen.getByRole('textbox', { name: 'Номер документа' }).focus()
    await u.keyboard('{Backspace}')
    expect(screen.getAllByRole('listitem')[2]).toHaveAttribute('data-selected', 'true')
    await u.keyboard('{Backspace}')
    expect(onValue).toHaveBeenLastCalledWith(['400', '403'])
    await u.keyboard('{ArrowLeft}{ArrowLeft}{Delete}')
    expect(onValue).toHaveBeenLastCalledWith(['403'])
  })
  it('✕ у чипа снимает значение', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host initial={['400', '403']} onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: 'Убрать: 400' }))
    expect(onValue).toHaveBeenLastCalledWith(['403'])
  })
  it('предел: лишние не добавляются, строка о пределе', () => {
    renderK(<Host max={2} />)
    fireEvent.paste(screen.getByRole('textbox', { name: 'Номер документа' }), { clipboardData: { getData: () => '1 2 3 4' } })
    expect(chips()).toEqual(['1', '2'])
    expect(screen.getByRole('status')).toHaveTextContent('Добавлено 2 из 4: больше нельзя')
  })
  it('невалидное значение — красный чип с пометкой для скринридера', () => {
    renderK(<Host initial={['400', 'abc']} validate={(v) => /^\d+$/.test(v)} />)
    const bad = screen.getAllByRole('listitem')[1]!
    expect(bad).toHaveAttribute('data-invalid', 'true')
    expect(bad).toHaveTextContent('неверное значение')
  })
  it('подсказки: комбобокс, стрелка и Enter добавляют чип, закрытие сообщает onSuggestClose', async () => {
    const u = userEvent.setup()
    const onQuery = vi.fn()
    const onSuggestClose = vi.fn()
    function S() {
      const [v, setV] = useState<string[]>([])
      const [t, setT] = useState('')
      return <TagInput aria-label="Приказодатель" mode="phrases" value={v} onChange={setV} text={t} onTextChange={setT}
        suggestions={t ? ['ЗАО «Василёк»', 'ООО «Ромашка»'] : []} onQuery={onQuery} onSuggestClose={onSuggestClose} />
    }
    renderK(<S />)
    const box = screen.getByRole('combobox', { name: 'Приказодатель' })
    await u.type(box, 'ва')
    expect(onQuery).toHaveBeenLastCalledWith('ва')
    expect(screen.getByRole('listbox', { name: 'Подсказки: Приказодатель' })).toBeInTheDocument()
    await u.keyboard('{ArrowDown}{Enter}')
    expect(within(screen.getByRole('list', { name: 'Приказодатель' })).getByText('ЗАО «Василёк»')).toBeInTheDocument()
    expect(onSuggestClose).toHaveBeenCalled()
  })
  it('axe', async () => {
    const { container } = renderK(<Host initial={['400', 'abc']} validate={(v) => /^\d+$/.test(v)} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
```

Run → FAIL.

- [ ] **Step 4: Реализация.** `packages/ui/src/tag/TagInput.tsx`:

```tsx
import { useRef, useState, type KeyboardEvent } from 'react'
import { IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import is from '../input/Input.module.css'
import { Popover } from '../overlay'
import { Cross, Listbox, optionId } from '../select/Listbox'
import { mergeTags, splitTags, takeTags, TAG_LIMIT, type TagMode } from './parseTags'
import s from './Tag.module.css'

export type TagInputProps = {
  /** Значения-чипы (в том числе невалидные: они подсвечены, в условие их не берёт владелец поля). */
  value: string[]
  onChange: (value: string[]) => void
  /** Набираемый, ещё не превращённый в чип текст — владелец поля учитывает его при применении. */
  text: string
  onTextChange: (text: string) => void
  mode: TagMode
  validate?: ((v: string) => boolean) | undefined
  /** Предел числа чипов; по умолчанию values — 500 (IN контракта), phrases — 20. */
  max?: number | undefined
  suggestions?: string[] | undefined
  loading?: boolean | undefined
  onQuery?: ((query: string) => void) | undefined
  onSuggestClose?: (() => void) | undefined
  disabled?: boolean | undefined
  size?: 's' | 'm' | undefined
  id?: string | undefined
  'aria-label'?: string | undefined
  placeholder?: string | undefined
}

/** Несколько значений или фраз свободным вводом (спека §5): чипы, разбор вставки, подсказки с бека. */
export function TagInput({ value, onChange, text, onTextChange, mode, validate, max, suggestions, loading, onQuery, onSuggestClose, disabled, size = 'm', id, placeholder, ...aria }: TagInputProps) {
  const limit = max ?? TAG_LIMIT[mode]
  const name = aria['aria-label'] ?? 'Значения'
  const listId = useStableId()
  const noteId = useStableId()
  const anchor = useRef<HTMLSpanElement>(null)
  const [sel, setSel] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [active, setActive] = useState(-1)
  const withSuggest = onQuery !== undefined
  const items = (suggestions ?? []).filter((x) => !value.includes(x))
  const listOpen = withSuggest && (items.length > 0 || loading === true)

  const add = (tags: string[]) => {
    if (tags.length === 0) return
    const r = mergeTags(value, tags, mode, limit)
    setNote(r.dropped > 0 ? `Добавлено ${r.added} из ${r.added + r.dropped}: больше нельзя` : '')
    if (r.added > 0) onChange(r.value)
  }
  const closeSuggest = () => { setActive(-1); onSuggestClose?.() }
  const commit = () => { add(splitTags(text, mode)); onTextChange(''); closeSuggest() }
  const remove = (i: number) => {
    onChange(value.filter((_, j) => j !== i))
    setSel(i < value.length - 1 ? i : i > 0 ? i - 1 : null)
  }
  const onInput = (raw: string) => {
    setSel(null)
    setActive(-1)
    const { tags, rest } = takeTags(raw, mode)
    add(tags)
    onTextChange(tags.length > 0 ? rest : raw)
    onQuery?.(tags.length > 0 ? rest : raw)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (listOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      setActive(e.key === 'ArrowDown' ? Math.min(active + 1, items.length - 1) : Math.max(active - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      if (listOpen && active >= 0 && items[active] !== undefined) { e.preventDefault(); add([items[active]!]); onTextChange(''); closeSuggest(); return }
      if (text.trim() !== '') { e.preventDefault(); commit() }
      return // пустой текст — Enter уходит в форму (применить фильтр)
    }
    if (text !== '') return
    if (e.key === 'Backspace') { e.preventDefault(); if (sel === null) { if (value.length > 0) setSel(value.length - 1) } else remove(sel) }
    else if (e.key === 'Delete') { if (sel !== null) { e.preventDefault(); remove(sel) } }
    else if (e.key === 'ArrowLeft') { if (value.length > 0) { e.preventDefault(); setSel(sel === null ? value.length - 1 : Math.max(sel - 1, 0)) } }
    else if (e.key === 'ArrowRight') { if (sel !== null) { e.preventDefault(); setSel(sel + 1 >= value.length ? null : sel + 1) } }
  }

  return (
    <span className={s.tagBox}>
      <span ref={anchor} className={[is.field, size === 's' ? is.sizeS : is.sizeM, s.tagField].join(' ')}>
        {value.length > 0 && (
          <ul className={s.tags} aria-label={name}>
            {value.map((v, i) => {
              const bad = validate !== undefined && !validate(v)
              return (
                <li key={v} className={s.tag} data-selected={sel === i || undefined} data-invalid={bad || undefined}>
                  <span className={s.tagText}>{v}</span>
                  {bad && <span className={s.sr}> — неверное значение</span>}
                  {!disabled && <IconButton size="s" tabIndex={-1} label={`Убрать: ${v}`} className={s.tagX} onClick={() => remove(i)}><Cross /></IconButton>}
                </li>
              )
            })}
          </ul>
        )}
        <input
          id={id}
          aria-label={name}
          role={withSuggest ? 'combobox' : undefined}
          aria-expanded={withSuggest ? listOpen : undefined}
          aria-controls={withSuggest && listOpen ? listId : undefined}
          aria-autocomplete={withSuggest ? 'list' : undefined}
          aria-activedescendant={listOpen && active >= 0 && items[active] !== undefined ? optionId(listId, active) : undefined}
          aria-describedby={note ? noteId : undefined}
          autoComplete="off"
          disabled={disabled}
          className={[is.input, s.tagInput].join(' ')}
          placeholder={value.length === 0 ? placeholder : undefined}
          value={text}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={onKey}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData('text')
            if (!pasted) return
            e.preventDefault()
            add(splitTags(text + pasted, mode))
            onTextChange('')
            closeSuggest()
          }}
          onFocus={() => { if (text.trim() !== '') onQuery?.(text) }}
          onBlur={() => { setSel(null); closeSuggest() }}
        />
      </span>
      {note && <span id={noteId} role="status" className={s.note}>{note}</span>}
      {withSuggest && (
        <Popover open={listOpen} anchor={anchor} onClose={closeSuggest} role="presentation" className={s.pop}>
          {items.length === 0
            ? <div className={s.loading}>Ищу…</div>
            : <Listbox id={listId} label={`Подсказки: ${name}`} options={items.map((x) => ({ value: x, label: x }))} active={active} isSelected={() => false}
                onPick={(o) => { add([String(o.value)]); onTextChange(''); closeSuggest() }} onActive={setActive} highlight={text} />}
        </Popover>
      )}
    </span>
  )
}
```

`fireEvent.paste` в jsdom передаёт `clipboardData` из объекта инициализации — тест выше на это полагается. `key={v}` у чипов уникален: повторы в значении отсекает `mergeTags`.

- [ ] **Step 5: Стили.** `packages/ui/src/tag/Tag.module.css`:

```css
.tagBox {
  display: inline-grid;
  gap: var(--k-sp-1);
  min-width: 0;
}

/* поле растёт по высоте при переносе чипов, до трёх строк, дальше прокручивается */
.tagField {
  flex-wrap: wrap;
  align-content: flex-start;
  height: auto;
  min-height: var(--k-h-ctl-s);
  max-height: var(--k-tag-max-h);
  padding-top: calc(var(--k-sp-1) / 2);
  padding-bottom: calc(var(--k-sp-1) / 2);
  overflow-y: auto;
}

/* список чипов — гибкий блок внутри поля, строка ввода рядом; не display: contents — в Chromium 88
   он убирает <ul> из дерева доступности, и роль списка теряется */
.tags {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  gap: var(--k-sp-1);
  max-width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: calc(var(--k-h-ctl-s) - var(--k-sp-1));
  padding-left: var(--k-sp-1);
  border: 1px solid transparent;
  border-radius: var(--k-r-s);
  background: var(--k-val-soft);
  color: var(--k-ink);
  font-size: var(--k-fs-2);
}

.tag[data-selected] {
  border-color: var(--k-val);
}

.tag[data-invalid] {
  border-color: var(--k-bad);
  background: var(--k-bad-soft);
}

.tagText {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tagX {
  flex: none;
  color: var(--k-muted);
}

.tagInput {
  flex: 1;
  min-width: var(--k-sp-8);
  height: calc(var(--k-h-ctl-s) - var(--k-sp-1));
}

.note {
  font-size: var(--k-fs-2);
  color: var(--k-ink2);
}

.pop {
  min-width: var(--k-filter-field);
}

.loading {
  padding: var(--k-sp-2);
  color: var(--k-muted);
}

/* текст только для скринридера — как у живой области провайдера */
.sr {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

Контраст: `ink` на `bad-soft` — проверить, есть ли пара в `contrast.rules.ts`; если нет — добавить `{ fg: 'ink', bg: ['bad-soft'], min: 4.5, note: 'текст невалидного чипа' }` (у `ink` на светлых подложках запас большой), `pnpm --filter @katran/tokens exec vitest run` → PASS.

`packages/ui/src/tag/index.ts`:

```ts
export { mergeTags, splitTags, takeTags, TAG_LIMIT, type TagMode } from './parseTags'
export { TagInput, type TagInputProps } from './TagInput'
```

В `packages/ui/src/index.ts` после `export * from './select'` — `export * from './tag'`.

- [ ] **Step 6: Прогон.** `pnpm --filter @katran/ui exec vitest run src/tag` → PASS; `pnpm check` → зелёный.

- [ ] **Step 7: Commit** — `TagInput: списки значений и фраз чипами — разделители по режиму, разбор вставки и кавычек, предел, клавиатура по чипам, подсказки`.

---

### Task 8: Модель фильтров — несколько условий на поле и подсказки

**Files:**
- Modify: `packages/ui/src/filters/types.ts`, `packages/effector/src/types.ts`, `packages/effector/src/createFiltersModel.ts`, `packages/effector/src/createFiltersModel.test.ts`, `packages/effector/src/useFilters.ts`, `packages/effector/src/hooks.test.tsx`, `packages/effector/src/index.ts`

**Interfaces:**
- Produces (`@katran/ui`): `FilterField.defaultOp?: Condition['op'] | undefined`, `FilterField.suggest?: boolean | undefined`, `SuggestState = { field: string; query: string; items: string[]; loading: boolean }`.
- Produces (`@katran/effector`): `SuggestQuery = { field: string; query: string; filter: Filter; limit: number }`, реэкспорт `SuggestState`; `SuggestConfig = { fetchFx: Effect<SuggestQuery, string[]>; delay?; minChars?; limit? }`; `FiltersModelConfig.suggest?`; `FiltersModel.setField: EventCallable<{ field: string; conditions: Condition[] }>`, `.suggest: EventCallable<{ field: string; query: string }>`, `.closeSuggest: EventCallable<void>`, `.$suggest: Store<SuggestState | null>`; `FiltersBinding` += `setField`, `suggest: SuggestState | null`, `onSuggest`, `onSuggestClose`.

- [ ] **Step 1: Типы.** В `packages/ui/src/filters/types.ts` у `FilterField` после `group?` добавить:

```ts
  /** Оператор по умолчанию (defaultOperator контракта §6): у STRING и NUMBER `IN` включает ввод списка значений. */
  defaultOp?: Condition['op'] | undefined
  /** У поля есть подсказки с бека (предложение в контракт, спека 2026-09-30 §9). */
  suggest?: boolean | undefined
```

и в конец файла:

```ts
/** Подсказки поля фильтра — стор модели фильтров (спека 2026-09-30 §8). */
export type SuggestState = { field: string; query: string; items: string[]; loading: boolean }
```

В `packages/effector/src/types.ts` строку реэкспорта типов фильтра дополнить `SuggestState`, в `import type { … } from '@katran/ui'` уже есть `Filter`; добавить:

```ts
/** Тело POST /grids/{gridId}/suggest (предложение в контракт): filter — применённые условия без условий по field. */
export type SuggestQuery = { field: string; query: string; filter: Filter; limit: number }
```

- [ ] **Step 2: Тесты модели.** В `packages/effector/src/createFiltersModel.test.ts` (в шапку: `import { allSettled, createEffect, fork } from 'effector'`, `import type { Condition, SuggestQuery } from './types'`) добавить:

```ts
describe('setField: несколько условий на поле (контракт §4.4 — AND)', () => {
  const a1: Condition = { field: 'purpose', op: 'CONTAINS', value: 'счёт не найден' }
  const a2: Condition = { field: 'purpose', op: 'CONTAINS', value: 'инструкция инвалидна' }
  const b: Condition = { field: 'status', op: 'EQ', value: 'ERROR' }
  it('заменяет все условия поля, место поля в порядке сохраняется', async () => {
    const m = createFiltersModel({ initial: [{ field: 'purpose', op: 'CONTAINS', value: 'x' }, b] })
    const scope = fork()
    await allSettled(m.setField, { scope, params: { field: 'purpose', conditions: [a1, a2] } })
    expect(scope.getState(m.$draft)).toEqual([a1, a2, b])
    await allSettled(m.edit, { scope, params: { field: 'purpose', op: 'CONTAINS', value: 'y' } })
    expect(scope.getState(m.$draft)).toEqual([{ field: 'purpose', op: 'CONTAINS', value: 'y' }, b])
    await allSettled(m.setField, { scope, params: { field: 'purpose', conditions: [] } })
    expect(scope.getState(m.$draft)).toEqual([b])
  })
  it('новое поле — в конец; remove снимает все условия поля', async () => {
    const m = createFiltersModel({ initial: [b] })
    const scope = fork()
    await allSettled(m.setField, { scope, params: { field: 'purpose', conditions: [a1, a2] } })
    await allSettled(m.apply, { scope })
    expect(scope.getState(m.$conditions)).toEqual([b, a1, a2])
    await allSettled(m.remove, { scope, params: 'purpose' })
    expect(scope.getState(m.$conditions)).toEqual([b])
  })
  it('$lane — только при одном условии EQ по полю лейна', async () => {
    const m = createFiltersModel({ laneField: 'status' })
    const scope = fork()
    await allSettled(m.setLane, { scope, params: 'ERROR' })
    expect(scope.getState(m.$lane)).toBe('ERROR')
    await allSettled(m.setField, { scope, params: { field: 'status', conditions: [b, { field: 'status', op: 'NE', value: 'DONE' }] } })
    await allSettled(m.apply, { scope })
    expect(scope.getState(m.$lane)).toBeNull()
  })
})

describe('подсказки', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  const initial: Condition[] = [{ field: 'status', op: 'EQ', value: 'ERROR' }, { field: 'f50name', op: 'CONTAINS', value: 'x' }]
  const mk = (impl: (q: SuggestQuery) => Promise<string[]> = async (q) => [`${q.query}-1`]) => {
    const calls: SuggestQuery[] = []
    const fetchFx = createEffect<SuggestQuery, string[]>((q) => { calls.push(q); return impl(q) })
    return { m: createFiltersModel({ initial, suggest: { fetchFx } }), calls }
  }

  it('без конфигурации — $suggest всегда null', async () => {
    const m = createFiltersModel()
    const scope = fork()
    await allSettled(m.suggest, { scope, params: { field: 'a', query: 'b' } })
    expect(scope.getState(m.$suggest)).toBeNull()
  })
  it('короче minChars — пусто, без запроса', async () => {
    const { m, calls } = mk()
    const scope = fork()
    await allSettled(m.suggest, { scope, params: { field: 'f50name', query: ' ' } })
    expect(scope.getState(m.$suggest)).toEqual({ field: 'f50name', query: ' ', items: [], loading: false })
    expect(calls).toEqual([])
  })
  it('задержка: один запрос с последним текстом, фильтр без условий поля, limit', async () => {
    const { m, calls } = mk()
    const scope = fork()
    const p1 = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'ва' } })
    await vi.advanceTimersByTimeAsync(100)
    const p2 = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'вас ' } })
    expect(scope.getState(m.$suggest)).toEqual({ field: 'f50name', query: 'вас ', items: [], loading: true })
    await vi.advanceTimersByTimeAsync(300)
    await Promise.all([p1, p2])
    expect(calls).toEqual([{ field: 'f50name', query: 'вас', filter: [{ field: 'status', op: 'EQ', value: 'ERROR' }], limit: 10 }])
    expect(scope.getState(m.$suggest)).toEqual({ field: 'f50name', query: 'вас ', items: ['вас-1'], loading: false })
  })
  it('устаревший ответ отбрасывается', async () => {
    const release: Record<string, (v: string[]) => void> = {}
    const { m } = mk((q) => new Promise<string[]>((r) => { release[q.query] = r }))
    const scope = fork()
    const p1 = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'ва' } })
    await vi.advanceTimersByTimeAsync(260)
    const p2 = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'вас' } })
    await vi.advanceTimersByTimeAsync(260)
    release['вас']!(['новый'])
    release['ва']!(['старый'])
    await Promise.all([p1, p2])
    expect(scope.getState(m.$suggest)?.items).toEqual(['новый'])
  })
  it('closeSuggest — null, поздний ответ отбрасывается; ошибка — пусто без загрузки', async () => {
    const release: Array<(v: string[]) => void> = []
    const { m } = mk(() => new Promise<string[]>((r) => { release.push(r) }))
    const scope = fork()
    const p = allSettled(m.suggest, { scope, params: { field: 'f50name', query: 'ва' } })
    await vi.advanceTimersByTimeAsync(260)
    await allSettled(m.closeSuggest, { scope })
    release[0]!(['поздно'])
    await p
    expect(scope.getState(m.$suggest)).toBeNull()

    const { m: m2 } = mk(async () => { throw new Error('нет') })
    const s2 = fork()
    const p2 = allSettled(m2.suggest, { scope: s2, params: { field: 'f50name', query: 'ва' } })
    await vi.advanceTimersByTimeAsync(260)
    await p2
    expect(s2.getState(m2.$suggest)).toEqual({ field: 'f50name', query: 'ва', items: [], loading: false })
  })
})
```

В `hooks.test.tsx`, `describe('useFilters')`, добавить:

```tsx
  it('setField и подсказки через хук', () => {
    const model = createFiltersModel()
    const { result } = renderHook(() => useFilters(model))
    act(() => { result.current.setField({ field: 'purpose', conditions: [{ field: 'purpose', op: 'CONTAINS', value: 'a' }, { field: 'purpose', op: 'CONTAINS', value: 'b' }] }) })
    expect(result.current.draft).toHaveLength(2)
    expect(result.current.suggest).toBeNull()
    act(() => { result.current.onSuggest({ field: 'purpose', query: 'x' }) })
    act(() => { result.current.onSuggestClose() })
    expect(result.current.suggest).toBeNull()
  })
```

Run: `pnpm --filter @katran/effector exec vitest run` → FAIL.

- [ ] **Step 3: Реализация.** В `packages/effector/src/createFiltersModel.ts`:
  - импорт: `import { attach, combine, createEffect, createEvent, createStore, is, sample, type Effect, type EventCallable, type Store } from 'effector'`, типы — `Condition, Filter, FilterMeta, Scalar, SuggestQuery, SuggestState` из `./types`;
  - добавить тип конфигурации и расширить типы модели:

```ts
export type SuggestConfig = {
  fetchFx: Effect<SuggestQuery, string[]>
  /** Задержка после последнего ввода, мс; по умолчанию 250. */
  delay?: number | undefined
  /** Короче — без запроса; по умолчанию 1. */
  minChars?: number | undefined
  /** Сколько подсказок просить; по умолчанию 10. */
  limit?: number | undefined
}
```

`FiltersModelConfig` += `/** Подсказки с бека (спека 2026-09-30 §8); нет — $suggest всегда null. */ suggest?: SuggestConfig | undefined`. `FiltersModel` += 

```ts
  /** Все условия поля разом (контракт §4.4: несколько условий по полю — AND); пустой список снимает поле из черновика. */
  setField: EventCallable<{ field: string; conditions: Condition[] }>
  /** Ввод в поле с подсказками. */
  suggest: EventCallable<{ field: string; query: string }>
  closeSuggest: EventCallable<void>
  $suggest: Store<SuggestState | null>
```

  - заменить `upsert` на `replaceField` и перевести на него `edit` и лейн:

```ts
type FieldConditions = { field: string; conditions: Condition[] }
/** Заменить условия поля: место поля в списке — место его первого условия; новое поле — в конец. */
const replaceField = (list: Filter, { field, conditions }: FieldConditions): Filter => {
  const own = conditions.filter((c) => c.field === field)
  const i = list.findIndex((x) => x.field === field)
  if (i < 0) return own.length === 0 ? list : [...list, ...own]
  return [...list.slice(0, i), ...own, ...list.slice(i).filter((x) => x.field !== field)]
}
const single = (c: Condition): FieldConditions => ({ field: c.field, conditions: [c] })
```

  - в теле: `const setField = createEvent<FieldConditions>()`; `applyLane` → `lane === null ? list : replaceField(list, { field: lane, conditions: v === null ? [] : [{ field: lane, op: 'EQ', value: v }] })`; цепочка `$draft` → `.on(edit, (l, c) => replaceField(l, single(c))).on(setField, replaceField).on(discard, without).on(remove, without).on(reset, () => []).on(setLane, applyLane)`;
  - `$lane`:

```ts
  const $lane = $conditions.map((list): Scalar | null => {
    if (lane === null) return null
    const own = list.filter((x) => x.field === lane)
    return own.length === 1 && own[0]!.op === 'EQ' ? own[0]!.value : null
  })
```

  - подсказки — после `$lane`, до `return`:

```ts
  // --- подсказки (спека 2026-09-30 §8): задержка ввода — эффект-таймер модели, свой attach-экземпляр транспорта,
  // ответ принимается только на последний отправленный запрос (сравнение по значению) ---
  const suggest = createEvent<{ field: string; query: string }>()
  const closeSuggest = createEvent<void>()
  const $suggest = createStore<SuggestState | null>(null)
  if (cfg.suggest) {
    const { fetchFx, delay = 250, minChars = 1, limit = 10 } = cfg.suggest
    const short = (q: string) => q.trim().length < minChars
    const requestFx = attach({ effect: fetchFx })
    const waitFx = createEffect((q: SuggestQuery) => new Promise<SuggestQuery>((resolve) => { setTimeout(() => resolve(q), delay) }))
    const $pending = createStore<SuggestQuery | null>(null)
    $suggest
      .on(suggest, (st, { field, query }) => (short(query)
        ? { field, query, items: [], loading: false }
        : { field, query, items: st !== null && st.field === field ? st.items : [], loading: true }))
      .on(closeSuggest, () => null)
    const asked = sample({
      clock: suggest,
      source: $conditions,
      filter: (_, { query }) => !short(query),
      fn: (conds, { field, query }): SuggestQuery => ({ field, query: query.trim(), filter: conds.filter((c) => c.field !== field), limit }),
    })
    $pending.on(suggest, (p, { query }) => (short(query) ? null : p)).on(asked, (_, q) => q).on(closeSuggest, () => null)
    const same1 = (a: SuggestQuery, b: SuggestQuery) => JSON.stringify(a) === JSON.stringify(b)
    sample({ clock: asked, target: waitFx })
    sample({ clock: waitFx.doneData, source: $pending, filter: (p, q) => p !== null && same1(p, q), fn: (_, q) => q, target: requestFx })
    const got = sample({ clock: requestFx.done, source: $pending, filter: (p, { params }) => p !== null && same1(p, params), fn: (_, { result }) => result })
    const failed = sample({ clock: requestFx.fail, source: $pending, filter: (p, { params }) => p !== null && same1(p, params) })
    $suggest
      .on(got, (st, items) => (st === null ? st : { ...st, items, loading: false }))
      .on(failed, (st) => (st === null ? st : { ...st, items: [], loading: false }))
  }
```

  - сигнатура фабрики: `export function createFiltersModel(cfg: FiltersModelConfig = {}): FiltersModel` и внутри `const { meta, initial = [], laneField } = cfg`; в `return` добавить `setField, suggest, closeSuggest, $suggest`.

`useFilters.ts`:

```ts
export type FiltersBinding = {
  conditions: Filter
  draft: Filter
  dirty: boolean
  lane: Scalar | null
  meta: FilterMeta | null
  suggest: SuggestState | null
  edit: (c: Condition) => void
  setField: (p: { field: string; conditions: Condition[] }) => void
  discard: (field: string) => void
  apply: () => void
  revert: () => void
  reset: () => void
  remove: (field: string) => void
  setLane: (v: Scalar | null) => void
  onSuggest: (p: { field: string; query: string }) => void
  onSuggestClose: () => void
}

export function useFilters(m: FiltersModel): FiltersBinding {
  const [conditions, draft, dirty, lane, meta, suggest] = useUnit([m.$conditions, m.$draft, m.$dirty, m.$lane, m.$meta, m.$suggest])
  const [edit, setField, discard, apply, revert, reset, remove, setLane, onSuggest, onSuggestClose] = useUnit([m.edit, m.setField, m.discard, m.apply, m.revert, m.reset, m.remove, m.setLane, m.suggest, m.closeSuggest])
  return { conditions, draft, dirty, lane, meta, suggest, edit, setField, discard, apply, revert, reset, remove, setLane, onSuggest, onSuggestClose }
}
```

`packages/effector/src/index.ts`: экспорт `type SuggestConfig` рядом с `createFiltersModel`.

- [ ] **Step 4: Прогон.** `pnpm --filter @katran/effector exec vitest run` → PASS (вывод без необработанных отказов: ошибка `fetchFx` в тесте ловится `requestFx.fail`); `pnpm check` → зелёный.

- [ ] **Step 5: Commit** — `Модель фильтров: setField — несколько условий на поле, подсказки с бека — задержка, отсечение устаревших ответов, suggestFx приложения`.

---

### Task 9: Логика полей панели и чипов

**Files:**
- Modify: `packages/ui/src/filters/fieldOps.ts`, `packages/ui/src/filters/fieldOps.test.ts`, `packages/ui/src/filters/opLabels.ts`, `packages/ui/src/filters/opLabels.test.ts`

**Interfaces:**
- Consumes: `dateStr` (Task 1: `dayOf`, `isoDayStart`, `isoDayEnd`, `isoMinuteStart`, `isoMinuteEnd`, `formatDateText`, `withTime`, `datePartOf`, `DateValue`, `DateFormat`), `DateRangeValue` (Task 4, `import type`), `splitTags`, `mergeTags` (Task 7), `FilterField.defaultOp` (Task 8).
- Produces (`fieldOps.ts`, внутренние для панели): `FieldControl = 'values' | 'phrases' | 'number' | 'dateRange' | 'enum' | 'boolean'`, `FieldRaw` (union ниже), `fieldControl(f)`, `fieldMax(f)`, `rangeToDisabled(f)`, `isNumberText(t)`, `draftOf(draft, f): FieldRaw`, `conditionsFrom(f, raw): Condition[]`. `isoDayStart`/`isoDayEnd` из `fieldOps.ts` удаляются — теперь они в `date/dateStr.ts`. Produces (`opLabels.ts`, публичные): `FieldChip = { field; op; value; full }`, `fieldChip(fieldId, conditions, meta?, format?)`, `describeField(fieldId, conditions, meta?, format?) → string`.

```ts
export type FieldRaw =
  | { kind: 'text'; value: string }                      // NUMBER без списка, BOOLEAN ('true' | 'false' | '')
  | { kind: 'tags'; value: string[]; text: string }      // списки значений и фразы: чипы + набираемый текст
  | { kind: 'range'; value: DateRangeValue }            // DATE, DATETIME
  | { kind: 'enum'; value: Scalar[] }                   // ENUM
```

- [ ] **Step 1: Тест логики полей.** Заменить `packages/ui/src/filters/fieldOps.test.ts`:

```ts
import { conditionsFrom, draftOf, fieldControl, fieldMax, rangeToDisabled } from './fieldOps'
import type { FilterField } from './types'

const F = (type: FilterField['type'], extra: Partial<FilterField> = {}): FilterField => ({ id: 'x', label: 'X', type, ops: [], ...extra })

describe('fieldControl', () => {
  it('контрол по типу и defaultOp', () => {
    expect(fieldControl(F('STRING'))).toBe('phrases')
    expect(fieldControl(F('STRING', { defaultOp: 'IN' }))).toBe('values')
    expect(fieldControl(F('NUMBER'))).toBe('number')
    expect(fieldControl(F('NUMBER', { defaultOp: 'IN' }))).toBe('values')
    expect(fieldControl(F('DATE'))).toBe('dateRange')
    expect(fieldControl(F('DATETIME'))).toBe('dateRange')
    expect(fieldControl(F('ENUM'))).toBe('enum')
    expect(fieldControl(F('BOOLEAN'))).toBe('boolean')
  })
  it('сужение операторов метой', () => {
    expect(fieldControl(F('STRING', { ops: ['IS_EMPTY'] }))).toBeNull()
    expect(fieldControl(F('DATETIME', { ops: ['IS_EMPTY'] }))).toBeNull()
    expect(fieldMax(F('ENUM', { ops: ['EQ'] }))).toBe(1)
    expect(fieldMax(F('ENUM'))).toBeUndefined()
    expect(rangeToDisabled(F('DATE', { ops: ['EQ', 'GTE'] }))).toBe(true)
    expect(rangeToDisabled(F('DATE'))).toBe(false)
  })
})

describe('conditionsFrom', () => {
  it('фразы: каждая — своё CONTAINS; набираемый текст — ещё одна фраза; повторы без учёта регистра', () => {
    expect(conditionsFrom(F('STRING'), { kind: 'tags', value: ['счёт не найден', 'Инструкция'], text: 'инструкция' })).toEqual([
      { field: 'x', op: 'CONTAINS', value: 'счёт не найден' }, { field: 'x', op: 'CONTAINS', value: 'Инструкция' },
    ])
    expect(conditionsFrom(F('STRING'), { kind: 'tags', value: [], text: 'Василёк' })).toEqual([{ field: 'x', op: 'CONTAINS', value: 'Василёк' }])
    expect(conditionsFrom(F('STRING', { ops: ['STARTS_WITH', 'EQ'] }), { kind: 'tags', value: ['a'], text: '' })).toEqual([{ field: 'x', op: 'STARTS_WITH', value: 'a' }])
  })
  it('списки: одно — EQ, два и больше — IN; числа, невалидные отбрасываются; без IN — одно', () => {
    const S = F('STRING', { defaultOp: 'IN' })
    expect(conditionsFrom(S, { kind: 'tags', value: ['400'], text: '' })).toEqual([{ field: 'x', op: 'EQ', value: '400' }])
    expect(conditionsFrom(S, { kind: 'tags', value: ['400', '403'], text: '406 407' })).toEqual([{ field: 'x', op: 'IN', values: ['400', '403', '406', '407'] }])
    const N = F('NUMBER', { defaultOp: 'IN' })
    expect(conditionsFrom(N, { kind: 'tags', value: ['400', 'abc', '1 000,5'], text: '' })).toEqual([{ field: 'x', op: 'IN', values: [400, 1000.5] }])
    expect(conditionsFrom(F('STRING', { defaultOp: 'IN', ops: ['EQ'] }), { kind: 'tags', value: ['1', '2'], text: '' })).toEqual([{ field: 'x', op: 'EQ', value: '1' }])
    expect(conditionsFrom(S, { kind: 'tags', value: [], text: ' ' })).toEqual([])
  })
  it('DATE: равные — EQ, разные — BETWEEN, одна граница — GTE/LTE, без GTE — день', () => {
    const D = F('DATE')
    expect(conditionsFrom(D, { kind: 'range', value: { from: '2026-09-01', to: '2026-09-01' } })).toEqual([{ field: 'x', op: 'EQ', value: '2026-09-01' }])
    expect(conditionsFrom(D, { kind: 'range', value: { from: '2026-09-01', to: '2026-09-13' } })).toEqual([{ field: 'x', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' }])
    expect(conditionsFrom(D, { kind: 'range', value: { from: '2026-09-01', to: '' } })).toEqual([{ field: 'x', op: 'GTE', value: '2026-09-01' }])
    expect(conditionsFrom(D, { kind: 'range', value: { from: '', to: '2026-09-13' } })).toEqual([{ field: 'x', op: 'LTE', value: '2026-09-13' }])
    expect(conditionsFrom(F('DATE', { ops: ['EQ'] }), { kind: 'range', value: { from: '2026-09-01', to: '' } })).toEqual([{ field: 'x', op: 'EQ', value: '2026-09-01' }])
    expect(conditionsFrom(D, { kind: 'range', value: { from: '', to: '' } })).toEqual([])
  })
  it('DATETIME: границы дня или минуты со смещением', () => {
    const T = F('DATETIME')
    const [c] = conditionsFrom(T, { kind: 'range', value: { from: '2026-09-01', to: '2026-09-02T18:30' } })
    expect(c).toMatchObject({ op: 'BETWEEN' })
    expect(c!.op === 'BETWEEN' && String(c.from).slice(0, 19)).toBe('2026-09-01T00:00:00')
    expect(c!.op === 'BETWEEN' && String(c.to).slice(0, 19)).toBe('2026-09-02T18:30:59')
    const [g] = conditionsFrom(T, { kind: 'range', value: { from: '2026-09-01T09:30', to: '' } })
    expect(g!.op === 'GTE' && String(g.value).slice(0, 19)).toBe('2026-09-01T09:30:00')
  })
  it('ENUM, NUMBER, BOOLEAN', () => {
    expect(conditionsFrom(F('ENUM'), { kind: 'enum', value: ['ERROR'] })).toEqual([{ field: 'x', op: 'EQ', value: 'ERROR' }])
    expect(conditionsFrom(F('ENUM'), { kind: 'enum', value: ['ERROR', 'DONE'] })).toEqual([{ field: 'x', op: 'IN', values: ['ERROR', 'DONE'] }])
    expect(conditionsFrom(F('ENUM', { ops: ['IN'] }), { kind: 'enum', value: ['ERROR'] })).toEqual([{ field: 'x', op: 'IN', values: ['ERROR'] }])
    expect(conditionsFrom(F('NUMBER'), { kind: 'text', value: '1,5' })).toEqual([{ field: 'x', op: 'EQ', value: 1.5 }])
    expect(conditionsFrom(F('NUMBER'), { kind: 'text', value: '-' })).toEqual([])
    expect(conditionsFrom(F('BOOLEAN'), { kind: 'text', value: 'false' })).toEqual([{ field: 'x', op: 'EQ', value: false }])
  })
})

describe('draftOf', () => {
  it('восстанавливает сырое значение из условий поля', () => {
    expect(draftOf([{ field: 'x', op: 'CONTAINS', value: 'a' }, { field: 'x', op: 'CONTAINS', value: 'b' }], F('STRING'))).toEqual({ kind: 'tags', value: ['a', 'b'], text: '' })
    expect(draftOf([{ field: 'x', op: 'IN', values: [400, 403] }], F('NUMBER', { defaultOp: 'IN' }))).toEqual({ kind: 'tags', value: ['400', '403'], text: '' })
    expect(draftOf([{ field: 'x', op: 'GTE', value: '2026-09-01' }], F('DATE'))).toEqual({ kind: 'range', value: { from: '2026-09-01', to: '' } })
    expect(draftOf([{ field: 'x', op: 'BETWEEN', from: '2026-09-01T00:00:00+03:00', to: '2026-09-02T18:30:59+03:00' }], F('DATETIME')))
      .toEqual({ kind: 'range', value: { from: '2026-09-01', to: '2026-09-02T18:30' } })
    expect(draftOf([{ field: 'x', op: 'EQ', value: 'ERROR' }], F('ENUM'))).toEqual({ kind: 'enum', value: ['ERROR'] })
    expect(draftOf([], F('BOOLEAN'))).toEqual({ kind: 'text', value: '' })
  })
})
```

- [ ] **Step 2: Реализация.** Заменить `packages/ui/src/filters/fieldOps.ts`:

```ts
import { dayOf, isoDayEnd, isoDayStart, isoMinuteEnd, isoMinuteStart, type DateValue } from '../date/dateStr'
import type { DateRangeValue } from '../date/DateRange'
import { mergeTags, splitTags } from '../tag/parseTags'
import type { Condition, Filter, FilterField, Scalar } from './types'

/** Контрол поля панели simple (спека 2026-09-30 §6.2). */
export type FieldControl = 'values' | 'phrases' | 'number' | 'dateRange' | 'enum' | 'boolean'
export type FieldRaw =
  | { kind: 'text'; value: string }
  | { kind: 'tags'; value: string[]; text: string }
  | { kind: 'range'; value: DateRangeValue }
  | { kind: 'enum'; value: Scalar[] }

const allows = (f: FilterField, op: Condition['op']) => f.ops.length === 0 || f.ops.includes(op)

/** Контрол по типу поля и defaultOp; null — в simple-режиме поле не показывается. */
export function fieldControl(f: FilterField): FieldControl | null {
  switch (f.type) {
    case 'STRING':
      if (f.defaultOp === 'IN') return allows(f, 'IN') || allows(f, 'EQ') ? 'values' : null
      return allows(f, 'CONTAINS') || allows(f, 'STARTS_WITH') || allows(f, 'EQ') ? 'phrases' : null
    case 'NUMBER':
      if (f.defaultOp === 'IN') return allows(f, 'IN') || allows(f, 'EQ') ? 'values' : null
      return allows(f, 'EQ') ? 'number' : null
    case 'DATE': return (['EQ', 'BETWEEN', 'GTE', 'LTE'] as const).some((op) => allows(f, op)) ? 'dateRange' : null
    case 'DATETIME': return (['BETWEEN', 'GTE', 'LTE'] as const).some((op) => allows(f, op)) ? 'dateRange' : null
    case 'ENUM': return allows(f, 'EQ') || allows(f, 'IN') ? 'enum' : null
    case 'BOOLEAN': return allows(f, 'EQ') ? 'boolean' : null
  }
}
/** Предел числа значений: без IN — одно. */
export const fieldMax = (f: FilterField): number | undefined => (allows(f, 'IN') ? undefined : 1)
/** Поле «по» периода недоступно: различные границы без BETWEEN не выразить (спека §6.2). */
export const rangeToDisabled = (f: FilterField): boolean => !allows(f, 'BETWEEN')

const toNum = (t: string): number | null => {
  const s = t.replace(/\s/g, '').replace(',', '.')
  if (s === '' || s === '-' || s === '.') return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}
export const isNumberText = (t: string): boolean => toNum(t) !== null

const WALL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
/** Граница DATETIME (ISO со смещением) → настенное значение поля: начало или конец дня — день, иначе минута. */
function wall(v: Scalar, edge: 'from' | 'to'): DateValue {
  const s = String(v)
  const m = WALL.exec(s)
  if (!m) return s.slice(0, 10)
  const [, day = '', hh = '', mm = '', ss = '00'] = m
  if (edge === 'from' && hh === '00' && mm === '00' && ss === '00') return day
  if (edge === 'to' && hh === '23' && mm === '59' && ss === '59') return day
  return `${day}T${hh}:${mm}`
}
function rangeOf(cs: Condition[], dt: boolean): DateRangeValue {
  const at = (v: Scalar, edge: 'from' | 'to'): DateValue => (dt ? wall(v, edge) : String(v).slice(0, 10))
  let from: DateValue = ''
  let to: DateValue = ''
  for (const c of cs) {
    if (c.op === 'BETWEEN') { from = at(c.from, 'from'); to = at(c.to, 'to') }
    else if (c.op === 'EQ') { from = at(c.value, 'from'); to = from }
    else if (c.op === 'GTE' || c.op === 'GT') from = at(c.value, 'from')
    else if (c.op === 'LTE' || c.op === 'LT') to = at(c.value, 'to')
  }
  return { from, to }
}

/** Сырое значение контрола из условий поля в черновике. */
export function draftOf(draft: Filter, f: FilterField): FieldRaw {
  const cs = draft.filter((c) => c.field === f.id)
  const scalars = (): Scalar[] => cs.flatMap((c) => (c.op === 'IN' || c.op === 'NOT_IN' ? c.values : 'value' in c ? [c.value] : []))
  switch (fieldControl(f)) {
    case 'values':
    case 'phrases': return { kind: 'tags', value: scalars().map(String), text: '' }
    case 'dateRange': return { kind: 'range', value: rangeOf(cs, f.type === 'DATETIME') }
    case 'enum': return { kind: 'enum', value: scalars() }
    default: { const c = cs[0]; return { kind: 'text', value: c !== undefined && 'value' in c ? String(c.value) : '' } }
  }
}

function rangeConditions(f: FilterField, { from, to }: DateRangeValue): Condition[] {
  const id = f.id
  const dt = f.type === 'DATETIME'
  const lo = (v: DateValue): string => (dt ? (v.length > 10 ? isoMinuteStart(v) : isoDayStart(v)) : dayOf(v))
  const hi = (v: DateValue): string => (dt ? (v.length > 10 ? isoMinuteEnd(v) : isoDayEnd(v)) : dayOf(v))
  if (from && to) {
    if (!dt && dayOf(from) === dayOf(to) && allows(f, 'EQ')) return [{ field: id, op: 'EQ', value: dayOf(from) }]
    if (allows(f, 'BETWEEN')) return [{ field: id, op: 'BETWEEN', from: lo(from), to: hi(to) }]
  }
  if (from && allows(f, 'GTE')) return [{ field: id, op: 'GTE', value: lo(from) }]
  if (!from && to && allows(f, 'LTE')) return [{ field: id, op: 'LTE', value: hi(to) }]
  // без GTE/LTE одна граница сводится к дню (DATE — EQ) или к дню/минуте (DATETIME — BETWEEN)
  const one = from || to
  if (!one) return []
  if (!dt && allows(f, 'EQ')) return [{ field: id, op: 'EQ', value: dayOf(one) }]
  if (allows(f, 'BETWEEN')) return [{ field: id, op: 'BETWEEN', from: lo(one), to: hi(one) }]
  return []
}

/** Условия поля из сырого значения контрола; [] — снять поле. */
export function conditionsFrom(f: FilterField, raw: FieldRaw): Condition[] {
  const id = f.id
  switch (raw.kind) {
    case 'tags': {
      const phrases = fieldControl(f) === 'phrases'
      const mode = phrases ? 'phrases' : 'values'
      const all = mergeTags([], [...raw.value, ...splitTags(raw.text, mode)], mode, Number.POSITIVE_INFINITY).value
      if (phrases) {
        const op = allows(f, 'CONTAINS') ? 'CONTAINS' : allows(f, 'STARTS_WITH') ? 'STARTS_WITH' : 'EQ'
        return all.map((v) => ({ field: id, op, value: v }))
      }
      const vals: Scalar[] = f.type === 'NUMBER' ? all.map(toNum).filter((n): n is number => n !== null) : all
      if (vals.length === 0) return []
      if (vals.length === 1) return [allows(f, 'EQ') ? { field: id, op: 'EQ', value: vals[0]! } : { field: id, op: 'IN', values: vals }]
      return [allows(f, 'IN') ? { field: id, op: 'IN', values: vals } : { field: id, op: 'EQ', value: vals[0]! }]
    }
    case 'range': return rangeConditions(f, raw.value)
    case 'enum': {
      const v = raw.value
      if (v.length === 0) return []
      if (v.length === 1) return [allows(f, 'EQ') ? { field: id, op: 'EQ', value: v[0]! } : { field: id, op: 'IN', values: v }]
      return [allows(f, 'IN') ? { field: id, op: 'IN', values: v } : { field: id, op: 'EQ', value: v[0]! }]
    }
    case 'text': {
      const t = raw.value.trim()
      if (t === '') return []
      if (f.type === 'NUMBER') { const n = toNum(t); return n === null ? [] : [{ field: id, op: 'EQ', value: n }] }
      if (f.type === 'BOOLEAN') return [{ field: id, op: 'EQ', value: t === 'true' }]
      return [{ field: id, op: 'EQ', value: t }]
    }
  }
}
```

Проверить, что `isoDayStart`/`isoDayEnd` больше никто не импортирует из `./fieldOps`: `grep -rn "fieldOps" packages apps --include=*.ts --include=*.tsx` (в zsh — через `grep -rn "fieldOps" packages apps`).

- [ ] **Step 3: Тест чипов.** В `packages/ui/src/filters/opLabels.test.ts` добавить:

```ts
import { fieldChip } from './opLabels'
import type { FilterMeta } from './types'

const META: FilterMeta = { fields: [
  { id: 'purpose', label: 'Назначение', type: 'STRING', ops: [] },
  { id: 'docNumber', label: 'Номер документа', type: 'NUMBER', ops: [], defaultOp: 'IN' },
  { id: 'created', label: 'Дата документа', type: 'DATE', ops: [] },
  { id: 'ts', label: 'Создан', type: 'DATETIME', ops: [] },
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'ERROR', label: 'Ошибка' }, { value: 'REJECTED', label: 'Отказ' }] },
] }

describe('fieldChip', () => {
  it('фразы: «содержит „a“ и „b“»', () => {
    const c = fieldChip('purpose', [{ field: 'purpose', op: 'CONTAINS', value: 'счёт не найден' }, { field: 'purpose', op: 'CONTAINS', value: 'инструкция инвалидна' }], META)
    expect(c.full).toBe('Назначение содержит „счёт не найден“ и „инструкция инвалидна“')
  })
  it('список: после трёх значений «и ещё N», полный — в full', () => {
    const c = fieldChip('docNumber', [{ field: 'docNumber', op: 'IN', values: [400, 403, 406, 409, 412] }], META)
    expect(c).toMatchObject({ field: 'Номер документа', op: 'в списке', value: '400, 403, 406 и ещё 2' })
    expect(c.full).toBe('Номер документа в списке 400, 403, 406, 409, 412')
  })
  it('даты: с, по, с … по; формат панели', () => {
    expect(fieldChip('created', [{ field: 'created', op: 'GTE', value: '2026-09-01' }], META).full).toBe('Дата документа с 01.09.2026')
    expect(fieldChip('created', [{ field: 'created', op: 'LTE', value: '2026-09-13' }], META).full).toBe('Дата документа по 13.09.2026')
    expect(fieldChip('created', [{ field: 'created', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' }], META, 'YYYY-MM-DD').full).toBe('Дата документа с 2026-09-01 по 2026-09-13')
    expect(fieldChip('created', [{ field: 'created', op: 'EQ', value: '2026-09-01' }], META).full).toBe('Дата документа = 01.09.2026')
  })
  it('DATETIME: время только у границ не на начале или конце дня', () => {
    expect(fieldChip('ts', [{ field: 'ts', op: 'BETWEEN', from: '2026-09-01T09:00:00+03:00', to: '2026-09-13T23:59:59+03:00' }], META).full)
      .toBe('Создан с 01.09.2026 09:00 по 13.09.2026')
  })
  it('одно условие не-дата — как describeCondition; ENUM IN — подписи', () => {
    expect(fieldChip('status', [{ field: 'status', op: 'IN', values: ['ERROR', 'REJECTED'] }], META).full).toBe('Статус в списке Ошибка, Отказ')
    expect(fieldChip('status', [{ field: 'status', op: 'EQ', value: 'ERROR' }], META).full).toBe('Статус = Ошибка')
  })
})
```

- [ ] **Step 4: Реализация чипов.** В конец `packages/ui/src/filters/opLabels.ts`:

```ts
import { datePartOf, formatDateText, withTime, type DateFormat } from '../date/dateStr'

/** Части и полный текст чипа поля (спека 2026-09-30 §6.4): чип — один на поле, по всем его условиям. */
export type FieldChip = { field: string; op: string; value: string; full: string }

const WALL_RE = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/
/** Дата границы для чипа: DATE — день; DATETIME — день, если граница — начало (from) или конец (to) дня, иначе день и время. */
function chipDate(v: Scalar, type: string, edge: 'from' | 'to' | 'eq', fmt: DateFormat): string {
  const m = WALL_RE.exec(String(v))
  if (!m) return String(v)
  const [, day = '', hh, mm, ss = '00'] = m
  if (type !== 'DATETIME' || hh === undefined) return formatDateText(day, datePartOf(fmt))
  const whole = (edge !== 'to' && hh === '00' && mm === '00' && ss === '00') || (edge === 'to' && hh === '23' && mm === '59' && ss === '59')
  return whole ? formatDateText(day, datePartOf(fmt)) : formatDateText(`${day}T${hh}:${mm}`, withTime(fmt, true))
}

const LIST_SHOWN = 3

export function fieldChip(fieldId: string, conditions: Condition[], meta?: FilterMeta | null, format: DateFormat = 'DD.MM.YYYY'): FieldChip {
  const field = meta?.fields.find((f) => f.id === fieldId)
  const name = field?.label ?? fieldId
  const chip = (op: string, value: string, fullValue = value): FieldChip => ({ field: name, op, value, full: [name, op, fullValue].filter(Boolean).join(' ') })
  if (field && (field.type === 'DATE' || field.type === 'DATETIME')) {
    let from = ''
    let to = ''
    let eq = ''
    for (const c of conditions) {
      if (c.op === 'BETWEEN') { from = chipDate(c.from, field.type, 'from', format); to = chipDate(c.to, field.type, 'to', format) }
      else if (c.op === 'EQ') eq = chipDate(c.value, field.type, 'eq', format)
      else if (c.op === 'GTE' || c.op === 'GT') from = chipDate(c.value, field.type, 'from', format)
      else if (c.op === 'LTE' || c.op === 'LT') to = chipDate(c.value, field.type, 'to', format)
    }
    if (eq) return chip('=', eq)
    if (from && to) return chip('с', `${from} по ${to}`)
    if (from) return chip('с', from)
    if (to) return chip('по', to)
  }
  if (conditions.length > 1 && conditions.every((c) => c.op === 'CONTAINS')) {
    const v = conditions.map((c) => `„${'value' in c ? String(c.value) : ''}“`).join(' и ')
    return chip(OP_LABEL.CONTAINS, v)
  }
  const c = conditions[0]
  if (c === undefined) return chip('', '')
  if ((c.op === 'IN' || c.op === 'NOT_IN') && c.values.length > LIST_SHOWN) {
    const all = conditionParts(c, meta).value.split(', ')
    return chip(OP_LABEL[c.op], `${all.slice(0, LIST_SHOWN).join(', ')} и ещё ${all.length - LIST_SHOWN}`, all.join(', '))
  }
  const p = conditionParts(c, meta)
  return { ...p, full: describeCondition(c, meta) }
}

export const describeField = (fieldId: string, conditions: Condition[], meta?: FilterMeta | null, format?: DateFormat): string =>
  fieldChip(fieldId, conditions, meta, format).full
```

Импорт `datePartOf, formatDateText, withTime` поместить в шапку файла к остальным импортам. Разбиение `value.split(', ')` у списка корректно: подписи ENUM и значения ID не содержат «, » — если у справочника окажется подпись с запятой, строить части напрямую из `c.values` через ту же `showValue` (она приватная — сделать её доступной внутри модуля, это один файл).

Проверка единообразия: `fieldChip` для одного условия не-даты даёт `full === describeCondition(c)` — имена кнопок ✕ в существующих тестах панели не меняются.

- [ ] **Step 5: Прогон.** `pnpm --filter @katran/ui exec vitest run src/filters/fieldOps.test.ts src/filters/opLabels.test.ts` → PASS. Тесты `FilterPanel.test.tsx` на этом шаге могут падать — `FilterField` ещё старый (импорт удалённых `isoDayStart`/`conditionFrom`); `FilterField.tsx` переписывает задача 10. Чтобы `pnpm check` оставался зелёным на коммите этой задачи, в `FilterField.tsx` временно заменить импорт `conditionFrom, draftOf, fieldOp, type RawValue` на локальные копии этих функций из прежней версии `fieldOps.ts` (скопировать тела в конец `FilterField.tsx` с комментарием «временно, до задачи 10»). Задача 10 удалит копии.

- [ ] **Step 6: Commit** — `Фильтры: контрол поля по типу и defaultOp, условия из списков, фраз, периодов и справочников, чип по всем условиям поля`.

---

### Task 10: `FilterPanel` на новых контролах

**Files:**
- Modify: `packages/ui/src/filters/FilterField.tsx`, `packages/ui/src/filters/FilterPanel.tsx`, `packages/ui/src/filters/FilterPanel.test.tsx`, `packages/ui/src/filters/Filters.module.css`, `packages/ui/src/date/DateRange.tsx`, `packages/ui/src/date/DateRange.test.tsx`
- Modify (если падают на старых контролах): тесты `apps/pi/src/**` — `DocRegistry.test.tsx`, `registries.a11y.test.tsx`

**Interfaces:**
- Consumes: всё из задач 1–9.
- Produces: `FilterPanelProps` += `onSetField?: ((p: { field: string; conditions: Condition[] }) => void) | undefined`, `suggest?: SuggestState | null | undefined`, `onSuggest?: ((p: { field: string; query: string }) => void) | undefined`, `onSuggestClose?: (() => void) | undefined`, `dateFormat?: DateFormat | undefined`; `DateRangeProps.toDisabled?: boolean | undefined`.

- [ ] **Step 1: `DateRange.toDisabled`.** Добавить проп `/** Поле «по» недоступно — у поля нет BETWEEN (спека §6.2). */ toDisabled?: boolean | undefined`; второй `MaskedDateField` — `disabled={disabled || toDisabled}`; при `toDisabled` клик по второму дню в календаре не ставит «по»: в `pick` первая строка — `if (toDisabled) { onChange({ from: d, to: '' }); close(); return }`. Тест в `DateRange.test.tsx`: `toDisabled` — поле «по» `disabled`, выбор дня в календаре ставит только «с» и закрывает поповер.

- [ ] **Step 2: Тест панели.** В `packages/ui/src/filters/FilterPanel.test.tsx` заменить хост и дополнить тесты. Хост с `setField`:

```tsx
import { useState } from 'react'
import { screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { FilterPanel, type FilterPanelProps } from './FilterPanel'
import type { Condition, Filter, FilterMeta, SuggestState } from './types'

const META: FilterMeta = { fields: [
  { id: 'docNumber', label: 'Номер документа', type: 'NUMBER', ops: [], defaultOp: 'IN' },
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'ERROR', label: 'Ошибка' }, { value: 'REJECTED', label: 'Отказ' }, { value: 'DONE', label: 'Обработан' }] },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'created', label: 'Дата документа', type: 'DATE', ops: [] },
  { id: 'purpose', label: 'Назначение', type: 'STRING', ops: [], suggest: true },
  { id: 'urgent', label: 'Срочный', type: 'BOOLEAN', ops: [] },
] }

const replaceField = (list: Filter, field: string, cs: Condition[]): Filter => {
  const i = list.findIndex((x) => x.field === field)
  if (i < 0) return cs.length ? [...list, ...cs] : list
  return [...list.slice(0, i), ...cs, ...list.slice(i).filter((x) => x.field !== field)]
}

function Host({ initial = [], meta = META, onSuggest, suggest = null, ...p }: Partial<FilterPanelProps> & { initial?: Filter }) {
  const [conditions, setConditions] = useState<Filter>(initial)
  const [draft, setDraft] = useState<Filter>(initial)
  const [open, setOpen] = useState(true)
  return (
    <FilterPanel
      meta={meta} conditions={conditions} draft={draft} dirty={JSON.stringify(conditions) !== JSON.stringify(draft)} open={open} onOpenChange={setOpen}
      onEdit={(c) => setDraft((d) => replaceField(d, c.field, [c]))}
      onDiscard={(f) => setDraft((d) => d.filter((x) => x.field !== f))}
      onSetField={({ field, conditions: cs }) => setDraft((d) => replaceField(d, field, cs))}
      onApply={() => setConditions(draft)} onRevert={() => setDraft(conditions)}
      onReset={() => { setConditions([]); setDraft([]) }}
      onRemove={(f) => { setConditions((c) => c.filter((x) => x.field !== f)); setDraft((d) => d.filter((x) => x.field !== f)) }}
      suggest={suggest} onSuggest={onSuggest} {...p}
    />
  )
}
const applied = () => within(screen.getByRole('list', { name: 'Применённые условия' })).getAllByRole('listitem').map((li) => li.getAttribute('data-k-tip'))
```

Новые тесты (существующие тесты этого файла переписать под новые контролы, сохранив их смысл: свёрнутая/раскрытая панель, ✕ чипа и фокус, «Сбросить», «Отменить», набранный текст, `axe` в обоих состояниях):

```tsx
describe('FilterPanel: контролы по типам', () => {
  it('список номеров вставкой — IN, чип «в списке … и ещё N»', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    fireEvent.paste(screen.getByRole('textbox', { name: 'Номер документа' }), { clipboardData: { getData: () => '400\n403\n406\n409' } })
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Номер документа в списке 400, 403, 406, 409'])
    expect(screen.getByRole('list', { name: 'Применённые условия' })).toHaveTextContent('400, 403, 406 и ещё 1')
  })
  it('две фразы — два CONTAINS по полю, один чип; счётчик — число полей', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.type(screen.getByRole('combobox', { name: 'Назначение' }), '"счёт не найден" "инструкция инвалидна"{Enter}')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Назначение содержит „счёт не найден“ и „инструкция инвалидна“'])
    expect(screen.getByRole('button', { name: /^Фильтры/ })).toHaveTextContent('1')
  })
  it('набранный, но не ставший чипом текст учитывается при «Применить»', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.type(screen.getByRole('combobox', { name: 'Назначение' }), 'Василёк')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Назначение содержит „Василёк“'])
  })
  it('справочник: одно значение — EQ, два — IN', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.click(screen.getByRole('button', { name: 'Статус: Не выбрано' }))
    await u.click(screen.getByRole('option', { name: 'Ошибка' }))
    await u.keyboard('{Escape}')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Статус = Ошибка'])
    await u.click(screen.getByRole('button', { name: /^Статус: выбрано/ }))
    await u.click(screen.getByRole('option', { name: 'Отказ' }))
    await u.keyboard('{Escape}')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Статус в списке Ошибка, Отказ'])
  })
  it('внешняя смена черновика (лейн) показывается в мультиселекте', () => {
    const { rerender } = renderK(<FilterPanel meta={META} conditions={[]} draft={[]} dirty={false} open onOpenChange={() => {}} onEdit={() => {}} onDiscard={() => {}} onApply={() => {}} onRevert={() => {}} onReset={() => {}} onRemove={() => {}} />)
    rerender(<FilterPanel meta={META} conditions={[]} draft={[{ field: 'status', op: 'EQ', value: 'DONE' }]} dirty open onOpenChange={() => {}} onEdit={() => {}} onDiscard={() => {}} onApply={() => {}} onRevert={() => {}} onReset={() => {}} onRemove={() => {}} />)
    expect(screen.getByRole('button', { name: 'Статус: выбрано 1' })).toBeInTheDocument()
    expect(screen.getByText('Обработан')).toBeInTheDocument()
  })
  it('период горячей кнопкой: «Сегодня» — EQ, «3 дня» — с … по', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderK(<Host />)
    const quick = within(screen.getByRole('group', { name: 'Дата документа' }).parentElement!).getByRole('group', { name: 'Быстрый период' })
    await u.click(within(quick).getByRole('button', { name: 'Сегодня' }))
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Дата документа = 23.09.2026'])
    await u.click(within(quick).getByRole('button', { name: '3 дня' }))
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Дата документа с 21.09.2026 по 23.09.2026'])
    vi.useRealTimers()
  })
  it('dateFormat панели — в полях и чипах', async () => {
    const u = userEvent.setup()
    renderK(<Host dateFormat="YYYY-MM-DD" />)
    await u.type(screen.getByRole('textbox', { name: 'Дата документа, с' }), '20260901')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Дата документа с 2026-09-01'])
  })
  it('подсказки — только полю из suggest.field, без уже выбранных; ввод зовёт onSuggest', async () => {
    const u = userEvent.setup()
    const onSuggest = vi.fn()
    const s: SuggestState = { field: 'purpose', query: 'оп', items: ['Оплата', 'Оплата по договору'], loading: false }
    renderK(<Host onSuggest={onSuggest} suggest={s} onSuggestClose={() => {}} initial={[{ field: 'purpose', op: 'CONTAINS', value: 'Оплата' }]} />)
    await u.type(screen.getByRole('combobox', { name: 'Назначение' }), 'оп')
    expect(onSuggest).toHaveBeenLastCalledWith({ field: 'purpose', query: 'оп' })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Оплата по договору'])
  })
  it('без onSetField — совместимость: первое условие поля через onEdit', async () => {
    const u = userEvent.setup()
    const onEdit = vi.fn()
    renderK(<FilterPanel meta={META} conditions={[]} draft={[]} dirty={false} open onOpenChange={() => {}} onEdit={onEdit} onDiscard={() => {}} onApply={() => {}} onRevert={() => {}} onReset={() => {}} onRemove={() => {}} />)
    await u.type(screen.getByRole('textbox', { name: 'Сумма' }), '5')
    expect(onEdit).toHaveBeenLastCalledWith({ field: 'amount', op: 'EQ', value: 5 })
  })
})
```

Run: `pnpm --filter @katran/ui exec vitest run src/filters` → FAIL.

- [ ] **Step 3: `FilterField`.** Заменить `packages/ui/src/filters/FilterField.tsx` (временные копии из задачи 9 удаляются):

```tsx
import { useEffect, useRef, useState } from 'react'
import { useStableId } from '../compat/useStableId'
import { DateRange } from '../date/DateRange'
import type { DateFormat } from '../date/dateStr'
import { Input } from '../input'
import { MultiSelect } from '../select/MultiSelect'
import { SearchSelect } from '../select/SearchSelect'
import { TagInput } from '../tag/TagInput'
import { conditionsFrom, draftOf, fieldControl, fieldMax, isNumberText, rangeToDisabled, type FieldRaw } from './fieldOps'
import type { Condition, Filter, FilterField as Field, SuggestState } from './types'
import s from './Filters.module.css'

export type FilterFieldProps = {
  field: Field
  draft: Filter
  /** Счётчик внешних смен черновика (FilterPanel): сменился — набранное в поле больше не действует. */
  epoch: number
  onSet: (field: string, conditions: Condition[]) => void
  dateFormat: DateFormat
  suggest?: SuggestState | null | undefined
  onSuggest?: ((p: { field: string; query: string }) => void) | undefined
  onSuggestClose?: (() => void) | undefined
}

const EMPTY_TAGS: FieldRaw = { kind: 'tags', value: [], text: '' }
const BOOL = [{ value: true, label: 'да' }, { value: false, label: 'нет' }]

/** Контрол поля панели simple (спека 2026-09-30 §6.2). Показывает набранное (сырое значение), пока действует снимок:
 * черновик не менялся мимо полей (epoch тот же) и условия поля в черновике — те, что поле само отдало. */
export function FilterField({ field, draft, epoch, onSet, dateFormat, suggest, onSuggest, onSuggestClose }: FilterFieldProps) {
  const id = useStableId()
  const [typed, setTyped] = useState<{ raw: FieldRaw; snap: string; epoch: number } | null>(null)
  const current = JSON.stringify(draft.filter((x) => x.field === field.id))
  const raw: FieldRaw = typed !== null && typed.epoch === epoch && typed.snap === current ? typed.raw : draftOf(draft, field)
  // Одно событие TagInput может сообщить и чипы, и текст двумя вызовами — второй не должен затереть первый
  // старым замыканием: накапливаем в ref до следующего рендера (мутация ref — в обработчиках, не в рендере).
  const pending = useRef<FieldRaw | null>(null)
  useEffect(() => { pending.current = null })
  const set = (next: FieldRaw) => {
    pending.current = next
    const cs = conditionsFrom(field, next)
    setTyped({ raw: next, snap: JSON.stringify(cs), epoch })
    onSet(field.id, cs)
  }
  const control = fieldControl(field)
  if (control === null) return null
  const caption = <span className={s.fieldLabel}>{field.label}</span>

  switch (control) {
    case 'values':
    case 'phrases': {
      const base = (): FieldRaw & { kind: 'tags' } => {
        const r = pending.current ?? raw
        return r.kind === 'tags' ? r : (EMPTY_TAGS as FieldRaw & { kind: 'tags' })
      }
      const r = raw.kind === 'tags' ? raw : (EMPTY_TAGS as FieldRaw & { kind: 'tags' })
      // const ask сужается в замыкании onQuery; проверка через отдельный boolean не сузила бы onSuggest
      const ask = field.suggest === true ? onSuggest : undefined
      const withSuggest = ask !== undefined
      const mine = suggest && suggest.field === field.id ? suggest : null
      return (
        <div className={s.fieldBox}>
          <label htmlFor={id} className={s.fieldLabel}>{field.label}</label>
          <TagInput
            id={id} aria-label={field.label} size="s" mode={control} value={r.value} text={r.text}
            onChange={(v) => set({ ...base(), value: v })}
            onTextChange={(t) => set({ ...base(), text: t })}
            validate={field.type === 'NUMBER' ? isNumberText : undefined}
            max={fieldMax(field)}
            suggestions={withSuggest ? (mine?.items ?? []).filter((x) => !r.value.includes(x)) : undefined}
            loading={withSuggest ? mine?.loading ?? false : undefined}
            onQuery={ask ? (q) => ask({ field: field.id, query: q }) : undefined}
            onSuggestClose={withSuggest ? onSuggestClose : undefined}
          />
        </div>
      )
    }
    case 'dateRange':
      return (
        <div className={s.fieldBox}>
          {caption}
          <DateRange label={field.label} size="s" time={field.type === 'DATETIME'} format={dateFormat} toDisabled={rangeToDisabled(field)}
            value={raw.kind === 'range' ? raw.value : { from: '', to: '' }} onChange={(v) => set({ kind: 'range', value: v })} />
        </div>
      )
    case 'enum':
      return (
        <div className={s.fieldBox}>
          {caption}
          <MultiSelect id={id} aria-label={field.label} size="s" max={fieldMax(field)} options={(field.values ?? []).map((v) => ({ value: v.value, label: v.label }))}
            value={raw.kind === 'enum' ? raw.value : []} onChange={(v) => set({ kind: 'enum', value: v })} />
        </div>
      )
    case 'boolean':
      return (
        <div className={s.fieldBox}>
          {caption}
          <SearchSelect id={id} aria-label={field.label} size="s" searchable={false} options={BOOL}
            value={raw.kind === 'text' && raw.value !== '' ? raw.value === 'true' : null}
            onChange={(v) => set({ kind: 'text', value: v === null ? '' : String(v) })} />
        </div>
      )
    default:
      return (
        <div className={s.fieldBox}>
          <label htmlFor={id} className={s.fieldLabel}>{field.label}</label>
          <Input id={id} size="s" inputMode="decimal" value={raw.kind === 'text' ? raw.value : ''} onChange={(e) => set({ kind: 'text', value: e.target.value })} />
        </div>
      )
  }
}
```

`caption` у групп (период, справочники) — видимая подпись; доступное имя контролы получают своим `aria-label`, поэтому `<label>` там не нужен.

- [ ] **Step 4: `FilterPanel`.** В `packages/ui/src/filters/FilterPanel.tsx`:
  - импорт: `fieldChip` вместо `describeCondition, conditionParts`; `type DateFormat` из `../date/dateStr`; `type SuggestState` из `./types`;
  - пропы из **Produces**; значение по умолчанию `dateFormat = 'DD.MM.YYYY'`;
  - вместо `edit`/`discard` — `setField`:

```tsx
  const setField = (field: string, cs: Condition[]) => {
    setSeen((v) => ({ ...v, own: true }))
    if (onSetField) onSetField({ field, conditions: cs })
    else if (cs.length === 0) onDiscard(field)
    else onEdit(cs[0]!) // совместимость: без onSetField поле держит одно условие
  }
```

  - группы условий по полю для чипов и счётчика:

```tsx
  const groups: { field: string; conditions: Condition[] }[] = []
  for (const c of conditions) {
    const g = groups.find((x) => x.field === c.field)
    if (g) g.conditions.push(c); else groups.push({ field: c.field, conditions: [c] })
  }
```

  - счётчик `<Counter value={groups.length} tone="accent" />`; «условия не заданы» и «Сбросить» — по `groups.length`;
  - чип:

```tsx
              {groups.map((g) => {
                const chip = fieldChip(g.field, g.conditions, meta, dateFormat)
                return (
                  <li key={g.field} className={s.chip} data-k-tip={chip.full}>
                    <span className={s.cf}>{chip.field}</span> <span className={s.co}>{chip.op}</span> <span className={s.cv}>{chip.value}</span>
                    <IconButton size="s" label={`Убрать условие: ${chip.full}`} className={s.chipX} onClick={(e) => remove(e, g.field)}><Cross /></IconButton>
                  </li>
                )
              })}
```

  - поля: `<FilterField key={f.id} field={f} draft={draft} epoch={seen.epoch} onSet={setField} dateFormat={dateFormat} suggest={suggest} onSuggest={onSuggest} onSuggestClose={onSuggestClose} />`.

Отдельного CSS для ширины не нужно: `.fieldBox` — `display: grid`, его дочерние элементы (корни `DateRange`/`TagInput` с `display: inline-grid` и поля `SearchSelect`/`MultiSelect` с `display: inline-flex`) блокифицируются как элементы сетки и растягиваются на ширину колонки (`justify-self: normal`). Ширину проверяет e2e задачи 13.

- [ ] **Step 5: Прогон и починка потребителей.** `pnpm --filter @katran/ui exec vitest run` → PASS. `pnpm --filter pi exec vitest run` — тесты `apps/pi`, которые выбирали значение нативного `select` панели или вводили дату в `input[type=date]`, переписать на новые контролы (роли `combobox`/`option`, поля «…, с»/«…, по»), сохранив проверяемый смысл. `pnpm check` → зелёный.

- [ ] **Step 6: Commit** — `FilterPanel: контролы по типу поля — списки и фразы чипами, период с горячими кнопками, мультиселект, подсказки; чип и счётчик по полю, формат дат панели`.

---

### Task 11: Витрина в демо — страница «Поля ввода»

**Files:**
- Modify: `apps/demo/src/pages/InputsPage.tsx`, `apps/demo/src/pages/Page.module.css`

**Interfaces:**
- Consumes: `DateInput`, `DateRange`, `SearchSelect`, `MultiSelect`, `TagInput`, `PRESET_TODAY`, `PRESET_YESTERDAY`, `type DateValue`, `type DateRangeValue`, `type Scalar`, `type Option` из `@katran/ui`.

- [ ] **Step 1: Разделы.** В `InputsPage.tsx` после раздела `Select` добавить (состояния — в `useState` страницы; данные — вымышленные):

```tsx
const STATUSES: Option[] = ['В работе', 'К экспорту', 'В обработке', 'Ошибка', 'Отложенный', 'Экспортирован', 'Невалидный', 'Отказ', 'Обработан']
  .map((label, i) => ({ value: `S${i + 1}`, label }))
const MANY: Option[] = Array.from({ length: 30 }, (_, i) => ({ value: `C${i + 1}`, label: `Контрагент ${i + 1}`, hint: `4070284000000000${String(i + 1).padStart(4, '0')}` }))
const NAMES = ['ЗАО «Василёк»', 'ООО «Ромашка»', 'АО «Прибой»', 'ООО «Меридиан»', 'ИП Иванов А. А.']

function DatesDemo() {
  const [d1, setD1] = useState<DateValue>('2026-09-23')
  const [d2, setD2] = useState<DateValue>('')
  const [r1, setR1] = useState<DateRangeValue>({ from: '', to: '' })
  const [r2, setR2] = useState<DateRangeValue>({ from: '2026-09-01T09:30', to: '2026-09-03' })
  return (
    <>
      <h2 className={s.h2}>DateInput</h2>
      <div className={s.fieldRow}>
        <DateInput aria-label="Дата документа" value={d1} onChange={setD1} quick={[PRESET_TODAY, PRESET_YESTERDAY]} />
        <DateInput aria-label="Дата ISO" value={d1} onChange={setD1} format="YYYY-MM-DD" />
        <DateInput aria-label="Дата и время" time value={d2} onChange={setD2} />
        <DateInput aria-label="Недоступно" value="2026-09-01" onChange={() => {}} disabled />
      </div>
      <h2 className={s.h2}>DateRange</h2>
      <div className={s.fieldRow}>
        <DateRange label="Период" value={r1} onChange={setR1} />
        <DateRange label="Период со временем" time value={r2} onChange={setR2} />
        <DateRange label="Без кнопок" quick={[]} presets={[]} format="DD/MM/YYYY" value={r1} onChange={setR1} />
      </div>
    </>
  )
}

function SelectsDemo() {
  const [one, setOne] = useState<Scalar | null>('S4')
  const [yes, setYes] = useState<Scalar | null>(null)
  const [many, setMany] = useState<Scalar[]>(['S4', 'S8'])
  const [cps, setCps] = useState<Scalar[]>([])
  return (
    <>
      <h2 className={s.h2}>SearchSelect</h2>
      <div className={s.fieldRow}>
        <SearchSelect aria-label="Статус" options={STATUSES} value={one} onChange={setOne} />
        <SearchSelect aria-label="Срочный" options={[{ value: true, label: 'да' }, { value: false, label: 'нет' }]} value={yes} onChange={setYes} />
      </div>
      <h2 className={s.h2}>MultiSelect</h2>
      <div className={s.fieldRow}>
        <MultiSelect aria-label="Статусы" options={STATUSES} value={many} onChange={setMany} />
        <MultiSelect aria-label="Контрагенты" options={MANY} value={cps} onChange={setCps} />
      </div>
    </>
  )
}

function TagsDemo() {
  const [ids, setIds] = useState<string[]>(['400', '403'])
  const [idText, setIdText] = useState('')
  const [ph, setPh] = useState<string[]>([])
  const [phText, setPhText] = useState('')
  const suggestions = phText.trim() ? NAMES.filter((n) => n.toLowerCase().includes(phText.trim().toLowerCase())) : []
  return (
    <>
      <h2 className={s.h2}>TagInput</h2>
      <p className={s.note}>Номера — пробел, запятая, «;» или Enter; колонка из Excel вставляется целиком. Фразы — Enter или «;», фразы в кавычках разбираются сами: «"счёт не найден" "инструкция инвалидна"».</p>
      <div className={s.fieldRow}>
        <TagInput aria-label="Номера документов" mode="values" value={ids} onChange={setIds} text={idText} onTextChange={setIdText} validate={(v) => /^\d+$/.test(v)} />
        <TagInput aria-label="Приказодатель" mode="phrases" value={ph} onChange={setPh} text={phText} onTextChange={setPhText}
          suggestions={suggestions} onQuery={() => {}} onSuggestClose={() => {}} />
      </div>
    </>
  )
}
```

и в разметку `InputsPage` после раздела `Select`: `<DatesDemo /><SelectsDemo /><TagsDemo />`. Текст `note` страницы: «Нативные поля — под токенами; даты, справочники с поиском и списки значений — свои контролы кита на поповере». В `Page.module.css`:

```css
/* строка полей витрины: поля ввода разной ширины в сетке, как в панели фильтров */
.fieldRow {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--k-filter-field), 1fr));
  gap: var(--k-sp-3);
  align-items: start;
}
```

- [ ] **Step 2: Проверка в браузере.** Контроллер/исполнитель: `pnpm --filter demo build` → успешно; вручную (или скриптом Playwright в папке отчётов) открыть страницу «Поля ввода» демо (`/#/inputs`), обе темы: поповеры не выходят за экран, клавиатура проходит все поля. Скриншот — в отчёт, не в репозиторий.

- [ ] **Step 3: Прогон и commit.** `pnpm check` → зелёный. Commit — `Демо: витрина полей ввода — даты и период, справочники с поиском и мультивыбором, списки значений и фраз`.

---

### Task 12: `apps/pi` — `defaultOperator`, подсказки, панель на новых контролах

**Files:**
- Modify: `apps/pi/src/shared/api/grid-contract.ts`, `apps/pi/src/shared/api/grid-contract.test.ts`, `apps/pi/src/shared/api/ports.ts`, `apps/pi/src/shared/api/ports.test.ts`, `apps/pi/src/shared/api/index.ts`
- Modify: `apps/pi/src/app/fake/meta.ts`, `apps/pi/src/app/fake/grid.ts`, `apps/pi/src/app/fake/server.ts`, `apps/pi/src/app/fake/fx-docs.data.ts`, `apps/pi/src/app/fake/rub-docs.data.ts`, `apps/pi/src/app/fake/contract.test.ts`
- Modify: `apps/pi/src/widgets/doc-registry/lib/createRegistry.ts`, `apps/pi/src/widgets/doc-registry/ui/DocRegistry.tsx`, `apps/pi/src/widgets/doc-registry/ui/DocRegistry.test.tsx`
- Modify: `docs/reference/pi-api.md`

**Interfaces:**
- Consumes: `SuggestQuery`, `SuggestConfig`, `FiltersBinding.setField/suggest/onSuggest/onSuggestClose` (Task 8), `FilterPanelProps.onSetField/suggest/onSuggest/onSuggestClose` (Task 10), `FilterField.defaultOp/suggest`.
- Produces: `FieldDto.defaultOperator?`, `FieldDto.suggest?`; `SuggestBody = { filter: { conditions: Filter }; field: string; query: string; limit: number }`; `toSuggestBody(q: SuggestQuery): SuggestBody`; `fromSuggestResponse(body: unknown): string[]`; `GridPorts.suggestFx: Effect<SuggestQuery, string[], ApiError>`; `FakeGrid.suggest(b: SuggestBody)`; маршрут фейка `POST /grids/{gridId}/suggest`.

- [ ] **Step 1: Тесты контракта.** В `grid-contract.test.ts`:

```ts
  it('fromFilterMetaResponse: defaultOperator и suggest поля', () => {
    const meta = fromFilterMetaResponse({ fields: [
      { id: 'docNumber', label: 'Номер документа', type: 'NUMBER', operators: ['EQ', 'IN'], defaultOperator: 'IN' },
      { id: 'f50name', label: 'Приказодатель', type: 'STRING', operators: ['CONTAINS'], suggest: true },
    ] })
    expect(meta.fields[0]).toMatchObject({ id: 'docNumber', defaultOp: 'IN' })
    expect(meta.fields[1]).toMatchObject({ id: 'f50name', suggest: true })
    expect(() => fromFilterMetaResponse({ fields: [{ id: 'a', label: 'А', type: 'STRING', operators: ['EQ'], defaultOperator: 'LIKE' }] }))
      .toThrow('fields[0].defaultOperator: неизвестный оператор')
    expect(() => fromFilterMetaResponse({ fields: [{ id: 'a', label: 'А', type: 'STRING', operators: ['EQ'], suggest: 'да' }] }))
      .toThrow('fields[0].suggest: ожидалось true или false')
  })
  it('suggest: тело и ответ', () => {
    expect(toSuggestBody({ field: 'f50name', query: 'ва', filter: [{ field: 'status', op: 'EQ', value: 'ERROR' }], limit: 10 }))
      .toEqual({ filter: { conditions: [{ field: 'status', op: 'EQ', value: 'ERROR' }] }, field: 'f50name', query: 'ва', limit: 10 })
    expect(fromSuggestResponse({ items: ['ЗАО «Василёк»'] })).toEqual(['ЗАО «Василёк»'])
    expect(() => fromSuggestResponse({ items: [1] })).toThrow('items[0]')
  })
```

В `contract.test.ts` (фейковый сервер на контракте) — подсказки:

```ts
  it('suggest: различные значения поля по выборке, по убыванию частоты; поле без suggest — 400; ?fail=suggest — 500', async () => {
    // собрать сервер так же, как соседние тесты файла, и вызвать обработчик напрямую
    const res = await handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'f50name', query: 'ооо', limit: 3 } }) as { items: string[] }
    expect(res.items.length).toBeGreaterThan(0)
    expect(res.items.length).toBeLessThanOrEqual(3)
    expect(res.items.every((x) => x.toLowerCase().includes('ооо'))).toBe(true)
    await expect(handle({ method: 'POST', url: '/grids/fx-docs/suggest', body: { filter: { conditions: [] }, field: 'amount', query: '1', limit: 3 } }))
      .rejects.toMatchObject({ status: 400 })
  })
```

(`handle` — функция, возвращённая `createFakeServer` в этом файле; если в файле другое имя — взять его.)

Run: `pnpm --filter pi exec vitest run src/shared/api src/app/fake` → FAIL.

- [ ] **Step 2: Контракт и порт.** `grid-contract.ts`:

```ts
export type FieldDto = {
  id: string; label: string; type: FilterFieldType; operators: Condition['op'][]; dictionary?: string | undefined
  /** Оператор по умолчанию (контракт §6). */
  defaultOperator?: Condition['op'] | undefined
  /** Подсказки по полю (предложение, docs/reference/suggest-proposal.md). */
  suggest?: boolean | undefined
}
export type SuggestBody = { filter: { conditions: Filter }; field: string; query: string; limit: number }

export const toSuggestBody = (q: SuggestQuery): SuggestBody => ({ filter: { conditions: q.filter }, field: q.field, query: q.query, limit: q.limit })

export function fromSuggestResponse(body: unknown): string[] {
  return arr(obj(body, 'ответ').items, 'items').map((x, i) => {
    if (typeof x !== 'string') throw contractError(`items[${i}]: ожидалась строка`)
    return x
  })
}
```

В `fromFilterMetaResponse`, в разборе поля, после `ops`:

```ts
    let defaultOp: Condition['op'] | undefined
    if (fo.defaultOperator !== undefined && fo.defaultOperator !== null) {
      if (typeof fo.defaultOperator !== 'string' || !(OPERATORS as readonly string[]).includes(fo.defaultOperator)) throw contractError(`${p}.defaultOperator: неизвестный оператор`)
      defaultOp = fo.defaultOperator as Condition['op']
    }
    if (fo.suggest !== undefined && fo.suggest !== null && typeof fo.suggest !== 'boolean') throw contractError(`${p}.suggest: ожидалось true или false`)
    const suggest = fo.suggest === true ? true : undefined
```

и в возвращаемый объект поля — `defaultOp, suggest`. Импорт `SuggestQuery` из `@katran/effector`.

`ports.ts`: в `GridPorts` — `suggestFx: Effect<SuggestQuery, string[], ApiError>`; в фабрике:

```ts
  const suggestFx = createEffect<SuggestQuery, string[], ApiError>(async (q) =>
    fromSuggestResponse(await requestFx({ method: 'POST', url: `${base}/suggest`, body: toSuggestBody(q) })))
```

и `suggestFx` — в оба `return`. `index.ts`: реэкспорт `SuggestBody`, `toSuggestBody`, `fromSuggestResponse` рядом с остальными из `grid-contract`. В `ports.test.ts` — тест: `suggestFx` шлёт `POST /grids/fx-docs/suggest` с телом `toSuggestBody` (по образцу соседнего теста `facetsFx`).

- [ ] **Step 3: Фейковый сервер.** `meta.ts`:

```ts
export type FieldOpts = { defaultOperator?: Condition['op'] | undefined; suggest?: boolean | undefined }
export const field = (id: string, label: string, type: FilterFieldType, dictionary?: string, opts: FieldOpts = {}): FieldDto =>
  ({ id, label, type, operators: OPS_BY_TYPE[type], dictionary, ...opts })
```

`grid.ts`: в `FakeGrid` — `suggest: (b: SuggestBody) => unknown`; в `fakeGrid`:

```ts
    suggest: (b) => {
      const q = b.query.trim().toLowerCase()
      const counts = new Map<string, number>()
      for (const r of applyFilter(rows, b.filter.conditions)) {
        const v = r[b.field]
        if (v === null || v === undefined || v === '') continue
        const t = String(v)
        if (!t.toLowerCase().includes(q)) continue
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
      const items = [...counts].sort((a, c) => c[1] - a[1] || a[0].localeCompare(c[0], 'ru')).slice(0, b.limit).map(([t]) => t)
      return { items }
    },
```

`server.ts`: `ROUTE = /^\/grids\/([^/]+)\/(search|facets|suggest|filter-meta)$/`; тело — `SearchBody | FacetsBody | SuggestBody`; после общей проверки условий для `op === 'suggest'`:

```ts
    if (op === 'suggest') {
      const sb = body as SuggestBody
      const f = grid.meta.fields.find((x) => x.id === sb.field)
      const bad: ProblemError[] = []
      if (!f || f.suggest !== true) bad.push({ path: 'field', code: 'SUGGEST_NOT_SUPPORTED', message: `У поля ${sb.field} нет подсказок` })
      if (!(sb.limit >= 1 && sb.limit <= 50)) bad.push({ path: 'limit', code: 'LIMIT_OUT_OF_RANGE', message: 'limit — от 1 до 50' })
      if (bad.length > 0) throw toApiError(400, { type: 'urn:vtb:grid:filter-validation', title: 'Некорректный запрос подсказок', status: 400, detail: `Ошибок: ${bad.length}`, errors: bad })
      return grid.suggest(sb)
    }
```

Регулятор `?fail=suggest` работает сам: `opts.failing?.() === op`.

`fx-docs.data.ts`, `fxDocsMeta.fields` (порядок — как в панели):

```ts
    field('docNumber', 'Номер документа', 'NUMBER', undefined, { defaultOperator: 'IN' }),
    field('refIn', '20 вх', 'STRING', undefined, { defaultOperator: 'IN' }),
    field('refOut', '20 исх', 'STRING', undefined, { defaultOperator: 'IN' }),
    field('status', 'Статус', 'ENUM', 'docStatus'),
    field('type', 'Тип сообщения', 'ENUM', 'fxType'),
    field('direction', 'Направление', 'ENUM', 'direction'),
    field('currency', 'Валюта', 'ENUM', 'currency'),
    field('amount', 'Сумма', 'NUMBER'),
    field('created', 'Дата документа', 'DATE'),
    field('f50name', 'Приказодатель', 'STRING', undefined, { suggest: true }),
    field('f59name', 'Бенефициар', 'STRING', undefined, { suggest: true }),
    field('f52', 'BIC 52', 'STRING', undefined, { suggest: true }),
    field('purpose', 'Назначение', 'STRING', undefined, { suggest: true }),
    field('reason', 'Причина статуса', 'STRING', undefined, { suggest: true }),
```

(сохранить прочие свойства каталога — `groups`, `dictionaries` — как есть; поля `refIn`, `refOut`, `f52`, `purpose`, `reason` есть в строках `FxDoc`.) `rub-docs.data.ts`, `rubDocsMeta.fields`: `docNumber` — `{ defaultOperator: 'IN' }`, `toInn` — `{ defaultOperator: 'IN' }`, `fromName` и `toName` — `{ suggest: true }`.

- [ ] **Step 4: Реестр и экран.** `createRegistry.ts`: `createFiltersModel({ meta: $meta, laneField: 'status', suggest: { fetchFx: ports.suggestFx } })`. `DocRegistry.tsx`: у `FilterPanel` добавить `onSetField={f.setField} suggest={f.suggest} onSuggest={f.onSuggest} onSuggestClose={f.onSuggestClose}`. В тестах, где порты собираются вручную (`DocRegistry.test.tsx` и другие — `grep -rn "facetsFx:" apps/pi/src`), добавить `suggestFx: createEffect(async () => [] as string[])`.

- [ ] **Step 5: Документ для бека.** `docs/reference/pi-api.md`:
  - §1.2 `filter-meta`: у поля — необязательные `defaultOperator` (контракт §6) и `suggest: boolean` (предложение, `docs/reference/suggest-proposal.md`); что они значат для панели: `IN` у STRING/NUMBER — ввод списка значений, `suggest` — подсказки при вводе;
  - новый §1.5 `POST /grids/{gridId}/suggest` (предложение): тело `{ filter, field, query, limit }`, ответ `{ items: string[] }`, семантика (различные значения по выборке `filter`, вхождение без учёта регистра, по убыванию частоты, `limit` 1–50), ошибки `400 SUGGEST_NOT_SUPPORTED` / `LIMIT_OUT_OF_RANGE`;
  - §4/§5: пример `fx-docs: suggest` (запрос и ответ, значения — из фейковых данных) и обновлённый пример `filter-meta` с `defaultOperator`/`suggest`;
  - §6 «Что не проверяет фейковый сервер»: смещение зоны в границах DATETIME не учитывается (сравнение строкой настенного времени); подсказки считаются по данным стенда.
  - Для сведения бека: фразы одного поля приходят несколькими условиями `CONTAINS` по этому полю (AND, контракт §4.4), списки ID — `IN` до 500 значений.

- [ ] **Step 6: Прогон.** `pnpm --filter pi exec vitest run` → PASS; `pnpm check` → зелёный.

- [ ] **Step 7: Commit** — `apps/pi: defaultOperator и подсказки в каталоге полей, порт suggestFx и маршрут фейка, панель на новых контролах; документ для бека`.

---

### Task 13: e2e `apps/pi` — поля фильтров в Chromium

**Files:**
- Create: `apps/pi/e2e/filters.spec.ts`

**Interfaces:**
- Consumes: экран валютного реестра `apps/pi` (`/#/fx-docs`) после задачи 12. Данные фейка: все документы валютного реестра созданы 23.09.2026 (`fx-docs.data.ts`, поле `created`).

- [ ] **Step 1: Спека.** `apps/pi/e2e/filters.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  // «сегодня» для горячих кнопок — 23.09.2026, как в данных фейка; таймеры страницы идут как обычно
  await page.clock.setFixedTime(new Date(2026, 8, 23, 12, 0))
  await page.addInitScript(() => localStorage.clear())
})

async function openFilters(page: Page) {
  await page.goto('/#/fx-docs')
  await page.locator('tbody[data-key]').first().waitFor()
  await page.getByRole('button', { name: /^Фильтры/ }).click()
}
const chips = (page: Page) => page.getByRole('list', { name: 'Применённые условия' })
const rows = (page: Page) => page.locator('tbody[data-key]')

test('период горячей кнопкой: «Сегодня» — все документы, «Вчера» — пусто', async ({ page }) => {
  await openFilters(page)
  const quick = page.getByRole('group', { name: 'Быстрый период' }).first()
  await quick.getByRole('button', { name: 'Сегодня' }).click()
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(chips(page)).toContainText('23.09.2026')
  await expect(rows(page).first()).toBeVisible()
  await quick.getByRole('button', { name: 'Вчера' }).click()
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(page.getByText('По заданным условиям документов нет')).toBeVisible()
})

test('период календарём: два клика, поповер в пределах окна', async ({ page }) => {
  await openFilters(page)
  await page.getByRole('button', { name: 'Выбрать период' }).first().click()
  const pop = page.getByRole('dialog', { name: /выбор периода/ })
  const box = (await pop.boundingBox())!
  const vp = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width)
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height)
  await pop.getByRole('button', { name: /^22 сентября/ }).click()
  await pop.getByRole('button', { name: /^23 сентября/ }).click()
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(chips(page)).toContainText('с 22.09.2026 по 23.09.2026')
})

test('список номеров вставкой — IN, в гриде ровно эти документы', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openFilters(page)
  const nums = await rows(page).evaluateAll((els) => els.slice(0, 3).map((el) => el.querySelector('[data-col="id"] [class*="copy"]')?.textContent?.trim() ?? ''))
  await page.evaluate((t) => navigator.clipboard.writeText(t), nums.join('\n'))
  const input = page.getByRole('textbox', { name: 'Номер документа' })
  await input.click()
  await page.keyboard.press('ControlOrMeta+V')
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(chips(page)).toContainText('в списке')
  await expect(rows(page)).toHaveCount(3)
})

test('две фразы в «Назначении» — оба вхождения в каждой записи', async ({ page }) => {
  await openFilters(page)
  await page.getByRole('combobox', { name: 'Назначение' }).fill('')
  await page.getByRole('combobox', { name: 'Назначение' }).pressSequentially('"Оплата по договору" "НДС"')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Применить' }).click()
  await expect(chips(page)).toContainText('„Оплата по договору“ и „НДС“')
  const texts = await rows(page).allInnerTexts()
  expect(texts.length).toBeGreaterThan(0)
  for (const t of texts) { expect(t.toLowerCase()).toContain('оплата по договору'); expect(t.toLowerCase()).toContain('ндс') }
})

test('подсказки: список по вводу, выбор добавляет чип', async ({ page }) => {
  await openFilters(page)
  const box = page.getByRole('combobox', { name: 'Приказодатель' })
  await box.pressSequentially('ооо')
  const list = page.getByRole('listbox', { name: 'Подсказки: Приказодатель' })
  await expect(list).toBeVisible()
  const first = (await list.getByRole('option').first().innerText()).trim()
  expect(first.toLowerCase()).toContain('ооо')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Приказодатель' })).toContainText(first)
})

test('справочник с клавиатуры: Enter открывает, поиск, Enter отмечает, Escape закрывает', async ({ page }) => {
  await openFilters(page)
  const trigger = page.getByRole('button', { name: /^Статус:/ })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.type('ошиб')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Статус: выбрано 1' })).toBeFocused()
})

test('высота контролов в строке одинакова; поле — во всю ширину колонки', async ({ page }) => {
  await openFilters(page)
  const tag = await page.getByRole('textbox', { name: 'Номер документа' }).evaluate((el) => el.parentElement!.getBoundingClientRect().height)
  const range = (await page.getByRole('group', { name: 'Дата документа' }).boundingBox())!.height
  const multi = await page.getByRole('button', { name: /^Статус:/ }).evaluate((el) => el.parentElement!.getBoundingClientRect().height)
  const num = await page.getByRole('textbox', { name: 'Сумма' }).evaluate((el) => el.parentElement!.getBoundingClientRect().height)
  for (const x of [tag, range, multi]) expect(Math.abs(x - num)).toBeLessThanOrEqual(0.5)
  const col = await page.getByRole('group', { name: 'Дата документа' }).evaluate((el) => {
    const box = el.closest('[class*="fieldBox"]')!.getBoundingClientRect()
    return Math.abs(el.getBoundingClientRect().width - box.width)
  })
  expect(col).toBeLessThanOrEqual(1)
})

test('тёмная тема: поповер на paper темы, скриншот в отчёт', async ({ page }, info) => {
  await openFilters(page)
  await page.getByRole('button', { name: 'Тёмная' }).click()
  await page.getByRole('button', { name: 'Выбрать период' }).first().click()
  const pop = page.getByRole('dialog', { name: /выбор периода/ })
  const [bg, paper] = await pop.evaluate((el) => {
    const probe = document.createElement('div')
    probe.style.background = getComputedStyle(el).getPropertyValue('--k-paper')
    el.appendChild(probe)
    const p = getComputedStyle(probe).backgroundColor
    probe.remove()
    return [getComputedStyle(el).backgroundColor, p]
  })
  expect(bg).toBe(paper)
  await page.screenshot({ path: info.outputPath('filters-dark.png') })
})
```

Селекторы ячеек грида (`[data-col="id"] [class*="copy"]`) сверить с разметкой `apps/pi` (`widgets/doc-registry`, раскладка валютного реестра) и поправить под фактическую: нужен текст номера документа первых трёх записей.

- [ ] **Step 2: Прогон на переднем плане.** `pnpm --filter pi e2e` → все тесты зелёные (прежние и новые); вывод — в отчёт. Если тест с буфером обмена в headless-Chromium не получает `clipboard-write` — заменить вставку на `page.dispatchEvent` события `paste` с `DataTransfer` (`const dt = new DataTransfer(); dt.setData('text', …)` в `evaluate`) и описать замену в отчёте.

- [ ] **Step 3: Commit** — `apps/pi e2e: поля фильтров — горячие кнопки и календарь периода, список номеров вставкой, фразы, подсказки, клавиатура справочника, высоты, тёмная тема`.

---

### Task 14: Документы

**Files:**
- Create: `docs/reference/suggest-proposal.md`
- Modify: `docs/superpowers/specs/2026-09-23-katran-design.md`, `docs/superpowers/specs/2026-09-24-katran-slice1e-registry-design.md`, `docs/superpowers/specs/2026-09-30-katran-filter-inputs-design.md`, `CHANGELOG.md`, `README.md`, `docs/STATE.md`

- [ ] **Step 1: Предложение в контракт.** `docs/reference/suggest-proposal.md` — для владельца контракта `vtb-filters`, по-русски, сухо, по разделам:
  1. **Зачем:** подсказки при вводе в текстовые поля фильтра (наименования, BIC, назначение, причина статуса) — пользователь выбирает существующее значение вместо угадывания написания.
  2. **`filter-meta`:** у поля необязательный `suggest: boolean` (по умолчанию `false`); бек включает там, где подсказки дешёвые (индекс по полю). Пример поля.
  3. **`POST /grids/{gridId}/suggest`:** тело `{ field, query, filter, limit }` с таблицей свойств и обязательности; ответ `{ items: string[] }`; семантика — различные значения поля среди записей, удовлетворяющих `filter` (применённые условия без условий по самому полю — фронт убирает их сам), содержащие `query` без учёта регистра, экранирование `%`/`_` как у `CONTAINS` (контракт §4.2); порядок — по убыванию частоты, при равенстве по алфавиту; `limit` 1–50, по умолчанию 10; права — как у `search`.
  4. **Ошибки:** `400 SUGGEST_NOT_SUPPORTED` (поле без `suggest`), `400 LIMIT_OUT_OF_RANGE`, `400` валидации `filter` — как у `search` (контракт §8).
  5. **Нагрузка:** фронт шлёт запрос через 250 мс после последнего ввода, не короче 1 символа, отбрасывает устаревшие ответы; при отказе молча показывает пусто.
  6. **Без изменения контракта, для сведения:** фразы одного поля — несколько условий `CONTAINS` по полю (AND, §4.4); списки ID — `IN` до 500 значений; периоды DATETIME — границы со смещением зоны на минуту границы.
  7. **Дальше:** серверные справочники `LOOKUP` (§6.1 контракта) подключатся к тем же контролам тем же паттерном.
  Примеры запроса и ответа — из фейка `apps/pi` (`fx-docs`, поле `f50name`).

- [ ] **Step 2: Спеки.**
  - Основная `2026-09-23-katran-design.md`: §5.1 — в инвентарь среза 1 добавить строку «Поля ввода фильтров: `DateInput`, `DateRange`, `SearchSelect`, `MultiSelect`, `TagInput` (спека 2026-09-30)»; §7.1 — абзац «Одна модель, два режима»: контролы simple-режима и выбор по типу поля и `defaultOp` — ссылка на спеку 2026-09-30 §6.2 (таблица оттуда не дублируется); §8.3 — `setField` (несколько условий на поле), подсказки (`suggest`, `closeSuggest`, `$suggest`, конфигурация `suggest`), правило `$lane` «ровно одно условие EQ по полю»; §8.4 — состав `FiltersBinding` с `setField`, `suggest`, `onSuggest`, `onSuggestClose`.
  - Спека 1e: §3 — правило `$lane` уточнено ссылкой на 2026-09-30 §6.3; §6.2 — абзац в начале: «Контролы полей и чипы переопределены спекой 2026-09-30 §6; текст ниже — исходный дизайн среза 1e».
  - Спека 2026-09-30: сверить с кодом и поправить расхождения, найденные при исполнении (API компонентов, имена, тексты чипов); в шапке — «исполнено планом 7».

- [ ] **Step 3: CHANGELOG и README.** `CHANGELOG.md` — строка «План 7: поля ввода для фильтров — …» с составом (пять компонентов, `setField`, подсказки, панель по типам и `defaultOp`, чип и счётчик по полю, формат дат панели, `Popover` — `returnFocus` и роль `presentation`, `apps/pi` — `defaultOperator`, `suggest`, `suggestFx`); отдельно **Breaking** — у `FiltersModel`/`FiltersBinding` новые обязательные члены (рукописные моки дополнить); `GridPorts` в `apps/pi` — `suggestFx`; счётчик «Фильтры N» считает поля, а не условия; текст чипа периода «с … по» вместо «от … до»; ENUM в панели — мультиселект (`IN` при двух и больше). `README.md` — раздел «Поля ввода и фильтры»: короткие примеры `DateRange` с горячими кнопками и форматом, `MultiSelect`, `TagInput` в двух режимах, подключение подсказок (`createFiltersModel({ suggest: { fetchFx } })` + пропы `FilterPanel` из `useFilters`); примеры сверить с демо и `apps/pi` — имена пропов дословно.

- [ ] **Step 4: STATE.md.** §3 — решения: свои поля ввода без зависимостей на `Popover`; даты — строки без зоны, формат-шаблон; несколько условий на поле — `setField` (контракт §4.4, AND); подсказки — модель + `suggestFx` приложения; контрол поля — по типу и `defaultOp`. §5 — карта: `packages/ui/src/date/`, `select/`, `tag/`. §6 — план 7 исполнен (задачи, ревью, проверки с числами тестов и e2e). §7 — техдолг из ревью плана 7. §9 — следующий шаг по решению владельца (срез 2b деталки / advanced-фильтры / `LOOKUP`).

- [ ] **Step 5: Прогон и commit.** `git diff --check` чистый; `pnpm check` → зелёный. Commit — `Документы: предложение эндпоинта подсказок, спеки, CHANGELOG, README и состояние проекта после плана 7`.

---

## Самопроверка плана

**Покрытие спеки.** §1 состав → задачи 1–7; §2 принципы → Global Constraints, задачи 1 (строки без зоны), 3 (`Popover`), 5 (WAI-ARIA combobox); §3.1–3.2 значения, формат, помощники → 1; §3.3 календарь → 2; §3.4 пресеты → 1, горячие кнопки → 3–4; §3.5 `DateInput` (время, формат, quick) → 3; §3.6 `DateRange` (время, горячие кнопки, пресеты, «по» раньше «с») → 4; §4 справочники → 5–6; §5 `TagInput` (режимы, разбор, предел, клавиатура, подсказки) → 7; §6.1 мета (`defaultOp`, `suggest`) → 8; §6.2 контролы и условия → 9–10; §6.3 лейн → 8; §6.4 чипы, счётчик → 9–10; §6.5 формат панели → 9–10; §6.6 Enter → 3, 5, 7, 10; §7 `setField` → 8; §8 подсказки → 8, 10, 12; §9 предложение в контракт → 14 (и §1.5 `pi-api.md` в 12); §10 демо и `apps/pi` → 11–12; §11 совместимость и токены → Global Constraints, 1; §12 проверки → тесты задач 1–10, e2e 13; §13 открытое → 14.

**Согласованность имён.** `DateValue`/`IsoDay`/`IsoMinute`/`DateFormat` — 1 → 2–4, 9. `DateRangeValue` — 4 → 9–10. `MaskedDateField`, `TimeField`, `CalIcon` — 3 → 4. `Popover.role 'presentation'`, `returnFocus` — 3 → 5–7. `Listbox`, `optionId`, `Cross`, `Chevron`, `filterOptions`, `sameScalar`, `Option` — 5 → 6–7, 11. `splitTags`, `mergeTags`, `takeTags`, `TAG_LIMIT` — 7 → 9. `SuggestState` — 8 (ui/types) → 10; `SuggestQuery`, `SuggestConfig` — 8 → 12. `setField` модели ↔ `FiltersBinding.setField` ↔ `FilterPanelProps.onSetField` — 8, 10, 12. `FiltersBinding.suggest/onSuggest/onSuggestClose` ↔ одноимённые пропы `FilterPanel` — 8, 10, 12. `fieldControl`, `FieldRaw`, `draftOf`, `conditionsFrom`, `fieldMax`, `rangeToDisabled`, `isNumberText` — 9 → 10. `fieldChip`, `describeField` — 9 → 10. `DateRangeProps.toDisabled` — 10. `FieldDto.defaultOperator/suggest` → `FilterField.defaultOp/suggest` — 12 ↔ 8. `GridPorts.suggestFx` — 12.

**Заглушек нет.** Места, где исполнителю нужно свериться с кодом (имя функции-обработчика в `contract.test.ts`, селектор ячейки номера в e2e, проброс `aria-*` в `IconButton`, способ смены `TZ` в тестах), названы с конкретной заменой.
