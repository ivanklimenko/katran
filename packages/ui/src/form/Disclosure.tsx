import { useState, type ReactNode } from 'react'
import { useStableId } from '../compat/useStableId'
import { Counter } from '../value'
import s from './Form.module.css'

export type DisclosureProps = {
  title: string
  /** Правее заголовка: сводка, ссылки, время — интерактивное сюда, не в кнопку заголовка. */
  aside?: ReactNode | undefined
  count?: number | undefined
  /** Управляемый режим; без него — своё состояние от defaultOpen. */
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  /** Нет данных: пунктирная рамка, бледный заголовок «нет данных», не раскрывается. */
  empty?: boolean | undefined
  /** Вложенный уровень (подгруппы секции): без рамки, заголовок h4. */
  level?: 'block' | 'sub' | undefined
  /** Заголовок моноширинным, без капители: ключ секции аудита, имя исходника (эталон .au .ah, index.html:329–333). */
  mono?: boolean | undefined
  /** Текст справа у пустого блока вместо «нет данных» (исходники эталона — «нет»); aside у пустого не показывается. */
  emptyText?: string | undefined
  children?: ReactNode
}

/** Сворачиваемый блок (эталон .blk/.bh/.bb, index.html:167–174): кнопка заголовка с aria-expanded и панель. */
export function Disclosure({ title, aside, count, open, defaultOpen = false, onOpenChange, empty, level = 'block', mono, emptyText, children }: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen)
  const panel = useStableId()
  const isOpen = open ?? inner
  const set = (v: boolean) => { if (open === undefined) setInner(v); onOpenChange?.(v) }
  const H = level === 'sub' ? 'h4' : 'h3'
  const lv = level === 'sub' ? s.lvSub : s.lvBlock
  const face = mono ? s.mono : ''
  if (empty) {
    return (
      <div className={[s.blk, lv, face, s.empty].filter(Boolean).join(' ')}>
        <div className={s.bh}>
          <H className={s.bhTitle}>{title}</H>
          <span className={s.hint}>{emptyText ?? 'нет данных'}</span>
        </div>
      </div>
    )
  }
  return (
    <div className={[s.blk, lv, face, isOpen ? '' : s.shut].filter(Boolean).join(' ')}>
      <div className={s.bh}>
        <H className={s.bhTitle}>
          <button type="button" className={s.bhBtn} aria-expanded={isOpen} aria-controls={panel} onClick={() => set(!isOpen)}>{title}</button>
        </H>
        {count !== undefined && <Counter value={count} />}
        {aside}
        {/* шеврон — дубль кнопки заголовка для мыши (эталон .tg), вне порядка Tab и дерева доступности */}
        <button type="button" tabIndex={-1} aria-hidden="true" data-part="chevron" className={s.chev} onClick={() => set(!isOpen)}>▲</button>
      </div>
      <div id={panel} className={s.bb} hidden={!isOpen}>{children}</div>
    </div>
  )
}
