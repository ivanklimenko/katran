import { useEffect, type ReactNode } from 'react'
import { Button } from '../button'
import type { Selection } from '../grid/types'
import { useKatran } from '../provider'
import s from './BulkBar.module.css'

export type BulkBarProps = {
  label?: string | undefined
  selection: Selection
  total: number
  onClear: () => void
  /** Нет — нет перехода в режим «всё по фильтру». */
  onSelectAll?: (() => void) | undefined
  /** Действия приложения; полоса их не знает (спека 6.3: действия получают { filter, selection } на стороне приложения). */
  children?: ReactNode | undefined
}

/** Полоса массовых действий над пагинацией: «Выбрано N» или «Все N по фильтру»; при нуле не рендерится (спека 1e, 6.3). */
export function BulkBar({ label = 'Массовые действия', selection, total, onClear, onSelectAll, children }: BulkBarProps) {
  const all = selection.mode === 'all'
  const n = all ? Math.max(0, total - selection.except.length) : selection.ids.length
  const text = all ? `Все ${n} по фильтру` : `Выбрано ${n}`
  const { announce } = useKatran()
  useEffect(() => { if (n > 0) announce(text) }, [n, text, announce])
  if (n === 0) return null
  return (
    <div role="region" aria-label={label} className={s.bar}>
      <span className={s.count}>{text}</span>
      {!all && onSelectAll && n < total && <Button size="s" onClick={onSelectAll}>Выбрать все {total} по фильтру</Button>}
      <Button size="s" onClick={onClear}>Снять выделение</Button>
      {/* children && ... «съедал» бы валидные, но falsy значения (0, '') — слот нужен, когда children не «пусто»:
          не null/undefined/false; сами 0/'' в него попадут и отрендерятся как есть */}
      {children != null && children !== false && <span className={s.actions}>{children}</span>}
    </div>
  )
}
