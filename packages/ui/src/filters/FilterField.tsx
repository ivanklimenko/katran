import { useEffect, useRef, useState } from 'react'
import { useStableId } from '../compat/useStableId'
import { DateRange } from '../date/DateRange'
import type { DateFormat } from '../date/dateStr'
import { Input } from '../input'
import { MultiSelect } from '../select/MultiSelect'
import { SearchSelect } from '../select/SearchSelect'
import { TagInput } from '../tag/TagInput'
import { conditionsFrom, draftOf, fieldControl, fieldMax, foreignOf, isNumberText, rangeToDisabled, type FieldRaw } from './fieldOps'
import { FieldBox, FieldLabel } from './parts'
import type { Condition, Filter, FilterField as Field, SuggestState } from './types'

export type FilterFieldProps = {
  field: Field
  draft: Filter
  /** Счётчик внешних смен черновика (FilterPanel): сменился — набранное в поле больше не действует. */
  epoch: number
  onSet: (field: string, conditions: Condition[]) => void
  /** Совместимый режим панели (без onSetField): поле отдаёт не больше одного условия — своё, фразы ограничены одной. */
  compat: boolean
  dateFormat: DateFormat
  suggest?: SuggestState | null | undefined
  onSuggest?: ((p: { field: string; query: string }) => void) | undefined
  onSuggestClose?: (() => void) | undefined
}

type TagsRaw = Extract<FieldRaw, { kind: 'tags' }>
const EMPTY_TAGS: TagsRaw = { kind: 'tags', value: [], text: '' }
const BOOL = [{ value: true, label: 'да' }, { value: false, label: 'нет' }]

/** Контрол поля панели simple (спека 2026-09-30 §6.2). Показывает набранное (сырое значение), пока действует снимок:
 * черновик не менялся мимо полей (epoch тот же) и условия поля в черновике — те, что поле само отдало. Иначе (Отменить,
 * Сбросить, ✕ у чипа, лейн) — значение из черновика. Сырое значение нужно, потому что черновик нормализован:
 * «1,» → 1, «-» → без условия, набираемый текст TagInput — уже условие. */
export function FilterField({ field, draft, epoch, onSet, compat, dateFormat, suggest, onSuggest, onSuggestClose }: FilterFieldProps) {
  const id = useStableId()
  const [typed, setTyped] = useState<{ raw: FieldRaw; snap: string; epoch: number } | null>(null)
  const current = JSON.stringify(draft.filter((x) => x.field === field.id))
  const raw: FieldRaw = typed !== null && typed.epoch === epoch && typed.snap === current ? typed.raw : draftOf(draft, field)
  // Одно событие TagInput может сообщить и чипы, и текст двумя вызовами (вставка: onChange, затем onTextChange('')) —
  // второй не должен затереть первый старым замыканием: копим в ref до следующего рендера (мутация — в обработчиках).
  const pending = useRef<FieldRaw | null>(null)
  useEffect(() => { pending.current = null })
  const set = (next: FieldRaw) => {
    pending.current = next
    // условия поля, которых контрол не выражает (NE, NOT_IN, GT по числу…), правка поля не трогает; в совместимом
    // режиме владелец держит одно условие на поле — отдаём только своё условие контрола, чужое не подменяет правку
    const cs = compat ? conditionsFrom(field, next).slice(0, 1) : [...foreignOf(field, draft), ...conditionsFrom(field, next)]
    setTyped({ raw: next, snap: JSON.stringify(cs), epoch })
    onSet(field.id, cs)
  }
  const control = fieldControl(field)
  if (control === null) return null
  // Видимая подпись групп (период, справочники): доступное имя контролы получают своим aria-label, <label> не нужен.
  const caption = <FieldLabel>{field.label}</FieldLabel>

  switch (control) {
    case 'values':
    case 'phrases': {
      const tags = (r: FieldRaw): TagsRaw => (r.kind === 'tags' ? r : EMPTY_TAGS)
      const r = tags(raw)
      const base = () => tags(pending.current ?? raw)
      // const ask сужается в замыкании onQuery; проверка через отдельный boolean не сузила бы onSuggest
      const ask = field.suggest === true ? onSuggest : undefined
      const mine = suggest && suggest.field === field.id ? suggest : null
      return (
        <FieldBox data-part="field-box">
          <FieldLabel as="label" htmlFor={id}>{field.label}</FieldLabel>
          <TagInput
            id={id} aria-label={field.label} size="s" mode={control} value={r.value} text={r.text}
            onChange={(v) => set({ ...base(), value: v })}
            onTextChange={(t) => set({ ...base(), text: t })}
            validate={field.type === 'NUMBER' ? isNumberText : undefined}
            max={compat && control === 'phrases' ? 1 : fieldMax(field)}
            suggestions={ask ? (mine?.items ?? []).filter((x) => !r.value.includes(x)) : undefined}
            loading={ask ? mine?.loading ?? false : undefined}
            onQuery={ask ? (q) => ask({ field: field.id, query: q }) : undefined}
            onSuggestClose={ask ? onSuggestClose : undefined}
          />
        </FieldBox>
      )
    }
    case 'dateRange':
      return (
        <FieldBox data-wide={field.type === 'DATETIME' ? '' : undefined} data-part="field-box">
          {caption}
          <DateRange label={field.label} size="s" time={field.type === 'DATETIME'} format={dateFormat} toDisabled={rangeToDisabled(field)}
            value={raw.kind === 'range' ? raw.value : { from: '', to: '' }} onChange={(v) => set({ kind: 'range', value: v })} />
        </FieldBox>
      )
    case 'enum':
      return (
        <FieldBox data-part="field-box">
          {caption}
          <MultiSelect id={id} aria-label={field.label} size="s" max={fieldMax(field)} options={(field.values ?? []).map((v) => ({ value: v.value, label: v.label }))}
            value={raw.kind === 'enum' ? raw.value : []} onChange={(v) => set({ kind: 'enum', value: v })} />
        </FieldBox>
      )
    case 'boolean':
      return (
        <FieldBox data-part="field-box">
          {caption}
          <SearchSelect id={id} aria-label={field.label} size="s" searchable={false} options={BOOL}
            value={raw.kind === 'text' && raw.value !== '' ? raw.value === 'true' : null}
            onChange={(v) => set({ kind: 'text', value: v === null ? '' : String(v) })} />
        </FieldBox>
      )
    case 'number':
      return (
        <FieldBox data-part="field-box">
          <FieldLabel as="label" htmlFor={id}>{field.label}</FieldLabel>
          <Input id={id} size="s" inputMode="decimal" value={raw.kind === 'text' ? raw.value : ''} onChange={(e) => set({ kind: 'text', value: e.target.value })} />
        </FieldBox>
      )
    default: {
      // новый вид контрола в FieldControl без ветки здесь — ошибка компиляции
      const missing: never = control
      return missing
    }
  }
}
