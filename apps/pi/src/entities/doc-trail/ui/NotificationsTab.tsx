import { useState } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Button, MiniTable, StatusBadge, Tag, Timestamp, type MiniColumn } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { DocNotification } from '../model/types'
import { STUB, type TrailTabProps } from './lib'
import { Count, LinkButton } from './parts'

/* «Исходное сообщение» и «Переотправить» в строку */
const LnkPair = styled.span`
  display: inline-flex;
  gap: ${k.sp3};
`

/** Нажатая кнопка переотправки: '*' — «Переотправить все», иначе id нотификации строки. */
type Pressed = string | null

/**
 * Вкладка «Нотификации» (эталон notifHtml, index.html:1180): счётчик и переотправка в панели; № · время · попытки · статус ·
 * код ответа · действия строки (спека 2e §4 п. 10–11).
 * С ctx.resend — «Переотправить все» в панели и «Переотправить» в строке (имя «Переотправить, отправка {n}»); пока переотправка
 * документа в полёте (ctx.resendBusy) — все aria-disabled, у нажатой — aria-busy. Без ctx.resend — прежняя «Переотправить»
 * в панели с объявлением STUB, в строке ссылки нет. «Исходное сообщение» — ctx.openMessage(id, n), без него — STUB.
 */
export function NotificationsTab({ data, ctx }: TrailTabProps<DocNotification[]>) {
  const failed = data.filter((n) => n.status !== 'OK').length
  const { resend, openMessage } = ctx
  const busy = ctx.resendBusy === true
  // какую нажали — знает только вкладка (модель хранит полёт документа); вне полёта не показывается
  const [pressed, setPressed] = useState<Pressed>(null)
  const run = (key: string, go: () => void) => () => {
    setPressed(key)
    go()
  }
  const columns: MiniColumn<DocNotification>[] = [
    { id: 'at', header: 'Дата/время', width: 120, render: (n) => <Timestamp iso={n.at} /> },
    { id: 'attempts', header: 'Попытки', width: 70, mono: true, render: (n) => n.attempts },
    { id: 'status', header: 'Статус', width: 90, render: (n) => <StatusBadge tone={toneOf(n.status)}>{n.status}</StatusBadge> },
    { id: 'code', header: 'Код ответа', width: 120, render: (n) => <Tag tone="mt">{n.code}</Tag> },
    {
      id: 'source', header: '', align: 'end',
      render: (n, i) => (
        <LnkPair>
          {resend && (
            <LinkButton
              label={`Переотправить, отправка ${i + 1}`}
              disabled={busy}
              busy={busy && pressed === n.id}
              onClick={run(n.id, () => resend(n.id, i + 1))}
            >
              Переотправить
            </LinkButton>
          )}
          <LinkButton
            label={`Исходное сообщение, отправка ${i + 1}`}
            onClick={() => (openMessage ? openMessage(n.id, i + 1) : ctx.announce(STUB))}
          >
            Исходное сообщение
          </LinkButton>
        </LnkPair>
      ),
    },
  ]
  return (
    <MiniTable
      label="Нотификации"
      columns={columns}
      rows={data}
      // id строки: после переотправки (новые попытки, время) строка та же — фокус на её ссылке не теряется
      rowKey={(n) => n.id}
      empty="Нотификаций нет"
      numbered
      toolbar={(
        <>
          <Count>{`${data.length} отправок${failed ? `, с ошибкой ${failed}` : ''}`}</Count>
          {resend ? (
            <Button
              size="s"
              aria-disabled={busy || undefined}
              aria-busy={(busy && pressed === '*') || undefined}
              onClick={() => { if (!busy) run('*', () => resend())() }}
            >
              Переотправить все
            </Button>
          ) : (
            <Button size="s" onClick={() => ctx.announce(STUB)}>Переотправить</Button>
          )}
        </>
      )}
    />
  )
}
