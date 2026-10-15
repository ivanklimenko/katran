import { styled } from '../styled'
import { k } from '@katran/tokens'

/** Части «Общих данных», общие для ConfigForm, FieldRow, Disclosure и KeyValueList (прежде — один Form.module.css). */

/** Тег SWIFT-поля: строка поля и короткие поля одной строкой; в текстовом поле FieldRow задаёт ему ширину колонки. */
export const TagMark = styled.span`
  font: 600 ${k.fs1} / 1 ${k.mono};
  color: ${k.ink};
  cursor: help;
`

export const Hint = styled.span`
  font-size: ${k.fs2};
  color: ${k.muted};
`

/* только для скринридера — как живая область провайдера */
export const Sr = styled.span`
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`
