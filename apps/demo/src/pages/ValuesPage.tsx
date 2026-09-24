import { AccountValue, CopyValue, Counter, FieldTag, LinkValue, StatusDot, Tag, type StatusTone } from '@katran/ui'
import { STATUS_LABEL, STATUS_TONE, type Status } from '../data/docs'
import s from './Page.module.css'

const tones: StatusTone[] = ['flow', 'flowl', 'flowd', 'bad', 'badd', 'warn', 'ok', 'okl', 'grey']

/** Статус демо на каждый тон (у каждого тона ровно один статус) — буква и имя точки берутся из его названия. */
const statusOf = Object.fromEntries((Object.keys(STATUS_TONE) as Status[]).map((st) => [STATUS_TONE[st], STATUS_LABEL[st]])) as Record<StatusTone, string>

export function ValuesPage() {
  return (
    <>
      <h1 className={s.h1}>Значения</h1>
      <p className={s.note}>Каждое значение — отдельный элемент: клик копирует, тултип с полным значением только если обрезано или показано сокращённо. Наведите на длинное значение справа.</p>
      <h2 className={s.h2}>CopyValue</h2>
      <div className={s.row}>
        <CopyValue value="HSTBDEHHXXX" /><CopyValue value="Общество с ограниченной ответственностью «Северный ветер»" maxWidth={180} />
        <CopyValue value="12,5" tone="ink" /><CopyValue value="2026-09-22T07:33:22" display="22.09 07:33:22" short />
      </div>
      <h2 className={s.h2}>LinkValue и AccountValue</h2>
      <div className={s.row}>
        <LinkValue name="uuid" value="0f3c9a2e-7b1d-4c8e-9f0a-1b2c3d4e5f60" /><LinkValue name="refIn" value="REF20260922001" /><LinkValue name="refOut" />
        <AccountValue value="40702840500000012345" /><AccountValue value="40702840500000012345" full />
      </div>
      <h2 className={s.h2}>FieldTag, Tag, Counter, StatusDot</h2>
      <div className={s.row}>
        <FieldTag tag="70" title="70 · Детали платежа" /><FieldTag tag="50K" title="50K · Приказодатель (счёт + имя)" />
        <Tag>ЕРС</Tag><Tag>LORO</Tag><Tag tone="opt">COV</Tag>
        <Counter value={12} /><Counter value={12} active /><Counter value={0} />
      </div>
      <div className={s.row}>
        {tones.map((t) => <StatusDot key={t} tone={t} label={t} />)}
        <StatusDot tone="bad" letter="!" label="Ошибка" /><StatusDot tone="ok" size="s" />
      </div>
      <h2 className={s.h2}>StatusDot с буквой — буква читаема на всех тонах</h2>
      <p className={s.note}>На насыщенных тонах буква цвета бумаги, на светлых (к экспорту, экспортирован, отказ) — тёмная: контраст не ниже 4.5 в обеих темах.</p>
      <div className={s.row}>
        {tones.map((t) => <StatusDot key={t} tone={t} letter={statusOf[t][0]} label={statusOf[t]} />)}
      </div>
    </>
  )
}
