import { Fragment } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Button, ButtonLink, MiniTable, StatusDot, Tag, Timestamp, formatTimestamp, type MiniColumn, type StatusTone } from '@katran/ui'
import { HOST_LINK_MISSING, hostLink } from '../../../shared/lib/host-links'
import type { DocTask } from '../model/types'
import { STUB, type TrailTabProps } from './lib'
import { Count, Cut, LinkButton } from './parts'

/** Точка открытой задачи по тону (эталон .tk .dot.ok/.info/.warn); выполненная — всегда ok. */
const DOT: Record<DocTask['tone'], StatusTone> = { ok: 'ok', info: 'flow', warn: 'warn' }
/** Время в истории — только часы (эталон: '07:31:59'); не ISO — как есть. */
const clock = (at: string) => formatTimestamp(at)?.time ?? at

/** Тело задачи: полный текст и история. Закрытие («Закрыта · кто») — последняя запись истории, её присылает бек. */
/* тело раскрытой строки (эталон .tk.open .txt, .tk .hist); data-closed — запись о закрытии задачи */
const Task = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp1};
`

const TaskText = styled.p`
  margin: 0;
  color: ${k.ink};
`

const Hist = styled.div`
  display: grid;
  grid-template-columns: ${k.dtHist} minmax(0, 1fr);
  gap: 0 ${k.sp2};
  padding-top: ${k.sp1};
  border-top: 1px dashed ${k.line};
  font-size: ${k.fs2};
`

const HistAt = styled.span`
  font: ${k.fs2} / ${k.lh2} ${k.mono};
  color: ${k.muted};
`

const HistText = styled.span`
  &:where([data-closed]) {
    color: ${k.val};
  }
`

function TaskBody({ t }: { t: DocTask }) {
  return (
    <Task>
      <TaskText>{t.text}</TaskText>
      <Hist>
        {t.history.map((h, i) => (
          <Fragment key={i}>
            <HistAt>{clock(h.at)}</HistAt>
            <HistText data-closed={/^Закрыта/.test(h.text) ? '' : undefined}>{h.text}</HistText>
          </Fragment>
        ))}
      </Hist>
    </Task>
  )
}

/**
 * Вкладка «Задачи» (эталон tasksHtml, index.html:1167): счётчик и переход в «Ручные отклонения»; строка — точка, время,
 * тип, текст, «История»; раскрытие — полный текст и история. По умолчанию свёрнуты (mkui: tasks — пустое множество).
 */
export function TasksTab({ data, ctx }: TrailTabProps<DocTask[]>) {
  const toManual = hostLink('manualDeviations', ctx.docId)
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
    { id: 'text', header: '', render: (t) => <Cut data-k-tip={t.text} data-k-tip-if="truncated">{t.text}</Cut> },
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
          <Count>{`${data.length} задач${open ? `, открытых ${open}` : ''}`}</Count>
          {toManual !== null
            ? <ButtonLink size="s" href={toManual} target="_blank" rel="noopener">Перейти в блок «Ручные отклонения»</ButtonLink>
            : <Button size="s" aria-disabled="true" data-k-tip={HOST_LINK_MISSING}>Перейти в блок «Ручные отклонения»</Button>}
        </>
      )}
      renderExpanded={(t) => <TaskBody t={t} />}
      expanded={ctx.expanded ?? []}
      onExpandedChange={ctx.setExpanded}
    />
  )
}
