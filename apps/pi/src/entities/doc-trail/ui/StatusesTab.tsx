import styled from 'styled-components'
import { k } from '@katran/tokens'
import { MiniTable, Tag, Timestamp, formatDuration, timestampDiff, type MiniColumn } from '@katran/ui'
import type { StatusEvent } from '../model/types'
import { SLOW_MS, type TrailTabProps } from './lib'
import { Code, Nil } from './parts'

/* Статусы (эталон .tt .code/.suf/.fin/.reason/.dur): суффикс кода — data-suf="start|end", Δ больше 30 с — data-slow */
const Suf = styled.span`
  &:where([data-suf='start']) {
    color: ${k.muted};
  }

  &:where([data-suf='end']) {
    color: ${k.ok};
  }
`

const Reason = styled.span`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: ${k.fs1};
  color: ${k.warn};
`

const Dur = styled.span`
  font: ${k.fs3} / ${k.lh3} ${k.mono};
  color: ${k.faint};

  &:where([data-slow]) {
    color: ${k.warn};
  }
`

/** Код статуса (эталон codeHtml): суффикс .start серым, .end зелёным; финальный шаг процесса (….finish) — зелёным жирным. */
function StatusCode({ code }: { code: string }) {
  if (/\.finish$/.test(code)) return <Code data-fin="">{code}</Code>
  const m = /^(.*)\.(start|end)$/.exec(code)
  if (!m) return <Code>{code}</Code>
  return <Code>{m[1]}<Suf data-suf={m[2]}>.{m[2]}</Suf></Code>
}

/** Δ от предыдущей строки; не дата или время назад — пусто. */
function delta(rows: StatusEvent[], i: number): { text: string; slow: boolean } | null {
  const prev = rows[i - 1]
  const cur = rows[i]
  if (!prev || !cur) return null
  // настенное время бека, без сдвига зоны (кит, Task 2)
  const d = timestampDiff(prev.at, cur.at)
  if (d === null || d < 0) return null
  return { text: formatDuration(d), slow: d > SLOW_MS }
}

/** Вкладка «Статусы» (эталон statusesHtml, index.html:1165): № · дата/время · маршрут · статус · причина · Δ. */
export function StatusesTab({ data }: TrailTabProps<StatusEvent[]>) {
  const columns: MiniColumn<StatusEvent>[] = [
    { id: 'at', header: 'Дата/время', width: 118, render: (r) => <Timestamp iso={r.at} /> },
    { id: 'route', header: 'Маршрут', width: 150, render: (r) => (r.route && r.route !== '—' ? <Tag>{r.route}</Tag> : <Nil />) },
    { id: 'code', header: 'Статус', width: 262, render: (r) => <StatusCode code={r.code} /> },
    {
      id: 'reason', header: 'Причина',
      render: (r) => (r.reason ? <Reason data-k-tip={r.reason} data-k-tip-if="truncated">{r.reason}</Reason> : null),
    },
    {
      id: 'delta', header: 'Δ', width: 50, align: 'end',
      render: (_r, i) => {
        const d = delta(data, i)
        return d ? <Dur data-part="dur" data-slow={d.slow ? '' : undefined}>{d.text}</Dur> : null
      },
    },
  ]
  return <MiniTable label="Статусы" columns={columns} rows={data} rowKey={(r, i) => `${i}:${r.at}`} empty="Статусов нет" numbered />
}
