import { useId, useState } from 'react'
import { Input, Select } from '../input'
import { conditionFrom, draftOf, fieldOp, type RawValue } from './fieldOps'
import type { Condition, Filter, FilterField as Field } from './types'
import s from './Filters.module.css'

export type FilterFieldProps = {
  field: Field
  draft: Filter
  onEdit: (c: Condition) => void
  onDiscard: (field: string) => void
}

/** Один контрол панели simple: оператор фиксирован типом поля; пустое значение снимает условие из черновика. */
export function FilterField({ field, draft, onEdit, onDiscard }: FilterFieldProps) {
  const id = useId()
  // Черновик хранит нормализованное условие («Иван » → «Иван», «1,» → 1, «-» → без условия), и значение
  // из него съело бы набираемый символ. Поэтому поле показывает набранный текст, пока условие поля в черновике
  // совпадает со снимком, сделанным при наборе; сменился черновик извне (Отменить, Сбросить, ✕ у чипа) —
  // поле берёт значение из черновика.
  const [typed, setTyped] = useState<{ text: string; snap: string } | null>(null)
  const current = JSON.stringify(draft.find((x) => x.field === field.id) ?? null)
  const raw: RawValue = typed !== null && typed.snap === current ? typed.text : draftOf(draft, field)
  const set = (next: RawValue) => {
    const c = conditionFrom(field, next)
    if (typeof next === 'string') setTyped({ text: next, snap: JSON.stringify(c) })
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
