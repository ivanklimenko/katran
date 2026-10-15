import { styled } from '../styled'
import { Popover } from '../overlay'
import { k } from '@katran/tokens'

/** Части поля выбора, общие для SearchSelect и MultiSelect. */
export const Ph = styled.span`
  color: ${k.faint};
`

export const Chev = styled.span`
  display: inline-grid;
  flex: none;
  place-items: center;
  color: ${k.muted};

  & > svg {
    width: ${k.iconS};
    height: ${k.iconS};
  }
`

/** Поповер списка: группа после правил поповера — ширина поля фильтра перебивает его минимальную ширину. */
export const Pop = styled(Popover)`
  min-width: ${k.filterField};
`
