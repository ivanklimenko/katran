import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  Button, DateInput, EditHistory, EditMark, FieldEditor, IconButton, PromptChange, SuggestInput, diffFieldValues, formatDate,
  formatDateTimeMinutes, useStableId, type DateValue, type EditHistoryEntry, type FieldValue, type FormEdit, type Option,
} from '@katran/ui'
import type { AccountSide, EditValue } from '../../../shared/api'
import type { EditConfirmView, EditContext } from '../../../shared/lib/detail'
import { groupAccount } from '../model/account'
import type { FxDocDetail } from '../model/detail'
import { currentOf, fieldTarget, isChanged, originalOf, type FxHistEntry } from '../model/edit'
import { fxEditRule, fxEditableTargets } from '../model/rules'
import { FX_FIELDS } from '../model/swift'
import e from './edit.module.css'

/*
 * Виды правки «Общих данных» валюты (план 2c, Task 9; тексты — эталон index.html, research.md). Рисуются только при EditContext:
 * без него (рубль, просмотр 2a/2b) — виды detail.tsx как были. Маркер «изменено» — только когда текущее ≠ исходному (Р7);
 * время правки — «дд.мм.гггг чч:мм» (Р12).
 */

const Pen = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>

const lastOf = (hist: FxHistEntry[]): FxHistEntry | undefined => hist[hist.length - 1]
const whoWhen = (h: FxHistEntry) => `${h.who}, ${formatDateTimeMinutes(h.when)}`
const asField = (v: EditValue | null | undefined): FieldValue => (v && typeof v !== 'string' ? v : { lines: [] })
const asText = (v: EditValue | null | undefined): string => (typeof v === 'string' ? v : '')

/** Класс колонки блока «Сообщения и счета»: карандаши и ↺ строк правки видны при наведении на колонку (эталон .msgs>div:hover). */
export const editCol = e.col

/**
 * Закрытие встроенной правки (Enter, Esc, клик вне, сохранение) снимает поле — фокус уходит в body; возвращаем его на карандаш
 * своей цели (preflight D18). Ушедший на другой элемент фокус не трогаем.
 */
function usePenReturn(open: boolean) {
  const pen = useRef<HTMLButtonElement>(null)
  const was = useRef(open)
  useEffect(() => {
    if (was.current && !open) {
      const active = document.activeElement
      if (!active || active === document.body) pen.current?.focus()
    }
    was.current = open
  }, [open])
  return pen
}

/** Последняя функция из пропсов — для слушателей document без переподписки на каждый рендер. */
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => { ref.current = value })
  return ref
}

type EditedView = { tip: string } | null
/** Изменённая строковая цель: «Было {was} · {who}, {when}» (эталон txtRowHtml/accRowHtml) — исходное и последняя запись. */
function editedText(d: FxDocDetail, target: string, show: (was: string) => string): EditedView {
  const last = lastOf(d.edits[target]?.hist ?? [])
  if (!last || !isChanged(d, target)) return null
  return { tip: `Было ${show(asText(originalOf(d, target)))} · ${whoWhen(last)}` }
}

function Revert({ d, edit, target }: { d: FxDocDetail; edit: EditContext; target: string }) {
  return (
    <IconButton size="s" className={e.rv} label="Вернуть исходное" data-k-tip="Вернуть исходное"
      onClick={() => edit.revert(target, currentOf(d, target), originalOf(d, target))}>↺</IconButton>
  )
}

function RefOutEditor({ edit }: { edit: EditContext }) {
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const hintId = useStableId()
  const cancel = useLatest(edit.cancel)
  const message = edit.error ?? edit.saveError
  // открытие — фокус и выделение (эталон :1456)
  useEffect(() => { input.current?.focus(); input.current?.select() }, [])
  // клик вне блока правки — отмена (эталон, Р15); фаза захвата — раньше обработчиков под курсором
  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (ev.target instanceof Node && box.current && !box.current.contains(ev.target)) cancel.current()
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [cancel])
  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') { ev.preventDefault(); edit.save() }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); edit.cancel() }
  }
  return (
    <div ref={box} className={e.inline} data-k-edit="">
      <input ref={input} className={e.input} aria-label="20 исх" maxLength={16} placeholder="до 16 символов" autoComplete="off"
        value={asText(edit.draft)} onChange={(ev) => edit.change(ev.target.value)} onKeyDown={onKeyDown}
        aria-invalid={message ? true : undefined} aria-describedby={hintId} />
      <div className={e.hint}>
        <span id={hintId} className={message ? e.bad : undefined} aria-live="polite">{message ?? 'SWIFT X, до 16 символов'}</span>
        <span>Enter · Esc</span>
      </div>
    </div>
  )
}

/** 20 исх с правкой на месте (эталон txtRowHtml/txtCommit, index.html:1326–1340): Enter — сохранить, Esc и клик вне — отмена. */
export function RefOutRow({ d, edit, value }: { d: FxDocDetail; edit: EditContext; value: (warn: boolean) => ReactNode }) {
  const open = edit.editing === 'refOut'
  const pen = usePenReturn(open)
  const edited = editedText(d, 'refOut', (was) => was || '—')
  return (
    <>
      <span className={e.val}>
        {value(edited !== null)}
        {edited && <EditMark tip={edited.tip} />}
        {edited && <Revert d={d} edit={edit} target="refOut" />}
        <IconButton ref={pen} size="s" className={e.pen} label="Изменить 20 исх" data-k-tip="Изменить 20 исх"
          onClick={() => edit.open('refOut', currentOf(d, 'refOut'))}><Pen /></IconButton>
      </span>
      {open && <RefOutEditor edit={edit} />}
    </>
  )
}

const SIDE = {
  dt: {
    target: 'accDt', label: 'Дт',
    empty: (ccy: string, q: string) => `В счетах банка нет счетов ${ccy}, содержащих «${q}»`,
    notInList: 'Счёт не из списка счетов банка — выберите из списка',
    hint: (ccy: string, n: number) => `Только из счетов банка · ${ccy} · ${n} сч.`,
  },
  kt: {
    target: 'accKt', label: 'Кт',
    empty: (ccy: string, q: string) => `В карточке нет счетов ${ccy}, содержащих «${q}»`,
    notInList: 'Счёт не из карточки клиента — выберите из списка',
    hint: (ccy: string, n: number) => `Только из карточки клиента · ${ccy} · ${n} сч.`,
  },
} as const

const digits = (text: string) => text.replace(/\D/g, '')
const byDigits = (o: Option, q: string) => String(o.value).includes(q)

function AccountEditor({ d, edit, side }: { d: FxDocDetail; edit: EditContext; side: AccountSide }) {
  const cfg = SIDE[side]
  // текст запроса — состояние вида; черновик модели — только выбранный счёт (Р9)
  const [q, setQ] = useState('')
  const slot = edit.accounts(side)
  const items = slot?.items ?? []
  const options: Option[] = items.map((a) => ({ value: a.account, label: a.account, tag: a.ccy, hint: a.kind }))
  const status = slot === null || slot.state === 'loading'
    ? 'Загрузка счетов…'
    : slot.state === 'error'
      ? <span className={e.status}>Не удалось загрузить счета <Button size="s" onClick={() => edit.retryAccounts(side)}>Повторить</Button></span>
      : undefined
  return (
    <div className={e.inline} data-k-edit="">
      <SuggestInput
        aria-label={`Счёт ${cfg.label}`} placeholder="20 цифр" options={options} value={q} onChange={setQ}
        match={byDigits} sanitize={digits} emptyText={(query) => cfg.empty(d.currency, query)} notInListText={cfg.notInList}
        hint={edit.saveError ?? (slot?.state === 'ready' ? cfg.hint(d.currency, items.length) : undefined)} keysHint="↑↓ Enter · Esc" status={status}
        onCommit={(o) => { edit.change(String(o.value)); edit.save() }} onCancel={edit.cancel}
      />
    </div>
  )
}

/** Счёт Дт / Кт с правкой только из справочника (эталон accRowHtml/accCommit, index.html:1302–1352). */
export function AccountRow({ d, edit, side, value }: { d: FxDocDetail; edit: EditContext; side: AccountSide; value: (warn: boolean) => ReactNode }) {
  const { target, label } = SIDE[side]
  const open = edit.editing === target
  const pen = usePenReturn(open)
  const edited = editedText(d, target, groupAccount)
  return (
    <>
      <span className={e.val}>
        {value(edited !== null)}
        {edited && <EditMark tip={edited.tip} />}
        {edited && <Revert d={d} edit={edit} target={target} />}
        <IconButton ref={pen} size="s" className={e.pen} label={`Изменить счёт ${label}`} data-k-tip={`Изменить счёт ${label}`}
          onClick={() => edit.open(target, currentOf(d, target))}><Pen /></IconButton>
      </span>
      {open && <AccountEditor d={d} edit={edit} side={side} />}
    </>
  )
}

const routeLabel = (d: FxDocDetail) => `${d.routeType} ${d.routeAcc} → ${d.routeRecv}`

/**
 * Маршрут пересчитан бэком после смены Кт (эталон B.route, index.html:1361): помечен, пока текущий ≠ исходному (was первой записи).
 * ↺ маршрута нет: его возвращает ↺ счёта Кт.
 */
export function routeEditTip(d: FxDocDetail): string | null {
  const hist = d.edits.route?.hist ?? []
  const first = hist[0]
  const last = lastOf(hist)
  if (!first || !last || routeLabel(d) === asText(first.was)) return null
  return `Маршрут пересчитан после смены счёта Кт · было: ${asText(first.was)} · система, ${formatDateTimeMinutes(last.when)}`
}

/** Обёртка блока маршрута с правкой: заголовок warn. */
export const RouteEdited = ({ children }: { children: ReactNode }) => <div className={e.routeEdited}>{children}</div>

function ValueDateEditor({ d, edit }: { d: FxDocDetail; edit: EditContext }) {
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => { box.current?.querySelector('input')?.focus() }, [])
  const current = asText(currentOf(d, 'valueDate'))
  const message = edit.error ?? edit.saveError
  // поле держит и неполный ввод (маска отдаёт ''), черновик модели — только полная дата: иначе набор сбрасывался бы к черновику
  const [value, setValue] = useState<DateValue>(asText(edit.draft))
  const onChange = (v: DateValue) => {
    setValue(v)
    if (v === '') return
    if (v === current) { edit.cancel(); return }
    edit.change(v)
    edit.save() // модель ставит Prompt «commit» (FX_CONFIRM_TARGETS)
  }
  // Esc в правке — «Отмена» (Ruling S2); календарь гасит свой Esc сам
  const onKeyDown = (ev: KeyboardEvent<HTMLSpanElement>) => {
    if (ev.key !== 'Escape' || ev.defaultPrevented) return
    ev.preventDefault()
    ev.stopPropagation()
    edit.cancel()
  }
  return (
    // role=presentation — обёртка только ловит всплывший Esc полей (как FieldEditor кита)
    <span ref={box} role="presentation" className={e.vdEdit} data-k-edit="" onKeyDown={onKeyDown}>
      <DateInput aria-label="Дата валютирования" size="s" min={d.created.slice(0, 10)} value={value} onChange={onChange} />
      <Button size="s" className={e.vdx} onClick={edit.cancel}>Отмена</Button>
      {/* ошибка проверки, сохранения и 409 «Документ изменили — откройте заново» (спека §4, Review Focus 2) */}
      <span className={[e.vdErr, e.bad].join(' ')} aria-live="polite">{message ?? ''}</span>
    </span>
  )
}

/** Тултип маркера даты (эталон heroHtml vd, index.html:1053): «Изменено: было X · who, when · утверждено by, at» / «… · ожидает утверждения». */
function valueDateMark(d: FxDocDetail): { tip: string; status: FxHistEntry['status'] } | null {
  const last = lastOf(d.edits.valueDate?.hist ?? [])
  if (!last || !isChanged(d, 'valueDate')) return null
  const by = [last.by, last.at && formatDateTimeMinutes(last.at)].filter(Boolean).join(', ')
  const state = last.status === 'confirmed' ? ` · утверждено${by ? ` ${by}` : ''}` : ' · ожидает утверждения'
  return { tip: `Изменено: было ${formatDate(asText(originalOf(d, 'valueDate')))} · ${whoWhen(last)}${state}`, status: last.status }
}

/** Значение ячейки «Валютирование» с правкой (эталон heroHtml vd, index.html:1046–1056 и обработчик change :1380–1400). */
export function ValueDateCell({ d, edit, same }: { d: FxDocDetail; edit: EditContext; same: ReactNode }) {
  const open = edit.editing === 'valueDate'
  const pen = usePenReturn(open)
  if (open) return <ValueDateEditor d={d} edit={edit} />
  const mark = valueDateMark(d)
  return (
    <>
      <span className={mark ? e.warn : undefined}>{formatDate(d.valueDates[0])}</span>
      {mark && <EditMark tip={mark.tip} status={mark.status} />}
      {same}
      <IconButton ref={pen} size="s" className={e.vdPen} label="Изменить дату валютирования" data-k-tip="Изменить дату валютирования"
        onClick={() => edit.open('valueDate', currentOf(d, 'valueDate'))}><Pen /></IconButton>
    </>
  )
}

/** Prompt подтверждения цели (FX_CONFIRM_TARGETS): дата валютирования — «было → стало» элементами (PromptChange). */
export function fxCommitView(target: string, was: EditValue, now: EditValue): EditConfirmView {
  if (target === 'valueDate') {
    return {
      title: 'Утвердить новую дату валютирования?', note: <PromptChange was={formatDate(asText(was))} now={formatDate(asText(now))} />,
      okLabel: 'Утвердить', cancelLabel: 'Отмена', tone: 'neutral',
    }
  }
  return { title: 'Подтвердите действие', okLabel: 'Подтвердить', cancelLabel: 'Отмена', tone: 'neutral' }
}

const historyOf = (hist: FxHistEntry[]): EditHistoryEntry[] => hist.map((h) => ({
  who: h.who, when: formatDateTimeMinutes(h.when), status: h.status,
  // бек: null — нет значения; кит: необязательное поле (T3 → T9)
  by: h.by ?? undefined, at: h.at === null ? undefined : formatDateTimeMinutes(h.at), note: h.note ?? undefined,
  diff: diffFieldValues(asField(h.was), asField(h.now)),
}))

/** Правка полей «Общих данных» в ConfigForm (спека 2c §2.1): карандаши правимых целей, состояние с аудитом, FieldEditor. */
export function fxFormEdit(d: FxDocDetail, edit: EditContext): FormEdit {
  const targets = fxEditableTargets(d)
  const FIELD = 'field:'
  const base = (tag: string) => tag.replace(/^B\./, '')
  return {
    can: (tag) => targets.includes(fieldTarget(tag)),
    editing: edit.editing?.startsWith(FIELD) ? edit.editing.slice(FIELD.length) : null,
    onEdit: (tag) => edit.open(fieldTarget(tag), currentOf(d, fieldTarget(tag))),
    state: (tag) => {
      const target = fieldTarget(tag)
      const hist = d.edits[target]?.hist ?? []
      const last = lastOf(hist)
      if (!last) return null
      return {
        changed: isChanged(d, target),
        was: asField(originalOf(d, target)),
        tip: `Изменено: ${whoWhen(last)}`,
        audit: <EditHistory label={`поля ${base(tag)}`} entries={historyOf(hist)} />,
      }
    },
    renderEditor: (tag) => {
      const target = fieldTarget(tag)
      const def = FX_FIELDS[base(tag)]
      if (!def) return null
      return (
        <FieldEditor
          tag={tag} name={def.label} original={asField(originalOf(d, target))} value={asField(edit.draft ?? currentOf(d, target))}
          onChange={edit.change} lines={def.lines ?? 4} width={def.width ?? 35} opts={def.opts} account={def.kind === 'party'}
          rule={fxEditRule(def)} error={edit.error} busy={edit.saving} saveError={edit.saveError} onCancel={edit.cancel} onSave={edit.save}
        />
      )
    },
  }
}
