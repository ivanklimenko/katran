import type { ReactElement } from 'react'
import { useStableId } from '@katran/ui'
import { REASON_MAX } from '../lib/detail'
import s from './ReasonField.module.css'

export type ReasonFieldProps = {
  value: string
  /** Запрос в полёте — поле только для чтения (модели и так игнорируют ввод при busy). */
  busy: boolean
  onChange: (value: string) => void
  /** Видимая подпись и доступное имя поля; по умолчанию «Причина». */
  label?: string | undefined
}

/**
 * Обязательное поле причины в теле Prompt (решение правки 2d, аннулирование 2e): подпись, многострочное поле до REASON_MAX
 * знаков и счётчик «N/140» — описание поля (aria-describedby). Пустоту после trim проверяет потребитель (okDisabled Prompt).
 */
export function ReasonField({ value, busy, onChange, label = 'Причина' }: ReasonFieldProps): ReactElement {
  const id = useStableId()
  const countId = useStableId()
  return (
    <div className={s.reason}>
      <label htmlFor={id} className={s.label}>{label}</label>
      <textarea
        id={id}
        className={s.field}
        rows={3}
        maxLength={REASON_MAX}
        required
        readOnly={busy}
        aria-describedby={countId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span id={countId} className={s.count}>{value.length}/{REASON_MAX}</span>
    </div>
  )
}
