import { k } from '@katran/tokens'
import { css } from '../styled'

/**
 * Класс приглушения уже показанных данных на время обновления — публичный API (`dimClass`): потребитель ставит его
 * на свой элемент. Строка класса постоянная, `k-dim`: у styled-компонента нет постоянного класса, который можно отдать.
 * Правило — фрагмент `dimRule` в шаблоне корня провайдера под `*:where(&)` (как горячий путь грида, R16): специфичность
 * прежнего `.dim` из State.module.css — (0,1,0).
 */
export const dimClass = 'k-dim'

/** Объявления приглушения — общие для класса `k-dim` и таблицы грида на время обновления (`data-dim`). */
export const dimmed = css`
  opacity: 0.55;
  transition: opacity ${k.tBase};
  pointer-events: none;
`

export const dimRule = css`
  .k-dim {
    ${dimmed}
  }
`
