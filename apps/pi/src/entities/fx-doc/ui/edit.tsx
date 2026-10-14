import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styled, { css } from 'styled-components'
import { k } from '@katran/tokens'
import {
  Button, DateInput, EditHistory, EditMark, FieldEditor, IconButton, PromptChange, SuggestInput, diffFieldValues, formatDate,
  formatDateTimeMinutes, useStableId, type DateValue, type EditHistoryEntry, type FieldValue, type FormEdit, type Option,
} from '@katran/ui'
import type { AccountSide, EditValue } from '../../../shared/api'
import type { EditConfirmView, EditContext } from '../../../shared/lib/detail'
import { groupAccount } from '../model/account'
import type { FxDocDetail } from '../model/detail'
import { currentOf, fieldTarget, isChanged, originalOf, type FxHistEntry } from '../model/edit'
import { fxEditRule, fxEditableTargets, fxViewOnly, swiftFieldInvalid } from '../model/rules'
import { FX_FIELDS } from '../model/swift'

/*
 * Виды правки «Общих данных» валюты (план 2c, Task 9; тексты — эталон index.html, research.md). Рисуются только при EditContext:
 * без него (рубль, просмотр 2a/2b) — виды detail.tsx как были. Маркер «изменено» — только когда текущее ≠ исходному (Р7);
 * время правки — «дд.мм.гггг чч:мм» (Р12).
 */

const Pen = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>
const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
const Cross = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>

/* Правка «Общих данных» валюты (план 2c; эталон .txtrow/.txted/.accrow/.acced/.hero .vd/.blk.edited, index.html:138–153, 365–416) */

/* значение строки с правкой: значение, маркер, ↺ и карандаш в строку */
const Val = styled.span`
  display: flex;
  align-items: center;
  gap: ${k.sp1};
  min-width: 0;

  & > :first-child {
    flex: 1;
  }
`

/*
 * Карандаш и ↺ (IconButton кита): прозрачны до наведения на колонку и в фокусе (эталон .msgs>div:hover .pen/.rv).
 * && — прежний двойной класс (0,2,0): выше размера и варианта кнопки кита. Колонка с правкой помечена data-edit-col (detail.tsx),
 * ячейка сводки — data-part="hero" (HeroBar кита); правила наведения на них — (0,3,0), как прежние .col:hover .pen.
 */
const ghostPen = css`
  && {
    flex: none;
    width: ${k.pen};
    height: ${k.pen};
    border-color: transparent;
    border-radius: ${k.rS};
    background: none;
    color: ${k.muted};
    opacity: 0;
  }

  &&:focus-visible {
    opacity: 1;
  }

  &&:hover:not(:disabled) {
    border-color: transparent;
    background: ${k.valSoft};
    color: ${k.val};
  }
`

const PenBtn = styled(IconButton)`
  ${ghostPen}

  [data-edit-col]:hover & {
    opacity: 1;
  }
`

const VdPenBtn = styled(IconButton)`
  ${ghostPen}

  && {
    margin-left: ${k.sp1};
    vertical-align: middle;
  }

  [data-part='hero']:hover & {
    opacity: 1;
  }
`

/* правка на месте под строкой: 20 исх и счёт — во всю ширину колонки */
const Inline = styled.div`
  grid-column: 1 / -1;
  min-width: 0;
  margin-top: ${k.kvsGap};
`

const RefInput = styled.input`
  box-sizing: border-box;
  width: 100%;
  height: ${k.hInline};
  padding: 0 ${k.sp1};
  border: 1px solid ${k.val};
  border-radius: ${k.rS};
  background: ${k.paper};
  font: 400 ${k.fsEdit} / 1 ${k.mono};
  letter-spacing: 0.02em;
  color: ${k.ink};
  text-transform: uppercase;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 2px ${k.valSoft};
  }

  &[aria-invalid='true'] {
    border-color: ${k.bad};
  }
`

const Hint = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${k.sp2};
  margin-top: ${k.kvsGap};
  font: 400 ${k.fs3} / ${k.lh3} ${k.sans};
  color: ${k.muted};
`

/* строка подсказки поля; data-bad — ошибка */
const HintText = styled.span`
  &:where([data-bad]) {
    color: ${k.bad};
  }
`

const Status = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp2};
`

/* изменённое значение даты валютирования; data-warn — текущее ≠ исходному */
const VdValue = styled.span`
  &:where([data-warn]) {
    color: ${k.warn};
  }
`

/* дата валютирования в правке: поле и «Отмена» в строку */
const VdEdit = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp1};
  font-weight: 400;
`

const VdCancel = styled(Button)`
  && {
    border-color: transparent;
    background: none;
    color: ${k.muted};
  }
`

/* строка ошибки правки даты — справа от «Отмена», не переносится */
const VdErr = styled.span`
  color: ${k.bad};
  font: 400 ${k.fs3} / ${k.lh3} ${k.sans};
  white-space: nowrap;
`

/* маршрут, пересчитанный после смены Кт: заголовок warn */
const RouteEditedBox = styled.div`
  & h3 {
    color: ${k.warn};
  }
`

/* решение второй руки у маркера (20 исх, счета; план 2d): видны всегда, не по наведению — действие ждёт пользователя */
const decideBtn = css`
  && {
    flex: none;
    width: ${k.pen};
    height: ${k.pen};
    border-radius: ${k.rS};
    background: none;
  }
`

const OkBtn = styled(IconButton)`
  ${decideBtn}

  && {
    border-color: ${k.ok};
    color: ${k.ok};
  }

  &&:hover:not(:disabled) {
    border-color: ${k.ok};
    background: ${k.okSoft};
    color: ${k.ok};
  }
`

const NoBtn = styled(IconButton)`
  ${decideBtn}

  && {
    border-color: ${k.bad};
    color: ${k.bad};
  }

  &&:hover:not(:disabled) {
    border-color: ${k.bad};
    background: ${k.badSoft};
    color: ${k.bad};
  }
`

/* тело Prompt решения: цель, «было → стало», автор и время записи */
const Decision = styled.div`
  display: grid;
  gap: ${k.sp1};
  min-width: 0;
  overflow-wrap: anywhere;
`

const DecisionTarget = styled.div`
  font-weight: 600;
  color: ${k.ink};
`

const DecisionWho = styled.div`
  font: 400 ${k.fs3} / ${k.lh3} ${k.sans};
  color: ${k.muted};
`

const lastOf = (hist: FxHistEntry[]): FxHistEntry | undefined => hist[hist.length - 1]
/**
 * Последняя действующая (не отклонённая) запись — автор текущего значения: отклонённая правка значение вернула, атрибутировать
 * «Изменено» ей нельзя (финальное ревью 2d, I2).
 */
const lastKeptOf = (hist: FxHistEntry[]): FxHistEntry | undefined => {
  for (let i = hist.length - 1; i >= 0; i -= 1) {
    const h = hist[i]
    if (h && h.status !== 'rejected') return h
  }
  return undefined
}
/** «Правка отклонена · {by}, {at}» последней записи, если она rejected; иначе null. */
const rejectedHead = (hist: FxHistEntry[]): string | null => {
  const last = lastOf(hist)
  if (!last || last.status !== 'rejected') return null
  const who = [last.by, last.at ? formatDateTimeMinutes(last.at) : null].filter(Boolean).join(', ')
  return ['Правка отклонена', who].filter(Boolean).join(' · ')
}
const whoWhen = (h: FxHistEntry) => `${h.who}, ${formatDateTimeMinutes(h.when)}`
const asField = (v: EditValue | null | undefined): FieldValue => (v && typeof v !== 'string' ? v : { lines: [] })
const asText = (v: EditValue | null | undefined): string => (typeof v === 'string' ? v : '')

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
/**
 * Только просмотр — заблокирован (Д66) или аннулирование ожидает утверждения либо исполнено (спека 2e §1.3): ни карандашей,
 * ни ↺, ни редакторов, ни кнопок решения; маркеры и подсказки остаются.
 */
const lockedOf = fxViewOnly

/**
 * Изменённая строковая цель: «Было {was} · {who}, {when}» (эталон txtRowHtml/accRowHtml) — исходное и последняя действующая
 * запись (отклонённая значение не меняла).
 */
function editedText(d: FxDocDetail, target: string, show: (was: string) => string): EditedView {
  const kept = lastKeptOf(d.edits[target]?.hist ?? [])
  if (!kept || !isChanged(d, target)) return null
  return { tip: `Было ${show(asText(originalOf(d, target)))} · ${whoWhen(kept)}` }
}

/**
 * Отклонённая правка строковой цели (спека 2d §4 п. 2, Ruling R19): пока последняя запись rejected — маркер «отклонено»
 * с подсказкой «Правка отклонена · {by}, {at} · Причина: {reason}», даже когда значение вернулось к исходному
 * (у 20 исх и счетов нет блока истории — иначе следа решения в деталке не остаётся).
 */
function rejectedTip(d: FxDocDetail, target: string): string | null {
  const hist = d.edits[target]?.hist ?? []
  const head = rejectedHead(hist)
  if (head === null) return null
  const reason = lastOf(hist)?.reason
  return reason ? `${head} · Причина: ${reason}` : head
}

/**
 * Маркер строки: отклонённая правка — «отклонено»; значение при этом ещё изменено прежней действующей правкой — подсказка
 * с обеими частями («Было … · {who}, {when} · Правка отклонена · …»); иначе изменённая цель — «изменено»; иначе ничего.
 */
function RowMark({ d, target, edited }: { d: FxDocDetail; target: string; edited: EditedView }) {
  const rejected = rejectedTip(d, target)
  if (rejected) return <EditMark tip={edited ? `${edited.tip} · ${rejected}` : rejected} status="rejected" />
  return edited ? <EditMark tip={edited.tip} /> : null
}

/**
 * Запись, по которой текущий пользователь может решать сейчас (план 2d, вторая рука): последняя запись цели pending,
 * бек разрешил (canConfirm), контекст не занят (canDecide: нет редактора, Prompt, сохранения); заблокированный документ — нет (Д66).
 */
function decidable(d: FxDocDetail, edit: EditContext, target: string): FxHistEntry | null {
  const ed = d.edits[target]
  const last = lastOf(ed?.hist ?? [])
  if (lockedOf(d) || !ed || !last || last.status !== 'pending') return null
  return edit.canDecide(target, ed.canConfirm) ? last : null
}

/**
 * «Утвердить»/«Отклонить» у маркера строки (20 исх, счета): блока истории у этих целей нет — кнопки рядом с маркером
 * «изменено» (уточнение спеки 2d §9); видны сразу, не по наведению: второй руке действие нужно без поиска.
 */
function Decide({ d, edit, target, name }: { d: FxDocDetail; edit: EditContext; target: string; name: string }) {
  const last = decidable(d, edit, target)
  if (!last) return null
  return (
    <>
      <OkBtn size="s" label={`Утвердить правку ${name}`} data-k-tip={`Утвердить правку ${name}`}
        onClick={() => edit.confirmEdit(target, last.when)}><Check /></OkBtn>
      <NoBtn size="s" label={`Отклонить правку ${name}`} data-k-tip={`Отклонить правку ${name}`}
        onClick={() => edit.rejectEdit(target, last.when)}><Cross /></NoBtn>
    </>
  )
}

function Revert({ d, edit, target }: { d: FxDocDetail; edit: EditContext; target: string }) {
  return (
    <PenBtn size="s" label="Вернуть исходное" data-k-tip="Вернуть исходное"
      onClick={() => edit.revert(target, currentOf(d, target), originalOf(d, target))}>↺</PenBtn>
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
  // клик вне блока правки — отмена (эталон, Р15); фаза захвата — раньше обработчиков под курсором.
  // окно поверх деталки ([data-k-dialog]: Prompt «Отменить правку?», «Исходное сообщение») — не «вне»: его кнопки решают сами
  // (иначе черновик сброшен до click)
  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      if (!(ev.target instanceof Element) || !box.current || box.current.contains(ev.target)) return
      if (ev.target.closest('[data-k-dialog]')) return
      cancel.current()
    }
    document.addEventListener('mousedown', onDown, true)
    return () => document.removeEventListener('mousedown', onDown, true)
  }, [cancel])
  const onKeyDown = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') { ev.preventDefault(); edit.save() }
    if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); edit.cancel() }
  }
  return (
    <Inline ref={box} data-k-edit="">
      <RefInput ref={input} aria-label="20 исх" maxLength={16} placeholder="до 16 символов" autoComplete="off"
        value={asText(edit.draft)} onChange={(ev) => edit.change(ev.target.value)} onKeyDown={onKeyDown}
        aria-invalid={message ? true : undefined} aria-describedby={hintId} />
      <Hint>
        <HintText id={hintId} data-bad={message ? '' : undefined} aria-live="polite">{message ?? 'SWIFT X, до 16 символов'}</HintText>
        <span>Enter · Esc</span>
      </Hint>
    </Inline>
  )
}

/** 20 исх с правкой на месте (эталон txtRowHtml/txtCommit, index.html:1326–1340): Enter — сохранить, Esc и клик вне — отмена. */
export function RefOutRow({ d, edit, value }: { d: FxDocDetail; edit: EditContext; value: (warn: boolean) => ReactNode }) {
  const locked = lockedOf(d)
  const open = !locked && edit.editing === 'refOut'
  const pen = usePenReturn(open)
  const edited = editedText(d, 'refOut', (was) => was || '—')
  return (
    <>
      <Val>
        {value(edited !== null)}
        <RowMark d={d} target="refOut" edited={edited} />
        <Decide d={d} edit={edit} target="refOut" name="20 исх" />
        {edited && !locked && <Revert d={d} edit={edit} target="refOut" />}
        {!locked && (
          <PenBtn ref={pen} size="s" label="Изменить 20 исх" data-k-tip="Изменить 20 исх"
            onClick={() => edit.open('refOut', currentOf(d, 'refOut'))}><Pen /></PenBtn>
        )}
      </Val>
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
  // текст запроса — состояние вида; черновик модели — только выбранный счёт (Р9); выбор во время сохранения — игнор
  // (модель save при запросе в полёте не примет, а черновик сменился бы молча)
  const [q, setQ] = useState('')
  const slot = edit.accounts(side)
  const items = slot?.items ?? []
  const options: Option[] = items.map((a) => ({ value: a.account, label: a.account, tag: a.ccy, hint: a.kind }))
  const status = slot === null || slot.state === 'loading'
    ? 'Загрузка счетов…'
    : slot.state === 'error'
      ? <Status>Не удалось загрузить счета <Button size="s" onClick={() => edit.retryAccounts(side)}>Повторить</Button></Status>
      : undefined
  return (
    <Inline data-k-edit="">
      <SuggestInput
        aria-label={`Счёт ${cfg.label}`} placeholder="20 цифр" options={options} value={q} onChange={setQ}
        match={byDigits} sanitize={digits} emptyText={(query) => cfg.empty(d.currency, query)} notInListText={cfg.notInList}
        hint={edit.saveError ?? (slot?.state === 'ready' ? cfg.hint(d.currency, items.length) : undefined)} keysHint="↑↓ Enter · Esc" status={status}
        onCommit={(o) => { if (edit.saving) return; edit.change(String(o.value)); edit.save() }} onCancel={edit.cancel}
      />
    </Inline>
  )
}

/** Счёт Дт / Кт с правкой только из справочника (эталон accRowHtml/accCommit, index.html:1302–1352). */
export function AccountRow({ d, edit, side, value }: { d: FxDocDetail; edit: EditContext; side: AccountSide; value: (warn: boolean) => ReactNode }) {
  const { target, label } = SIDE[side]
  const locked = lockedOf(d)
  const open = !locked && edit.editing === target
  const pen = usePenReturn(open)
  const edited = editedText(d, target, groupAccount)
  return (
    <>
      <Val>
        {value(edited !== null)}
        <RowMark d={d} target={target} edited={edited} />
        <Decide d={d} edit={edit} target={target} name={`счёта ${label}`} />
        {edited && !locked && <Revert d={d} edit={edit} target={target} />}
        {!locked && (
          <PenBtn ref={pen} size="s" label={`Изменить счёт ${label}`} data-k-tip={`Изменить счёт ${label}`}
            onClick={() => edit.open(target, currentOf(d, target))}><Pen /></PenBtn>
        )}
      </Val>
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
export const RouteEdited = ({ children }: { children: ReactNode }) => <RouteEditedBox>{children}</RouteEditedBox>

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
    <VdEdit ref={box} role="presentation" data-k-edit="" onKeyDown={onKeyDown}>
      <DateInput aria-label="Дата валютирования" size="s" min={d.created.slice(0, 10)} value={value} onChange={onChange} />
      <VdCancel size="s" onClick={edit.cancel}>Отмена</VdCancel>
      {/* ошибка проверки, сохранения и 409 «Документ изменили — откройте заново» (спека §4, Review Focus 2) */}
      <VdErr aria-live="polite">{message ?? ''}</VdErr>
    </VdEdit>
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
  const locked = lockedOf(d)
  const open = !locked && edit.editing === 'valueDate'
  const pen = usePenReturn(open)
  if (open) return <ValueDateEditor d={d} edit={edit} />
  const mark = valueDateMark(d)
  return (
    <>
      <VdValue data-warn={mark ? '' : undefined}>{formatDate(d.valueDates[0])}</VdValue>
      {mark && <EditMark tip={mark.tip} status={mark.status} />}
      {same}
      {!locked && (
        <VdPenBtn ref={pen} size="s" label="Изменить дату валютирования" data-k-tip="Изменить дату валютирования"
          onClick={() => edit.open('valueDate', currentOf(d, 'valueDate'))}><Pen /></VdPenBtn>
      )}
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
  by: h.by ?? undefined, at: h.at === null ? undefined : formatDateTimeMinutes(h.at), note: h.note ?? undefined, reason: h.reason ?? undefined,
  diff: diffFieldValues(asField(h.was), asField(h.now)),
}))

/** Правка полей «Общих данных» в ConfigForm (спека 2c §2.1): карандаши правимых целей, состояние с аудитом, FieldEditor. */
export function fxFormEdit(d: FxDocDetail, edit: EditContext): FormEdit {
  // заблокированный документ: целей нет (fxEditableTargets) — ни карандашей, ни «✎ Изменить», ни редактора; состояние с аудитом остаётся
  const targets = fxEditableTargets(d)
  const FIELD = 'field:'
  const base = (tag: string) => tag.replace(/^B\./, '')
  return {
    can: (tag) => targets.includes(fieldTarget(tag)),
    editing: !lockedOf(d) && edit.editing?.startsWith(FIELD) ? edit.editing.slice(FIELD.length) : null,
    onEdit: (tag) => edit.open(fieldTarget(tag), currentOf(d, fieldTarget(tag))),
    state: (tag) => {
      const target = fieldTarget(tag)
      const hist = d.edits[target]?.hist ?? []
      if (!lastOf(hist)) return null
      // «Изменено» — автор действующего значения (последняя не отклонённая запись); последняя отклонена — её след в конце
      const kept = lastKeptOf(hist)
      const head = rejectedHead(hist)
      // вторая рука (план 2d): кнопки решения кит рисует в сводке блока, пока последняя запись pending
      const decide = decidable(d, edit, target)
      return {
        changed: isChanged(d, target),
        was: asField(originalOf(d, target)),
        tip: [kept ? `Изменено: ${whoWhen(kept)}` : null, head].filter(Boolean).join(' · '),
        audit: (
          <EditHistory label={`поля ${base(tag)}`} entries={historyOf(hist)}
            onConfirm={decide ? () => edit.confirmEdit(target, decide.when) : undefined}
            onReject={decide ? () => edit.rejectEdit(target, decide.when) : undefined} />
        ),
      }
    },
    renderEditor: (tag) => {
      const target = fieldTarget(tag)
      const def = FX_FIELDS[base(tag)]
      if (!def) return null
      const value = asField(edit.draft ?? currentOf(d, target))
      return (
        <FieldEditor
          tag={tag} name={def.label} original={asField(originalOf(d, target))} value={value}
          onChange={edit.change} lines={def.lines ?? 4} width={def.width ?? 35} opts={def.opts} account={def.kind === 'party'}
          rule={fxEditRule(def)} error={edit.error} invalid={edit.error !== null ? swiftFieldInvalid(def, value) : undefined}
          busy={edit.saving} saveError={edit.saveError} onCancel={edit.cancel} onSave={edit.save}
        />
      )
    },
  }
}

/** Подпись цели в Prompt решения: поле — как заголовок его редактора, строки — как подписи строк «Сообщений и счетов». */
function targetLabel(target: string): string {
  if (target.startsWith('field:')) {
    const tag = target.slice('field:'.length)
    const def = FX_FIELDS[tag.replace(/^B\./, '')]
    return def ? `Поле ${tag} · ${def.label}` : `Поле ${tag}`
  }
  switch (target) {
    case 'refOut': return '20 исх'
    case 'accDt': return 'Счёт Дт'
    case 'accKt': return 'Счёт Кт'
    case 'valueDate': return 'Дата валютирования'
    default: return target
  }
}

/** «Было → стало» записи: поле — строки диффа (опция, счёт, N/), строки — значение целиком; пустое — «—». */
function recordChange(target: string, h: FxHistEntry): ReactNode {
  const dash = (v: string) => v || '—'
  if (target.startsWith('field:')) {
    const lines = diffFieldValues(asField(h.was), asField(h.now))
    if (!lines.length) return <div>без изменений</div>
    return lines.map((l, i) => <div key={i}>{l.label && `${l.label} `}<PromptChange was={dash(l.was)} now={dash(l.now)} /></div>)
  }
  const show = target === 'accDt' || target === 'accKt' ? groupAccount : target === 'valueDate' ? formatDate : (v: string) => v
  return <div><PromptChange was={dash(show(asText(h.was)))} now={dash(show(asText(h.now)))} /></div>
}

/**
 * Тело Prompt решения (спека 2d §4 п. 1–2): подпись цели, «было → стало» значениями записи, «{who}, {дд.мм.гггг чч:мм}».
 * Запись — по when (ISO, как пришло с бека); не нашлась (деталь обновилась) — последняя запись цели; правок нет — ничего.
 */
export function fxDecisionNote(d: FxDocDetail, target: string, when: string): ReactNode {
  const hist = d.edits[target]?.hist ?? []
  const h = hist.find((x) => x.when === when) ?? lastOf(hist)
  if (!h) return null
  return (
    <Decision>
      <DecisionTarget>{targetLabel(target)}</DecisionTarget>
      {recordChange(target, h)}
      <DecisionWho>{whoWhen(h)}</DecisionWho>
    </Decision>
  )
}

/**
 * Карандаш цели решения в drawer (Ruling R19): поле — «Редактировать поле {tag}» (FieldRow кита), 20 исх и счета — «Изменить …»
 * (подписи RefOutRow/AccountRow). Заблокированный документ карандашей не имеет — null.
 */
export function fxDecisionFocus(root: HTMLElement, target: string): HTMLElement | null {
  const label = target.startsWith('field:') ? `Редактировать поле ${target.slice('field:'.length)}`
    : target === 'refOut' ? 'Изменить 20 исх'
      : target === 'accKt' || target === 'accDt' ? `Изменить счёт ${SIDE[target === 'accKt' ? 'kt' : 'dt'].label}`
        : null
  if (label === null) return null
  return Array.from(root.querySelectorAll<HTMLElement>('button[aria-label]')).find((b) => b.getAttribute('aria-label') === label) ?? null
}
