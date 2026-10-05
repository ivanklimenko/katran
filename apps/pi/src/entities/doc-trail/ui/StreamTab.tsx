import { MiniTable, StatusBadge, Tag, Timestamp, type MiniColumn } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { StreamEvent } from '../model/types'
import type { TrailTabProps } from './lib'
import s from './trail.module.css'

const COLUMNS: MiniColumn<StreamEvent>[] = [
  { id: 'at', header: 'Дата/время', width: 120, render: (e) => <Timestamp iso={e.at} /> },
  { id: 'system', header: 'Код ИС', width: 60, render: (e) => <Tag tone="mt">{e.system}</Tag> },
  { id: 'destination', header: 'ИС куда', width: 90, render: (e) => <span className={[s.muted, s.cut].join(' ')}>{e.destination}</span> },
  { id: 'event', header: 'Событие', mono: true, render: (e) => <span className={s.code}>{e.event}</span> },
  { id: 'status', header: 'Статус', width: 70, render: (e) => <StatusBadge tone={toneOf(e.status)}>{e.status}</StatusBadge> },
  { id: 'tries', header: 'Попытки', width: 60, align: 'end', mono: true, render: (e) => e.tries },
]

/** Вкладка «Стриминг» (эталон streamHtml, index.html:1174): № · время · код ИС · ИС куда · событие · статус · попытки. */
export function StreamTab({ data }: TrailTabProps<StreamEvent[]>) {
  return <MiniTable label="Стриминг" columns={COLUMNS} rows={data} rowKey={(e, i) => `${i}:${e.at}`} empty="Событий стриминга нет" numbered />
}
