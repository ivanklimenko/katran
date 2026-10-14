import { AccountValue, CopyValue, Counter, FieldTag, LinkValue, StatusDot, Tag, type StatusTone } from '@katran/ui'
import { H1, H2, Note, Row } from './parts'

const tones: StatusTone[] = ['flow', 'flowl', 'flowd', 'bad', 'badd', 'warn', 'ok', 'okl', 'grey']

/** Статус демо на каждый тон (у каждого тона ровно один статус) — буква и имя точки берутся из его названия. */
const STATUS_LABEL: Record<StatusTone, string> = {
  flow: 'В работе', flowl: 'К экспорту', flowd: 'В обработке', bad: 'Ошибка', badd: 'INVALID', warn: 'Отложенный',
  ok: 'Обработан', okl: 'Экспортирован', grey: 'Отказ',
}
const statusOf = STATUS_LABEL

export function ValuesPage() {
  return (
    <>
      <H1>Значения</H1>
      <Note>Каждое значение — отдельный элемент: клик копирует, тултип с полным значением только если обрезано или показано сокращённо. Наведите на длинное значение справа.</Note>
      <H2>CopyValue</H2>
      <Row>
        <CopyValue value="HSTBDEHHXXX" /><CopyValue value="Общество с ограниченной ответственностью «Северный ветер»" maxWidth={180} />
        <CopyValue value="12,5" tone="ink" /><CopyValue value="2026-09-22T07:33:22" display="22.09 07:33:22" short />
      </Row>
      <H2>LinkValue и AccountValue</H2>
      <Row>
        <LinkValue name="uuid" value="0f3c9a2e-7b1d-4c8e-9f0a-1b2c3d4e5f60" /><LinkValue name="refIn" value="REF20260922001" /><LinkValue name="refOut" />
        <AccountValue value="40702840500000012345" /><AccountValue value="40702840500000012345" full />
      </Row>
      <H2>FieldTag, Tag, Counter, StatusDot</H2>
      <Row>
        <FieldTag tag="70" title="70 · Детали платежа" /><FieldTag tag="50K" title="50K · Приказодатель (счёт + имя)" />
        <Tag>ЕРС</Tag><Tag>LORO</Tag><Tag tone="opt">COV</Tag>
        <Counter value={12} /><Counter value={12} active /><Counter value={0} />
      </Row>
      <Row>
        {tones.map((t) => <StatusDot key={t} tone={t} label={t} />)}
        <StatusDot tone="bad" letter="!" label="Ошибка" /><StatusDot tone="ok" size="s" />
      </Row>
      <H2>StatusDot с буквой — буква читаема на всех тонах</H2>
      <Note>На насыщенных тонах буква цвета бумаги, на светлых (к экспорту, экспортирован, отказ) — тёмная: контраст не ниже 4.5 в обеих темах.</Note>
      <Row>
        {tones.map((t) => <StatusDot key={t} tone={t} letter={statusOf[t][0]} label={statusOf[t]} />)}
      </Row>
    </>
  )
}
