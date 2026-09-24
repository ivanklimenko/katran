import { useId, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Button, IconButton } from '../button'
import { Counter } from '../value'
import { FilterField } from './FilterField'
import { describeCondition } from './opLabels'
import type { Condition, Filter, FilterMeta } from './types'
import s from './Filters.module.css'

const Cross = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>

export type FilterPanelProps = {
  label?: string | undefined
  meta: FilterMeta
  conditions: Filter
  draft: Filter
  dirty: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (c: Condition) => void
  onDiscard: (field: string) => void
  onApply: () => void
  onRevert: () => void
  onReset: () => void
  onRemove: (field: string) => void
}

/** Панель фильтров simple (спека 1e, 6.2): строка «Фильтры N» с чипами видна всегда, тело с полями сворачивается. */
export function FilterPanel({ label = 'Фильтры', meta, conditions, draft, dirty, open, onOpenChange, onEdit, onDiscard, onApply, onRevert, onReset, onRemove }: FilterPanelProps) {
  const bodyId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  // Внешняя смена черновика (Сбросить, Отменить, ✕ чипа, лейн, «Сбросить фильтр» грида) должна стереть набранное
  // в полях, даже если условия поля в черновике и не было («-» в числе). Ввод в поле помечает следующую смену
  // черновика как свою: родитель меняет draft синхронно в том же событии, и React отрисовывает оба изменения
  // одним проходом. Любая другая смена черновика увеличивает epoch — поля сверяют с ним свой снимок.
  const [seen, setSeen] = useState({ draft, epoch: 0, own: false })
  if (seen.draft !== draft) setSeen({ draft, epoch: seen.own ? seen.epoch : seen.epoch + 1, own: false })
  else if (seen.own) setSeen({ ...seen, own: false })
  const edit = (c: Condition) => { setSeen((v) => ({ ...v, own: true })); onEdit(c) }
  const discard = (field: string) => { setSeen((v) => ({ ...v, own: true })); onDiscard(field) }
  const submit = (e: FormEvent) => { e.preventDefault(); if (dirty) onApply() }
  // Нажатая кнопка исчезает вместе с чипом (или со всей строкой чипов) — фокус переводим заранее, пока соседи
  // на месте: на ✕ следующего чипа, иначе предыдущего, иначе на кнопку «Фильтры». Явный перевод в обработчике
  // проще эффекта «по смене conditions»: не нужно помнить намерение между рендерами.
  const remove = (e: MouseEvent<HTMLButtonElement>, field: string) => {
    const li = e.currentTarget.closest('li')
    const near = li?.nextElementSibling ?? li?.previousElementSibling
    const target = near?.querySelector('button') ?? toggleRef.current
    target?.focus()
    onRemove(field)
  }
  const reset = () => { toggleRef.current?.focus(); onReset() }
  return (
    <div className={s.panel}>
      <div className={s.bar}>
        <Button ref={toggleRef} size="s" aria-expanded={open} aria-controls={bodyId} className={s.toggle} onClick={() => onOpenChange(!open)}>
          <span>{label}</span>
          <Counter value={conditions.length} active={open} />
        </Button>
        {conditions.length === 0
          ? <span className={s.none}>условия не заданы</span>
          : (
            <ul className={s.chips} aria-label="Применённые условия">
              {conditions.map((c) => {
                const text = describeCondition(c, meta)
                return (
                  <li key={c.field} className={s.chip}>
                    <span>{text}</span>
                    <IconButton size="s" label={`Убрать условие: ${text}`} className={s.chipX} onClick={(e) => remove(e, c.field)}><Cross /></IconButton>
                  </li>
                )
              })}
            </ul>
          )}
        {conditions.length > 0 && <Button size="s" onClick={reset}>Сбросить</Button>}
      </div>
      <form id={bodyId} hidden={!open} className={s.body} onSubmit={submit}>
        <div className={s.fields}>
          {meta.fields.map((f) => <FilterField key={f.id} field={f} draft={draft} epoch={seen.epoch} onEdit={edit} onDiscard={discard} />)}
        </div>
        <div className={s.actions}>
          <Button type="submit" variant="primary" size="s" disabled={!dirty}>Применить</Button>
          <Button size="s" disabled={!dirty} onClick={onRevert}>Отменить</Button>
        </div>
      </form>
    </div>
  )
}
