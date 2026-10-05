import { useState } from 'react'
import { useStableId } from '../compat/useStableId'
import { StatusBadge, type EditStatus } from '../value'
import { editCountLabel, type EditDiffLine } from './diff'
import s from './Edit.module.css'

export type EditHistoryEntry = {
  who: string
  /** Уже отформатировано вызывающим: «дд.мм.гггг чч:мм». */
  when: string
  status: EditStatus
  /** Кто и когда утвердил — тултип бейджа «Утвердил(а) {by}, {at}». */
  by?: string | undefined
  at?: string | undefined
  note?: string | undefined
  /** [] — «без изменений». */
  diff: EditDiffLine[]
}
export type EditHistoryProps = {
  entries: EditHistoryEntry[]
  /** Родительный падеж предмета: 'поля 57' → список «История изменений поля 57». */
  label: string
}

const approvedTip = (e: EditHistoryEntry): string | undefined => {
  const who = [e.by, e.at].filter(Boolean).join(', ')
  return who ? `Утвердил(а) ${who}` : undefined
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
  const pending = entry.status === 'pending'
  return (
    <li className={s.hlItem} data-status={entry.status}>
      <div className={s.hlHead}>
        <b className={s.hlWho}>{entry.who}</b>
        <span className={s.hlTime}>{entry.when}</span>
        {pending
          ? <span className={s.hlBadge}><StatusBadge tone="wait">ожидает</StatusBadge></span>
          : <span className={s.hlBadge} data-k-tip={approvedTip(entry)}><StatusBadge tone="ok">утверждено</StatusBadge></span>}
      </div>
      {entry.note && <div className={s.hlNote}>{entry.note}</div>}
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
 */
export function EditHistory({ entries, label }: EditHistoryProps) {
  const [open, setOpen] = useState(false)
  const list = useStableId()
  const last = entries[entries.length - 1]
  if (!last) return null
  const people = entries.map((e) => e.who).filter((w, i, all) => all.indexOf(w) === i)
  return (
    <div className={s.hist}>
      <div className={s.hs}>
        <span className={s.hsCount}>{editCountLabel(entries.length)}</span>
        <span className={s.hsWho}>{people.join(', ')}</span>
        {last.status === 'pending'
          ? <StatusBadge tone="wait">ожидает утверждения</StatusBadge>
          : <StatusBadge tone="ok">утверждено</StatusBadge>}
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
