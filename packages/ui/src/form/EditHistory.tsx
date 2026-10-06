import { useState } from 'react'
import { Button } from '../button'
import { useStableId } from '../compat/useStableId'
import { StatusBadge, type EditStatus } from '../value'
import { editCountLabel, type EditDiffLine } from './diff'
import s from './Edit.module.css'

export type EditHistoryEntry = {
  who: string
  /** Уже отформатировано вызывающим: «дд.мм.гггг чч:мм». */
  when: string
  status: EditStatus
  /** Кто и когда утвердил или отклонил — тултип бейджа «Утвердил(а) {by}, {at}» / «Отклонил(а) {by}, {at}». */
  by?: string | undefined
  at?: string | undefined
  /** Примечание автора правки. */
  note?: string | undefined
  /** Причина отклонения (rejected) — строкой «Причина: {reason}» под примечанием. */
  reason?: string | undefined
  /** [] — «без изменений». */
  diff: EditDiffLine[]
}
export type EditHistoryProps = {
  entries: EditHistoryEntry[]
  /** Родительный падеж предмета: 'поля 57' → список «История изменений поля 57». */
  label: string
  /** Кнопки решения у последней записи со статусом pending; оба не заданы — кнопок нет. */
  onConfirm?: (() => void) | undefined
  onReject?: (() => void) | undefined
  /** По умолчанию «Утвердить». */
  confirmLabel?: string | undefined
  /** По умолчанию «Отклонить». */
  rejectLabel?: string | undefined
}

type Decision = { onConfirm?: (() => void) | undefined; onReject?: (() => void) | undefined; confirmLabel: string; rejectLabel: string }

const decidedTip = (verb: string, e: EditHistoryEntry): string | undefined => {
  const who = [e.by, e.at].filter(Boolean).join(', ')
  return who ? `${verb} ${who}` : undefined
}

function Badge({ entry }: { entry: EditHistoryEntry }) {
  if (entry.status === 'pending') return <span className={s.hlBadge}><StatusBadge tone="wait">ожидает</StatusBadge></span>
  if (entry.status === 'rejected') {
    return <span className={s.hlBadge} data-k-tip={decidedTip('Отклонил(а)', entry)}><StatusBadge tone="bad">отклонено</StatusBadge></span>
  }
  return <span className={s.hlBadge} data-k-tip={decidedTip('Утвердил(а)', entry)}><StatusBadge tone="ok">утверждено</StatusBadge></span>
}

function SummaryBadge({ status }: { status: EditStatus }) {
  if (status === 'pending') return <StatusBadge tone="wait">ожидает утверждения</StatusBadge>
  if (status === 'rejected') return <StatusBadge tone="bad">отклонено</StatusBadge>
  return <StatusBadge tone="ok">утверждено</StatusBadge>
}

function DiffLine({ line }: { line: EditDiffLine }) {
  return (
    <span>
      {line.label && `${line.label} `}
      <s>{line.was || '—'}</s> → <b>{line.now || '—'}</b>
    </span>
  )
}

function Entry({ entry }: { entry: EditHistoryEntry }) {
  return (
    <li className={s.hlItem} data-status={entry.status}>
      <div className={s.hlHead}>
        <b className={s.hlWho}>{entry.who}</b>
        <span className={s.hlTime}>{entry.when}</span>
        <Badge entry={entry} />
      </div>
      {entry.note && <div className={s.hlNote}>{entry.note}</div>}
      {entry.status === 'rejected' && entry.reason && <div className={s.hlNote}>Причина: {entry.reason}</div>}
      <div className={s.hlDiff}>
        {entry.diff.length
          ? entry.diff.map((d, i) => <DiffLine key={i} line={d} />)
          : <span className={s.hlNone}>без изменений</span>}
      </div>
    </li>
  )
}

/**
 * Аудит правок поля (эталон histBlock, .hs/.hl, index.html:222–240, 967–979): сводка — число правок с русским склонением,
 * участники без повторов, бейдж последней записи и кнопка «История»; по ней — таймлайн записей с диффом «было → стало».
 * Свёрнуто по умолчанию, состояние своё. Пустой список — ничего.
 * Вторая рука (спека 2d §2.1, §4.1; Ruling R7): заданы onConfirm/onReject и последняя запись pending — кнопки решения
 * в сводке рядом с её бейджем, видны без раскрытия истории; в списке не дублируются (одна пара на блок);
 * rejected — бейдж «отклонено», подсказка «Отклонил(а) …», причина строкой.
 */
export function EditHistory({
  entries, label, onConfirm, onReject, confirmLabel = 'Утвердить', rejectLabel = 'Отклонить',
}: EditHistoryProps) {
  const [open, setOpen] = useState(false)
  const list = useStableId()
  const last = entries[entries.length - 1]
  if (!last) return null
  const people = entries.map((e) => e.who).filter((w, i, all) => all.indexOf(w) === i)
  const decision: Decision | undefined = last.status === 'pending' && (onConfirm || onReject)
    ? { onConfirm, onReject, confirmLabel, rejectLabel }
    : undefined
  return (
    <div>
      <div className={s.hs}>
        <span className={s.hsCount}>{editCountLabel(entries.length)}</span>
        <span className={s.hsWho}>{people.join(', ')}</span>
        <SummaryBadge status={last.status} />
        {decision && (
          <span className={s.hsActs}>
            {decision.onConfirm && <Button size="s" onClick={decision.onConfirm}>{decision.confirmLabel}</Button>}
            {decision.onReject && <Button size="s" className={s.hsReject} onClick={decision.onReject}>{decision.rejectLabel}</Button>}
          </span>
        )}
        <button type="button" className={s.hsToggle} aria-expanded={open} aria-controls={list} onClick={() => setOpen(!open)}>
          {open ? 'Свернуть историю' : 'История'}
        </button>
      </div>
      <ol id={list} className={s.hl} aria-label={`История изменений ${label}`} hidden={!open}>
        {open && entries.map((e, i) => <Entry key={i} entry={e} />)}
      </ol>
    </div>
  )
}
