import { k } from '@katran/tokens'
import { styled } from '../styled'

/**
 * Части пустого состояния и ошибки (EmptyState, ErrorState). Ошибка — атрибутом data-kind="error" на корне
 * (прежде второй класс .error): `.error .emptyTitle` — (0,2,0), здесь `Empty:where([data-kind='error']) Title` — та же.
 */
export const Empty = styled.div`
  display: grid;
  justify-items: center;
  gap: ${k.sp2};
  padding: ${k.sp8} ${k.sp4};
  text-align: center;
  color: ${k.muted};
`

export const EmptyTitle = styled.div`
  font: 500 ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink2};

  ${Empty}:where([data-kind='error']) & {
    color: ${k.bad};
  }
`

export const EmptyText = styled.div`
  font-size: ${k.fs2};
`
