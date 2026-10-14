import { useState } from 'react'
import { Button } from '../button'
import { useStableId } from '../compat/useStableId'
import { StatusBadge, type EditStatus } from '../value'
import { styled } from '../styled'
import { editCountLabel, type EditDiffLine } from './diff'
import { k } from '@katran/tokens'

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
  /** Кнопки решения в сводке блока (рядом с бейджем), пока последняя запись pending; в списке истории их нет; оба не заданы — кнопок нет. */
  onConfirm?: (() => void) | undefined
  onReject?: (() => void) | undefined
  /** По умолчанию «Утвердить». */
  confirmLabel?: string | undefined
  /** По умолчанию «Отклонить». */
  rejectLabel?: string | undefined
  className?: string | undefined
}

/* аудит правок поля (эталон .hs/.hl, index.html:222–240); место в раскрытой строке задаёт вызывающий */

/* сводка: отделена пунктиром, зазор 8, кнопка «История» прижата вправо */
const Hs = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${k.sp2};
  margin: ${k.gridGap} 0 ${k.sp1};
  padding-top: ${k.sp1};
  border-top: 1px dashed ${k.line};
`

const HsCount = styled.span`
  font: 600 ${k.fs2} / ${k.lh2} ${k.sans};
  color: ${k.ink2};
`

const HsWho = styled.span`
  font: ${k.fs2} / ${k.lh2} ${k.sans};
  color: ${k.muted};
`

/* кнопки решения второй руки (спека 2d §2.1) — в сводке правее бейджа последней записи (Ruling R7) */
const HsActs = styled.span`
  display: flex;
  gap: ${k.sp1};
`

/* «Отклонить»: ghost-кнопка кита в тоне bad; двойной класс — выше варианта кнопки независимо от порядка в листе */
const HsReject = styled(Button)`
  && {
    color: ${k.bad};
  }

  &&:focus-visible {
    outline-color: ${k.bad};
  }

  &&:hover:not(:disabled) {
    border-color: ${k.bad};
    color: ${k.bad};
  }
`

const HsToggle = styled.button`
  margin-left: auto;
  padding: 0 calc(${k.sp1} / 2);
  border: 0;
  border-radius: ${k.rS};
  background: none;
  font: 500 ${k.fs2} / ${k.lh2} ${k.sans};
  color: ${k.val};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 0;
  }
`

/* таймлайн: линия слева 2, точка записи 8 с кольцом paper 2 — ok, у ожидающей — warn */
const Hl = styled.ol`
  margin: 0 0 ${k.fieldGap};
  padding: 0;
  list-style: none;
  border-left: 2px solid ${k.line};

  &[hidden] {
    display: none;
  }
`

const HlItem = styled.li`
  position: relative;
  padding: ${k.gridGap} 0 ${k.badgeGap} ${k.sp3};

  /* сдвиг как у эталона: влево 5 (0.625 точки), сверху 9 (1.125 точки) — масштабируется с плотностью */
  &::before {
    content: '';
    position: absolute;
    top: calc(${k.editDot} * 1.125);
    left: calc(${k.editDot} * -0.625);
    width: ${k.editDot};
    height: ${k.editDot};
    border: 2px solid ${k.paper};
    border-radius: 50%;
    background: ${k.ok};
  }

  &[data-status='pending']::before {
    background: ${k.warn};
  }

  &[data-status='rejected']::before {
    background: ${k.bad};
  }
`

const HlHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  font-size: ${k.fsPre};
`

const HlWho = styled.b`
  font-weight: 600;
  color: ${k.ink};
`

const HlTime = styled.span`
  font: ${k.fs2} ${k.mono};
  color: ${k.muted};
`

const HlBadge = styled.span`
  margin-left: auto;
`

const HlNote = styled.div`
  margin-top: ${k.kvsGap};
  font-size: ${k.fs2};
  color: ${k.muted};
`

const HlDiff = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.kvsGap};
  margin-top: calc(${k.sp1} / 2);
  font: ${k.fsPre} ${k.mono};
  color: ${k.ink2};

  & s {
    color: ${k.muted};
    text-decoration-color: ${k.faint};
  }

  & b {
    font-weight: 600;
    color: ${k.warn};
  }
`

const HlNone = styled.span`
  font-family: ${k.sans};
  font-size: ${k.fs2};
  color: ${k.muted};
`

type Decision = { onConfirm?: (() => void) | undefined; onReject?: (() => void) | undefined; confirmLabel: string; rejectLabel: string }

const decidedTip = (verb: string, e: EditHistoryEntry): string | undefined => {
  const who = [e.by, e.at].filter(Boolean).join(', ')
  return who ? `${verb} ${who}` : undefined
}

function Badge({ entry }: { entry: EditHistoryEntry }) {
  if (entry.status === 'pending') return <HlBadge><StatusBadge tone="wait">ожидает</StatusBadge></HlBadge>
  if (entry.status === 'rejected') {
    return <HlBadge data-k-tip={decidedTip('Отклонил(а)', entry)}><StatusBadge tone="bad">отклонено</StatusBadge></HlBadge>
  }
  return <HlBadge data-k-tip={decidedTip('Утвердил(а)', entry)}><StatusBadge tone="ok">утверждено</StatusBadge></HlBadge>
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
    <HlItem data-status={entry.status}>
      <HlHead>
        <HlWho>{entry.who}</HlWho>
        <HlTime>{entry.when}</HlTime>
        <Badge entry={entry} />
      </HlHead>
      {entry.note && <HlNote>{entry.note}</HlNote>}
      {entry.status === 'rejected' && entry.reason && <HlNote>Причина: {entry.reason}</HlNote>}
      <HlDiff>
        {entry.diff.length
          ? entry.diff.map((d, i) => <DiffLine key={i} line={d} />)
          : <HlNone>без изменений</HlNone>}
      </HlDiff>
    </HlItem>
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
  entries, label, onConfirm, onReject, confirmLabel = 'Утвердить', rejectLabel = 'Отклонить', className,
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
    <div className={className}>
      <Hs>
        <HsCount>{editCountLabel(entries.length)}</HsCount>
        <HsWho>{people.join(', ')}</HsWho>
        <SummaryBadge status={last.status} />
        {decision && (
          <HsActs>
            {decision.onConfirm && <Button size="s" onClick={decision.onConfirm}>{decision.confirmLabel}</Button>}
            {decision.onReject && <HsReject size="s" onClick={decision.onReject}>{decision.rejectLabel}</HsReject>}
          </HsActs>
        )}
        <HsToggle type="button" aria-expanded={open} aria-controls={list} onClick={() => setOpen(!open)}>
          {open ? 'Свернуть историю' : 'История'}
        </HsToggle>
      </Hs>
      <Hl id={list} aria-label={`История изменений ${label}`} hidden={!open}>
        {open && entries.map((e, i) => <Entry key={i} entry={e} />)}
      </Hl>
    </div>
  )
}
