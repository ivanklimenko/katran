import { MiniTable, Tag, Timestamp, formatDuration, timestampDiff, type MiniColumn } from '@katran/ui'
import type { StatusEvent } from '../model/types'
import { SLOW_MS, type TrailTabProps } from './lib'
import { Nil } from './parts'
import s from './trail.module.css'

/** Код статуса (эталон codeHtml): суффикс .start серым, .end зелёным; финальный шаг процесса (….finish) — зелёным жирным. */
function StatusCode({ code }: { code: string }) {
  if (/\.finish$/.test(code)) return <span className={[s.code, s.fin].join(' ')}>{code}</span>
  const m = /^(.*)\.(start|end)$/.exec(code)
  if (!m) return <span className={s.code}>{code}</span>
  return <span className={s.code}>{m[1]}<span className={m[2] === 'end' ? s.end : s.start}>.{m[2]}</span></span>
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
      render: (r) => (r.reason ? <span className={s.reason} data-k-tip={r.reason} data-k-tip-if="truncated">{r.reason}</span> : null),
    },
    {
      id: 'delta', header: 'Δ', width: 50, align: 'end',
      render: (_r, i) => {
        const d = delta(data, i)
        return d ? <span className={[s.dur, d.slow ? s.slow : ''].filter(Boolean).join(' ')}>{d.text}</span> : null
      },
    },
  ]
  return <MiniTable label="Статусы" columns={columns} rows={data} rowKey={(r, i) => `${i}:${r.at}`} empty="Статусов нет" numbered />
}
