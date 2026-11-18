import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { k } from '@katran/tokens'
import { styled } from '../styled'
import { fieldFrame } from './parts'

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> & {
  size?: 's' | 'm' | 'l' | undefined
  invalid?: boolean | undefined
}

const Root = styled.textarea`
  ${fieldFrame}
  box-sizing: border-box;
  max-width: 100%;
  padding: 0 ${k.sp2};
  font: 400 ${k.fs1} / ${k.lh1} ${k.sans};
  resize: vertical;

  &:where([data-size='s']) {
    font-size: ${k.fs2};
  }

  &::placeholder {
    color: ${k.faint};
  }
`

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { size = 'm', rows = 3, invalid, 'aria-invalid': ariaInvalid, ...rest }, ref,
) {
  return <Root {...rest} ref={ref} rows={rows} data-size={size} data-invalid={invalid || undefined} aria-invalid={invalid || ariaInvalid} />
})
