import styled from 'styled-components'

/** Текст только для чтения с экрана: «не заполнено» у «—», «Загрузка» у скелетона, подпись колонки без видимого заголовка. */
export const Sr = styled.span`
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`
