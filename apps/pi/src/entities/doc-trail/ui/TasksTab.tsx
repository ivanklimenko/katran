import { Fragment } from 'react'
import { Button, MiniTable, StatusDot, Tag, Timestamp, formatTimestamp, type MiniColumn, type StatusTone } from '@katran/ui'
import type { DocTask } from '../model/types'
import { STUB, type TrailTabProps } from './lib'
import { LinkButton } from './parts'
import s from './trail.module.css'

/** Точка открытой задачи по тону (эталон .tk .dot.ok/.info/.warn); выполненная — всегда ok. */
const DOT: Record<DocTask['tone'], StatusTone> = { ok: 'ok', info: 'flow', warn: 'warn' }
/** Время в истории — только часы (эталон: '07:31:59'); не ISO — как есть. */
const clock = (at: string) => formatTimestamp(at)?.time ?? at

/** Тело задачи: полный текст и история. Закрытие («Закрыта · кто») — последняя запись истории, её присылает бек. */
function TaskBody({ t }: { t: DocTask }) {
  return (
    <div className={s.task}>
      <p className={s.taskText}>{t.text}</p>
      <div className={s.hist}>
        {t.history.map((h, i) => (
          <Fragment key={i}>
            <span className={s.histAt}>{clock(h.at)}</span>
            <span className={/^Закрыта/.test(h.text) ? s.closed : undefined}>{h.text}</span>
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/**
 * Вкладка «Задачи» (эталон tasksHtml, index.html:1167): счётчик и переход в «Ручные отклонения»; строка — точка, время,
 * тип, текст, «История»; раскрытие — полный текст и история. По умолчанию свёрнуты (mkui: tasks — пустое множество).
 */
export function TasksTab({ data, ctx }: TrailTabProps<DocTask[]>) {
  const open = data.filter((t) => t.state === 'open').length
  const columns: MiniColumn<DocTask>[] = [
    {
      id: 'dot', header: '', width: 14,
      render: (t) => (t.state === 'done'
        ? <StatusDot tone="ok" size="s" label="Выполнена" />
        : <StatusDot tone={DOT[t.tone]} size="s" label="Открыта" />),
    },
    // время и тег — по содержимому строки, как эталон .tk (14px 100px auto minmax(0,1fr) auto 14px): длинный тег не налезает
    { id: 'at', header: '', width: 'auto', render: (t) => <Timestamp iso={t.at} /> },
    { id: 'type', header: '', width: 'auto', render: (t) => <Tag>{t.type}</Tag> },
    { id: 'text', header: '', render: (t) => <span className={s.cut} data-k-tip={t.text} data-k-tip-if="truncated">{t.text}</span> },
    { id: 'history', header: '', width: 64, align: 'end', render: () => <LinkButton onClick={() => ctx.announce(STUB)}>История</LinkButton> },
  ]
  return (
    <MiniTable
      label="Задачи"
      columns={columns}
      rows={data}
      rowKey={(t) => t.id}
      rowLabel={(t) => t.text}
      empty="Задач нет"
      toolbar={(
        <>
          <span className={s.count}>{`${data.length} задач${open ? `, открытых ${open}` : ''}`}</span>
          <Button size="s" onClick={() => ctx.announce(STUB)}>Перейти в блок «Ручные отклонения»</Button>
        </>
      )}
      renderExpanded={(t) => <TaskBody t={t} />}
      expanded={ctx.expanded ?? []}
      onExpandedChange={ctx.setExpanded}
    />
  )
}
