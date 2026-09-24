import { useId, useState } from 'react'
import { Input, Select } from '../input'
import { conditionFrom, draftOf, fieldOp, type RawValue } from './fieldOps'
import type { Condition, Filter, FilterField as Field } from './types'
import s from './Filters.module.css'

export type FilterFieldProps = {
  field: Field
  draft: Filter
  /** Счётчик внешних смен черновика (FilterPanel): сменился — набранное в поле больше не действует. */
  epoch: number
  onEdit: (c: Condition) => void
  onDiscard: (field: string) => void
}

/** Один контрол панели simple: оператор фиксирован типом поля; пустое значение снимает условие из черновика. */
export function FilterField({ field, draft, epoch, onEdit, onDiscard }: FilterFieldProps) {
  const id = useId()
  // Черновик хранит нормализованное условие («Иван » → «Иван», «1,» → 1, «-» → без условия, DATETIME с одной
  // границей → BETWEEN за этот день), и значение из него съело бы набираемое. Поэтому поле показывает набранное
  // (строку или пару дат), пока действует снимок: черновик не менялся мимо полей панели (epoch тот же) и условие
  // поля в черновике совпадает со снятым при наборе. Иначе (Отменить, Сбросить, ✕ у чипа, лейн) — значение из черновика.
  const [typed, setTyped] = useState<{ raw: RawValue; snap: string; epoch: number } | null>(null)
  const current = JSON.stringify(draft.find((x) => x.field === field.id) ?? null)
  const raw: RawValue = typed !== null && typed.epoch === epoch && typed.snap === current ? typed.raw : draftOf(draft, field)
  const set = (next: RawValue) => {
    const c = conditionFrom(field, next)
    setTyped({ raw: next, snap: JSON.stringify(c), epoch })
    if (c) onEdit(c); else onDiscard(field.id)
  }
  if (fieldOp(field) === null) return null
  const label = <label htmlFor={id} className={s.fieldLabel}>{field.label}</label>
  switch (field.type) {
    case 'ENUM':
      return <div className={s.fieldBox}>{label}<Select id={id} size="s" placeholder="—" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} options={(field.values ?? []).map((v) => ({ value: String(v.value), label: v.label }))} /></div>
    case 'BOOLEAN':
      return <div className={s.fieldBox}>{label}<Select id={id} size="s" placeholder="—" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} options={[{ value: 'true', label: 'да' }, { value: 'false', label: 'нет' }]} /></div>
    case 'DATETIME': {
      const v = typeof raw === 'string' ? { from: '', to: '' } : raw
      return (
        <fieldset className={s.fieldBox}>
          <legend className={s.fieldLabel}>{field.label}</legend>
          <div className={s.range}>
            <Input type="date" size="s" aria-label={`${field.label}, с`} value={v.from} onChange={(e) => set({ ...v, from: e.target.value })} />
            <Input type="date" size="s" aria-label={`${field.label}, по`} value={v.to} onChange={(e) => set({ ...v, to: e.target.value })} />
          </div>
        </fieldset>
      )
    }
    case 'DATE':
      return <div className={s.fieldBox}>{label}<Input id={id} type="date" size="s" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} /></div>
    case 'NUMBER':
      return <div className={s.fieldBox}>{label}<Input id={id} size="s" inputMode="decimal" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} /></div>
    default:
      return <div className={s.fieldBox}>{label}<Input id={id} size="s" value={typeof raw === 'string' ? raw : ''} onChange={(e) => set(e.target.value)} /></div>
  }
}
