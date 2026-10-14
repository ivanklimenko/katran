import styled from 'styled-components'
import { k } from '@katran/tokens'

// Общие части страниц витрины: заголовки, пояснение и рамка примеров (бывший Page.module.css).
// Части одной страницы — в её файле.

export const H1 = styled.h1`
  font: 700 ${k.fsH1} / 1.2 ${k.sans};
  margin: 0 0 ${k.sp2};
`

export const Note = styled.p`
  color: ${k.muted};
  margin: 0 0 ${k.sp5};
  max-width: ${k.noteMax};
`

export const H2 = styled.h2`
  font: 600 ${k.fs1} / 1.2 ${k.sans};
  margin: ${k.sp5} 0 ${k.sp2};
  color: ${k.ink2};
`

export const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${k.sp2};
  padding: ${k.sp3};
  border: 1px solid ${k.line};
  border-radius: ${k.rM};
  background: ${k.paper};
`
