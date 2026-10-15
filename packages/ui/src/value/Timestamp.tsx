import { formatTimestamp } from '../format/time'

export type TimestampProps = { iso: string; className?: string | undefined }

/**
 * Метка времени события (эталон tmHtml, index.html:1157): «ДД.ММ ЧЧ:ММ:СС», время полужирнее, доли секунды приглушённо,
 * полная дата с годом — тултипом кита. Не дата-время — текст как есть, пусто — «—».
 */
export function Timestamp({ iso, className }: TimestampProps) {
  const cls = className ? `k-tm ${className}` : 'k-tm'
  const t = formatTimestamp(iso)
  if (!t) return <span className={cls}>{iso.trim() || '—'}</span>
  return (
    <time className={cls} dateTime={iso.trim()} data-k-tip={t.full}>
      {t.date} <b className="k-tm-time">{t.time}</b>{t.ms && <span className="k-tm-ms">.{t.ms}</span>}
    </time>
  )
}
