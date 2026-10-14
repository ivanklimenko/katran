import { useEffect, useRef, type ReactNode } from 'react'
import { k } from '@katran/tokens'
import { Button } from '../button'
import type { Selection } from '../grid/types'
import { useKatran } from '../provider'
import { styled } from '../styled'

export type BulkBarProps = {
  label?: string | undefined
  selection: Selection
  total: number
  onClear: () => void
  /** Нет — нет перехода в режим «всё по фильтру». */
  onSelectAll?: (() => void) | undefined
  /** Действия приложения; полоса их не знает (спека 6.3: действия получают { filter, selection } на стороне приложения). */
  children?: ReactNode | undefined
  /** Приписка к «Все N по фильтру» — например «без неактивных» (спека 5a §6, B1). */
  allNote?: string | undefined
  className?: string | undefined
}

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  min-height: ${k.hCtlM};
  padding: ${k.sp1} ${k.sp2};
  border-radius: ${k.rM};
  background: ${k.valSoft};
  color: ${k.ink};
`

const Count = styled.span`
  font-weight: 600;
`

const Actions = styled.span`
  display: inline-flex;
  gap: ${k.sp2};
  margin-left: auto;
`

/** Полоса массовых действий над пагинацией: «Выбрано N» или «Все N по фильтру»; при нуле не рендерится (спека 1e, 6.3). */
export function BulkBar({ label = 'Массовые действия', selection, total, onClear, onSelectAll, children, allNote, className }: BulkBarProps) {
  const all = selection.mode === 'all'
  const n = all ? Math.max(0, total - selection.except.length) : selection.ids.length
  const text = all ? `Все ${n} по фильтру${allNote ? `, ${allNote}` : ''}` : `Выбрано ${n}`
  const { announce } = useKatran()
  // Полоса исчезает вместе с кнопкой «Снять выделение», фокус вернуть некуда — снятие хотя бы объявляем.
  // hadAny отличает переход к нулю от первого рендера с пустым выделением: тогда объявлять нечего.
  const hadAny = useRef(false)
  useEffect(() => {
    if (n > 0) announce(text)
    else if (hadAny.current) announce('Выделение снято')
    hadAny.current = n > 0
  }, [n, text, announce])
  if (n === 0) return null
  return (
    <Bar role="region" aria-label={label} className={className}>
      <Count>{text}</Count>
      {!all && onSelectAll && n < total && <Button size="s" onClick={onSelectAll}>Выбрать все {total} по фильтру</Button>}
      <Button size="s" onClick={onClear}>Снять выделение</Button>
      {/* children && ... «съедал» бы валидные, но falsy значения (0, '') — слот нужен, когда children не «пусто»:
          не null/undefined/false; сами 0/'' в него попадут и отрендерятся как есть */}
      {children != null && children !== false && <Actions>{children}</Actions>}
    </Bar>
  )
}
