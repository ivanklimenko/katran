import { useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { useStableId } from '../compat/useStableId'
import { Button, IconButton } from '../button'
import { Counter } from '../value'
import type { DateFormat } from '../date/dateStr'
import { FilterField } from './FilterField'
import { fieldChip } from './opLabels'
import type { Condition, Filter, FilterMeta, SuggestState } from './types'
import s from './Filters.module.css'

const Cross = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
// Воронка — эталон (стенд pi-constructor, .fbtn svg), путь как есть.
const Funnel = () => <svg viewBox="0 0 24 24"><path fill="currentColor" d="M4.2 5.4A1 1 0 015.1 4h13.8a1 1 0 01.8 1.6L14 12.2V18a1 1 0 01-1.5.86l-3-1.8A1 1 0 019 16.2v-4L4.3 5.6a1 1 0 01-.1-.2z" /></svg>

export type FilterPanelProps = {
  label?: string | undefined
  meta: FilterMeta
  conditions: Filter
  draft: Filter
  dirty: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Заменить условие поля; без onSetField панель зовёт его с первым условием поля (совместимость).
   * В совместимом режиме чужие условия поля (NE, NOT_IN…) теряются; новым экранам — onSetField. */
  onEdit: (c: Condition) => void
  /** Снять поле из черновика; без onSetField — когда поле опустело.
   * В совместимом режиме вместе с полем снимаются и его чужие условия (NE, NOT_IN…); новым экранам — onSetField. */
  onDiscard: (field: string) => void
  /** Заменить все условия поля в черновике разом; [] — снять поле (спека 2026-09-30 §7). */
  onSetField?: ((p: { field: string; conditions: Condition[] }) => void) | undefined
  /** Подсказки с бека: получает только поле с `suggest: true`, чьё имя в `suggest.field` (спека §8.2). */
  suggest?: SuggestState | null | undefined
  onSuggest?: ((p: { field: string; query: string }) => void) | undefined
  onSuggestClose?: (() => void) | undefined
  /** Шаблон дат для полей периода и чипов; по умолчанию DD.MM.YYYY (спека §6.5). */
  dateFormat?: DateFormat | undefined
  onApply: () => void
  onRevert: () => void
  onReset: () => void
  onRemove: (field: string) => void
}

/** Панель фильтров simple (спека 1e, 6.2; спека 2026-09-30 §6): строка «Фильтры N» с чипами видна всегда — чип и счёт
 * по полю, — тело с контролами по типу поля сворачивается. */
export function FilterPanel({
  label = 'Фильтры', meta, conditions, draft, dirty, open, onOpenChange, onEdit, onDiscard, onSetField,
  suggest, onSuggest, onSuggestClose, dateFormat = 'DD.MM.YYYY', onApply, onRevert, onReset, onRemove,
}: FilterPanelProps) {
  const bodyId = useStableId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  // Внешняя смена черновика (Сбросить, Отменить, ✕ чипа, лейн, «Сбросить фильтр» грида) должна стереть набранное
  // в полях, даже если условия поля в черновике и не было («-» в числе). Ввод в поле помечает следующую смену
  // черновика как свою: родитель меняет draft синхронно в том же событии, и React отрисовывает оба изменения
  // одним проходом. Любая другая смена черновика увеличивает epoch — поля сверяют с ним свой снимок.
  const [seen, setSeen] = useState({ draft, epoch: 0, own: false })
  if (seen.draft !== draft) setSeen({ draft, epoch: seen.own ? seen.epoch : seen.epoch + 1, own: false })
  else if (seen.own) setSeen({ ...seen, own: false })
  const setField = (field: string, cs: Condition[]) => {
    setSeen((v) => ({ ...v, own: true }))
    if (onSetField) onSetField({ field, conditions: cs })
    else if (cs.length === 0) onDiscard(field)
    else onEdit(cs[0]!) // совместимость: без onSetField поле отдаёт одно своё условие (FilterField, compat)
  }
  // Условия по полю — в порядке первого появления поля: чип и счёт «Фильтры N» — по полю, не по условию.
  const groups: { field: string; conditions: Condition[] }[] = []
  for (const c of conditions) {
    const g = groups.find((x) => x.field === c.field)
    if (g) g.conditions.push(c); else groups.push({ field: c.field, conditions: [c] })
  }
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
        <Button ref={toggleRef} variant="primary" size="s" aria-expanded={open} aria-controls={bodyId} className={s.toggle} onClick={() => onOpenChange(!open)}>
          <span className={s.toggleIcon} aria-hidden="true"><Funnel /></span>
          <span>{label}</span>
          <Counter value={groups.length} tone="accent" />
        </Button>
        {groups.length === 0
          ? <span className={s.none}>условия не заданы</span>
          : (
            <ul className={s.chips} aria-label="Применённые условия">
              {groups.map((g) => {
                const chip = fieldChip(g.field, g.conditions, meta, dateFormat)
                return (
                  <li key={g.field} className={s.chip} data-k-tip={chip.full}>
                    <span className={s.cf}>{chip.field}</span> <span className={s.co}>{chip.op}</span> <span className={s.cv}>{chip.value}</span>
                    <IconButton size="s" label={`Убрать условие: ${chip.full}`} className={s.chipX} onClick={(e) => remove(e, g.field)}><Cross /></IconButton>
                  </li>
                )
              })}
            </ul>
          )}
        {groups.length > 0 && <Button size="s" className={s.chipBtn} onClick={reset}>Сбросить</Button>}
      </div>
      <form id={bodyId} hidden={!open} className={s.body} onSubmit={submit}>
        <div className={s.fields}>
          {meta.fields.map((f) => (
            <FilterField key={f.id} field={f} draft={draft} epoch={seen.epoch} onSet={setField} compat={onSetField === undefined} dateFormat={dateFormat}
              suggest={suggest} onSuggest={onSuggest} onSuggestClose={onSuggestClose} />
          ))}
        </div>
        <div className={s.actions}>
          <Button type="submit" variant="primary" size="s" disabled={!dirty}>Применить</Button>
          <Button size="s" disabled={!dirty} onClick={onRevert}>Отменить</Button>
        </div>
      </form>
    </div>
  )
}
