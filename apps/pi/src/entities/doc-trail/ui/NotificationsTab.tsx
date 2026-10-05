import { Button, MiniTable, StatusBadge, Tag, Timestamp, type MiniColumn } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { DocNotification } from '../model/types'
import { STUB, type TrailTabProps } from './lib'
import { LinkButton } from './parts'
import s from './trail.module.css'

/** Вкладка «Нотификации» (эталон notifHtml, index.html:1180): счётчик и «Переотправить»; № · время · попытки · статус · код ответа · исходное. */
export function NotificationsTab({ data, ctx }: TrailTabProps<DocNotification[]>) {
  const failed = data.filter((n) => n.status !== 'OK').length
  const columns: MiniColumn<DocNotification>[] = [
    { id: 'at', header: 'Дата/время', width: 120, render: (n) => <Timestamp iso={n.at} /> },
    { id: 'attempts', header: 'Попытки', width: 70, mono: true, render: (n) => n.attempts },
    { id: 'status', header: 'Статус', width: 90, render: (n) => <StatusBadge tone={toneOf(n.status)}>{n.status}</StatusBadge> },
    { id: 'code', header: 'Код ответа', width: 120, render: (n) => <Tag tone="mt">{n.code}</Tag> },
    {
      id: 'source', header: '', align: 'end',
      render: (_n, i) => (
        <LinkButton label={`Исходное сообщение, отправка ${i + 1}`} onClick={() => ctx.announce(STUB)}>Исходное сообщение</LinkButton>
      ),
    },
  ]
  return (
    <MiniTable
      label="Нотификации"
      columns={columns}
      rows={data}
      rowKey={(n, i) => `${i}:${n.at}`}
      empty="Нотификаций нет"
      numbered
      toolbar={(
        <>
          <span className={s.count}>{`${data.length} отправок${failed ? `, с ошибкой ${failed}` : ''}`}</span>
          <Button size="s" onClick={() => ctx.announce(STUB)}>Переотправить</Button>
        </>
      )}
    />
  )
}
