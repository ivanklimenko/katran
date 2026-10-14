import type { ReactElement } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { useStableId } from '@katran/ui'
import { REASON_MAX } from '../lib/detail'

export type ReasonFieldProps = {
  value: string
  /** Запрос в полёте — поле только для чтения (модели и так игнорируют ввод при busy). */
  busy: boolean
  onChange: (value: string) => void
  /** Видимая подпись и доступное имя поля; по умолчанию «Причина». */
  label?: string | undefined
}

/* поле «Причина» в теле Prompt: подпись, поле, счётчик справа (решение правки 2d, аннулирование 2e) */
const Reason = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp1};
`

const Label = styled.label`
  font: 600 ${k.fs2} / ${k.lh2} ${k.sans};
  color: ${k.ink2};
`

const Field = styled.textarea`
  box-sizing: border-box;
  width: 100%;
  padding: ${k.sp1} ${k.sp2};
  border: 1px solid ${k.line};
  border-radius: ${k.rM};
  background: ${k.paper};
  font: ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink};
  resize: vertical;

  &:focus-visible {
    border-color: ${k.val};
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }
`

const Count = styled.span`
  align-self: flex-end;
  font-size: ${k.fs2};
  color: ${k.muted};
`

/**
 * Обязательное поле причины в теле Prompt (решение правки 2d, аннулирование 2e): подпись, многострочное поле до REASON_MAX
 * знаков и счётчик «N/140» — описание поля (aria-describedby). Пустоту после trim проверяет потребитель (okDisabled Prompt).
 */
export function ReasonField({ value, busy, onChange, label = 'Причина' }: ReasonFieldProps): ReactElement {
  const id = useStableId()
  const countId = useStableId()
  return (
    <Reason>
      <Label htmlFor={id}>{label}</Label>
      <Field
        id={id}
        rows={3}
        maxLength={REASON_MAX}
        required
        readOnly={busy}
        aria-describedby={countId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Count id={countId}>{value.length}/{REASON_MAX}</Count>
    </Reason>
  )
}
