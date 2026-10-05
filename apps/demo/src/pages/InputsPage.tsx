import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Button, Checkbox, DateInput, DateRange, Input, MultiSelect, PRESET_TODAY, PRESET_YESTERDAY, SearchSelect, Select, TagInput,
  type DateRangeValue, type DateValue, type Option, type Scalar,
} from '@katran/ui'
import s from './Page.module.css'

const STATUSES: Option[] = ['В работе', 'К экспорту', 'В обработке', 'Ошибка', 'Отложенный', 'Экспортирован', 'Невалидный', 'Отказ', 'Обработан']
  .map((label, i) => ({ value: `S${i + 1}`, label }))
const MANY: Option[] = Array.from({ length: 30 }, (_, i) => ({
  value: `C${i + 1}`, label: `Контрагент ${i + 1}`, hint: `4070284000000000${String(i + 1).padStart(4, '0')}`,
}))
const NAMES = ['ЗАО «Василёк»', 'ООО «Ромашка»', 'АО «Прибой»', 'ООО «Меридиан»', 'ИП Иванов А. А.']

/** Задержка «ответа бекенда» у подсказок демо. */
const SUGGEST_DELAY = 250

/** Поле витрины: подпись над контролом; сам контрол назван через aria-label. */
function Field({ caption, wide, children }: { caption: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? `${s.field} ${s.fieldWide}` : s.field}>
      <span className={s.caption}>{caption}</span>
      {children}
    </div>
  )
}

/** Текущее значение контрола: то, что уходит в условие фильтра (даты — всегда ISO, формат меняет только вид). */
function Live({ items }: { items: [string, unknown][] }) {
  return (
    <dl className={s.live}>
      {items.map(([k, v]) => (
        <div key={k} className={s.liveRow}>
          <dt>{k}</dt>
          <dd>{JSON.stringify(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Фрагмент кода рядом с примером. Держать в синхроне с разметкой раздела выше. */
function Code({ children }: { children: string }) {
  return <pre className={s.code}>{children}</pre>
}

/**
 * Подсказки «с бека» на таймере: ответ на устаревший запрос отбрасывается (номер запроса), закрытие и размонтирование
 * гасят таймер. Ровно то, что делает модель фильтров над suggestFx.
 */
function useFakeSuggest(source: string[]) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const seq = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const stop = () => { seq.current += 1; clearTimeout(timer.current) }
  useEffect(() => () => clearTimeout(timer.current), [])
  const onQuery = (query: string) => {
    stop()
    const q = query.trim().toLowerCase()
    if (q === '') { setSuggestions([]); setLoading(false); return }
    const mine = seq.current
    setLoading(true)
    timer.current = setTimeout(() => {
      if (mine !== seq.current) return
      setSuggestions(source.filter((n) => n.toLowerCase().includes(q)))
      setLoading(false)
    }, SUGGEST_DELAY)
  }
  const onClose = () => { stop(); setSuggestions([]); setLoading(false) }
  return { suggestions, loading, onQuery, onClose }
}

const DATE_CODE = `// format — вид на экране: 'YYYY-MM-DD' | 'DD.MM.YYYY'; значение всегда 'ГГГГ-ММ-ДД'
// quick — горячие кнопки под полем
<DateInput aria-label="Дата документа" value={d} onChange={setD}
  format={format} quick={[PRESET_TODAY, PRESET_YESTERDAY]} />

// со временем значение — 'ГГГГ-ММ-ДДTчч:мм', например '2026-09-23T14:05'
<DateInput aria-label="Дата и время" time value={dt} onChange={setDt} />

// горячие кнопки периода по умолчанию: Сегодня, Вчера, 3 дня, 7 дней
<DateRange label="Период" value={r} onChange={setR} />
<DateRange label="Период со временем" time value={r} onChange={setR} />`

const SELECT_CODE = `<SearchSelect aria-label="Статус" options={STATUSES} value={one} onChange={setOne} />
// value: Scalar | null; поиск в поповере включается, когда вариантов больше 7

<MultiSelect aria-label="Статусы" options={STATUSES} value={many} onChange={setMany} />
<MultiSelect aria-label="Контрагенты" options={MANY} max={3} maxChips={1} value={cps} onChange={setCps} />
// value: Scalar[]; порядок — как в справочнике`

const TAG_CODE = `// номера: пробел, запятая, «;» или Enter; колонку из Excel можно вставить целиком
<TagInput mode="values" aria-label="Номера документов" value={ids} onChange={setIds}
  text={idText} onTextChange={setIdText} validate={(v) => /^\\d+$/.test(v)} />

// фразы: несколько чипов — условие «содержит» по каждому, через И
<TagInput mode="phrases" aria-label="Текст сообщения" value={ph} onChange={setPh}
  text={phText} onTextChange={setPhText} />

// подсказки приходят с бекенда: onQuery зовётся при вводе, onSuggestClose — при закрытии;
// устаревшие ответы отбрасывает владелец поля (в приложении — модель фильтров)
<TagInput mode="phrases" aria-label="Приказодатель" value={who} onChange={setWho}
  text={whoText} onTextChange={setWhoText}
  suggestions={suggestions} loading={loading} onQuery={onQuery} onSuggestClose={onClose} />`

const FORMATS = [
  { id: 'YYYY-MM-DD', label: '2026-11-22' },
  { id: 'DD.MM.YYYY', label: '22.11.2026' },
] as const

function DatesDemo() {
  const [format, setFormat] = useState<string>('DD.MM.YYYY')
  const [d1, setD1] = useState<DateValue>('2026-09-23')
  const [d2, setD2] = useState<DateValue>('2026-09-23T14:05')
  const [r1, setR1] = useState<DateRangeValue>({ from: '', to: '' })
  const [r2, setR2] = useState<DateRangeValue>({ from: '2026-09-01T09:30', to: '2026-09-03T18:00' })
  const [r3, setR3] = useState<DateRangeValue>({ from: '', to: '' })
  return (
    <>
      <h2 className={s.h2}>DateInput и DateRange</h2>
      <p className={s.note}>Дата и дата со временем, период со временем, горячие кнопки «Сегодня», «Вчера», «3 дня», «7 дней». Формат — только вид на экране: значение всегда в ISO, его и получает условие фильтра.</p>
      <div className={s.row} role="group" aria-label="Формат даты на экране">
        {FORMATS.map((f) => (
          <Button key={f.id} size="s" pressed={format === f.id} onClick={() => setFormat(f.id)}>{f.label}</Button>
        ))}
      </div>
      <div className={s.fieldRow}>
        <Field caption="Дата документа"><DateInput aria-label="Дата документа" value={d1} onChange={setD1} format={format} quick={[PRESET_TODAY, PRESET_YESTERDAY]} /></Field>
        <Field caption="Дата и время"><DateInput aria-label="Дата и время" time value={d2} onChange={setD2} format={format} /></Field>
        <Field caption="Недоступно"><DateInput aria-label="Недоступно" value="2026-09-01" onChange={() => {}} format={format} disabled /></Field>
      </div>
      <div className={s.fieldRow}>
        <Field caption="Период (горячие кнопки по умолчанию)"><DateRange label="Период" value={r1} onChange={setR1} format={format} /></Field>
        <Field caption="Период со временем" wide><DateRange label="Период со временем" time value={r2} onChange={setR2} format={format} /></Field>
        <Field caption="Без кнопок и списка"><DateRange label="Без кнопок" quick={[]} presets={[]} value={r3} onChange={setR3} format={format} /></Field>
      </div>
      <Live items={[['Дата документа', d1], ['Дата и время', d2], ['Период', r1], ['Период со временем', r2]]} />
      <Code>{DATE_CODE}</Code>
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
      <h2 className={s.h2}>SearchSelect и MultiSelect</h2>
      <p className={s.note}>Справочники в поповере: у длинного списка — поиск по подписи, подсказке и значению, в мультивыборе — чипы в поле, «+N» и предел выбора.</p>
      <div className={s.fieldRow}>
        <Field caption="Статус (9 вариантов, с поиском)"><SearchSelect aria-label="Статус" options={STATUSES} value={one} onChange={setOne} /></Field>
        <Field caption="Срочный (булево значение)"><SearchSelect aria-label="Срочный" options={[{ value: true, label: 'да' }, { value: false, label: 'нет' }]} value={yes} onChange={setYes} /></Field>
        <Field caption="Статусы"><MultiSelect aria-label="Статусы" options={STATUSES} value={many} onChange={setMany} /></Field>
        <Field caption="Контрагенты (не более трёх)"><MultiSelect aria-label="Контрагенты" options={MANY} max={3} maxChips={1} value={cps} onChange={setCps} /></Field>
      </div>
      <Live items={[['Статус', one], ['Срочный', yes], ['Статусы', many], ['Контрагенты', cps]]} />
      <Code>{SELECT_CODE}</Code>
    </>
  )
}

function TagsDemo() {
  const [ids, setIds] = useState<string[]>(['400', '403'])
  const [idText, setIdText] = useState('')
  const [msg, setMsg] = useState<string[]>(['счёт не найден', 'инструкция инвалидна'])
  const [msgText, setMsgText] = useState('')
  const [who, setWho] = useState<string[]>([])
  const [whoText, setWhoText] = useState('')
  const suggest = useFakeSuggest(NAMES)
  return (
    <>
      <h2 className={s.h2}>TagInput</h2>
      <p className={s.note}>Номера — пробел, запятая, «;» или Enter; колонка из Excel вставляется целиком. Фразы — Enter или «;», фразы в кавычках разбираются сами: вставьте «"счёт не найден" "инструкция инвалидна"» — получится две фразы, а <code>ООО «Ромашка»</code> останется одной. Несколько фраз — условие «содержит каждую» (И).</p>
      <div className={s.fieldRow}>
        <Field caption="Номера документов (значения, IN)"><TagInput aria-label="Номера документов" mode="values" value={ids} onChange={setIds} text={idText} onTextChange={setIdText} validate={(v) => /^\d+$/.test(v)} /></Field>
        <Field caption="Текст сообщения (фразы, И)"><TagInput aria-label="Текст сообщения" mode="phrases" value={msg} onChange={setMsg} text={msgText} onTextChange={setMsgText} /></Field>
        <Field caption={`Приказодатель (подсказки, задержка ${SUGGEST_DELAY} мс)`}>
          <TagInput aria-label="Приказодатель" mode="phrases" value={who} onChange={setWho} text={whoText} onTextChange={setWhoText}
            suggestions={suggest.suggestions} loading={suggest.loading} onQuery={suggest.onQuery} onSuggestClose={suggest.onClose} />
        </Field>
      </div>
      <Live items={[['Номера документов', ids], ['Текст сообщения', msg], ['Приказодатель', who]]} />
      <Code>{TAG_CODE}</Code>
    </>
  )
}

export function InputsPage() {
  const [ind, setInd] = useState(true)
  return (
    <>
      <h1 className={s.h1}>Поля ввода</h1>
      <p className={s.note}>Нативные поля — под токенами; даты, справочники с поиском и списки значений — свои контролы кита на поповере.</p>
      <h2 className={s.h2}>Input</h2>
      <div className={s.row}>
        <Input aria-label="Поиск" placeholder="Поиск по реестру" prefix={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5" /></svg>} />
        <Input aria-label="Номер" defaultValue="A1B2C3" invalid />
        <Input aria-label="Малое" size="s" placeholder="s" /><Input aria-label="Большое" size="l" placeholder="l" />
      </div>
      <h2 className={s.h2}>Checkbox</h2>
      <div className={s.row}>
        <Checkbox label="Выбрать все" indeterminate={ind} onChange={() => setInd(false)} />
        <Checkbox label="Отложенные" defaultChecked /><Checkbox label="Недоступно" disabled />
      </div>
      <h2 className={s.h2}>Select</h2>
      <div className={s.row}>
        <Select aria-label="Тип сообщения" placeholder="Тип" options={['MT103', 'MT202', 'MT202COV', 'MT199'].map((v) => ({ value: v, label: v }))} />
        <Select aria-label="Размер" size="s" options={[20, 50].map((v) => ({ value: String(v), label: String(v) }))} />
      </div>
      <DatesDemo />
      <SelectsDemo />
      <TagsDemo />
    </>
  )
}
