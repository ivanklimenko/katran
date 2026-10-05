import { formatTimestamp } from '../format/time'
import s from './Value.module.css'

export type TimestampProps = { iso: string }

/**
 * Метка времени события (эталон tmHtml, index.html:1157): «ДД.ММ ЧЧ:ММ:СС», время полужирнее, доли секунды приглушённо,
 * полная дата с годом — тултипом кита. Не дата-время — текст как есть, пусто — «—».
 */
export function Timestamp({ iso }: TimestampProps) {
  const t = formatTimestamp(iso)
  if (!t) return <span className={s.tm}>{iso.trim() || '—'}</span>
  return (
    <time className={s.tm} dateTime={iso.trim()} data-k-tip={t.full}>
      {t.date} <b className={s.tmTime}>{t.time}</b>{t.ms && <span className={s.tmMs}>.{t.ms}</span>}
    </time>
  )
}
