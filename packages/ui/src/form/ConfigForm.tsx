import { Fragment, useState, type ReactNode } from 'react'
import { Disclosure } from './Disclosure'
import { FieldRow } from './FieldRow'
import { isEmptyValue, type FieldPresenter } from './present'
import type { FieldDef, FieldRef, FieldValue, FormPart, FormSchema, HeroCell, SectionContent } from './types'
import s from './Form.module.css'

export type ConfigFormProps = {
  schema: FormSchema
  /** Реестр полей по тегу без префикса «B.». */
  fields: Record<string, FieldDef>
  value: (tag: string) => FieldValue | null
  present?: FieldPresenter | undefined
  optionLabels?: Record<string, string> | undefined
  renderHero?: ((id: string) => HeroCell) | undefined
  renderBlock?: ((id: string) => ReactNode) | undefined
  renderSection?: ((id: string) => SectionContent) | undefined
  /**
   * Раскрытые поля (теги из схемы) и секции (id) одним набором; id секций не совпадают с тегами полей.
   * Задан — управляемый режим: форма показывает ровно этот набор, и раскрытие переживает размонтирование
   * (TabPanel размонтирует неактивную вкладку — техдолг M-g). Не задан — своё состояние, как в 2a.
   */
  expanded?: string[] | undefined
  /** Полный новый набор раскрытых после действия пользователя; зовётся в обоих режимах. */
  onExpandedChange?: ((keys: string[]) => void) | undefined
}

const tagOf = (r: FieldRef): string => (typeof r === 'string' ? r : r.tag)
const baseOf = (tag: string) => tag.replace(/^B\./, '')
const refsOfRow = (row: [FieldRef | null, FieldRef | null]) => row.filter((r): r is FieldRef => r !== null)

/** Группы, раскрываемые вместе: пара строки сетки и текстовые поля группы — соседняя карточка не растягивается пустой (эталон rowMates, index.html:1104). */
function mateGroups(parts: FormPart[]): string[][] {
  const groups: string[][] = []
  for (const p of parts) {
    for (const row of p.grid ?? []) groups.push(refsOfRow(row).map(tagOf))
    if (p.text && p.text.length > 1) groups.push(p.text.map(tagOf))
  }
  return groups
}

/**
 * Рендер «Общих данных» по схеме (спека 2a §3.1): сводка → блоки → поля (сетка пар, текст, extra) → последовательность B → секции.
 * Схема и реестр полей — данные приложения; ConfigForm не знает SWIFT.
 */
export function ConfigForm({ schema, fields, value, present, optionLabels, renderHero, renderBlock, renderSection, expanded, onExpandedChange }: ConfigFormProps) {
  const [open, setOpen] = useState<string[]>([])
  const [sections, setSections] = useState<Record<string, boolean>>({})
  const parts: FormPart[] = [schema, ...(schema.seqB ? [schema.seqB] : [])]
  const filled = (tag: string) => !isEmptyValue(value(tag))
  const groups = mateGroups(parts)
  const allTags = parts.flatMap((p) => [...(p.grid ?? []).flatMap((row) => refsOfRow(row).map(tagOf)), ...(p.text ?? []).map(tagOf)]).filter(filled)
  const hasGrid = (schema.grid?.length ?? 0) > 0 || schema.seqB !== undefined
  const hasFields = hasGrid || (schema.text?.length ?? 0) > 0 || (schema.extra?.length ?? 0) > 0
  const secs = (schema.sections ?? []).map((sec) => ({ sec, content: renderSection ? renderSection(sec.id) : null }))
  const secIds = secs.map(({ sec }) => sec.id)

  // Раскрытое одним набором: поля — теги, секции — id. Своё состояние хранит только отступления секций от умолчания схемы,
  // поэтому смена схемы без перемонтирования берёт умолчания новой — как в 2a.
  const keys = expanded ?? [...open, ...secs.filter(({ sec }) => sections[sec.id] ?? !(sec.collapsed ?? true)).map(({ sec }) => sec.id)]
  const isOpen = (key: string) => keys.includes(key)
  const commit = (next: string[], inner: () => void) => {
    if (expanded === undefined) inner()
    onExpandedChange?.(next)
  }
  const allOpen = allTags.length > 0 && allTags.every(isOpen)
  const anyShut = secs.some(({ sec, content }) => content !== null && !isOpen(sec.id))

  const toggle = (tag: string) => {
    const mates = groups.find((g) => g.includes(tag)) ?? [tag]
    const flip = (cur: string[]) => (cur.includes(tag)
      ? cur.filter((t) => !mates.includes(t))
      : [...cur.filter((t) => !mates.includes(t)), ...mates.filter(filled)])
    commit(flip(keys), () => setOpen(flip))
  }
  const toggleFields = () => commit(
    [...keys.filter((k) => !allTags.includes(k)), ...(allOpen ? [] : allTags)],
    () => setOpen(allOpen ? [] : allTags),
  )
  const toggleSections = () => commit(
    [...keys.filter((k) => !secIds.includes(k)), ...(anyShut ? secIds : [])],
    () => setSections(Object.fromEntries(secIds.map((id) => [id, anyShut]))),
  )
  const setSection = (id: string, o: boolean) => commit(
    o ? [...keys.filter((k) => k !== id), id] : keys.filter((k) => k !== id),
    () => setSections((cur) => ({ ...cur, [id]: o })),
  )

  const cell = (ref: FieldRef, wide: boolean) => {
    const tag = tagOf(ref)
    return (
      <FieldRow key={tag} tag={tag} def={fields[baseOf(tag)]} value={value(tag)} present={present} optionLabels={optionLabels}
        open={isOpen(tag)} onToggle={() => toggle(tag)} wide={wide} />
    )
  }
  const grid = (part: FormPart) => (
    <div className={s.fg}>
      {(part.grid ?? []).map((row, i) => {
        const hide = row.map((r) => r === null || (typeof r !== 'string' && r.hideIfEmpty === true && !filled(r.tag)))
        if (hide.every(Boolean)) return null
        return (
          <Fragment key={i}>
            {row.map((r, k) => (r === null || hide[k]
              ? <div key={`gap${k}`} className={s.gap} data-part="gap" aria-hidden="true" />
              : cell(r, false)))}
          </Fragment>
        )
      })}
      {(part.text ?? []).map((r) => cell(r, (part.text ?? []).length === 1))}
    </div>
  )
  const extra = (refs: FieldRef[] | undefined) => (refs && refs.length > 0 ? (
    <div className={s.extra}>
      {refs.map((r) => {
        const tag = tagOf(r)
        const v = value(tag)
        const def = fields[baseOf(tag)]
        return (
          <span key={tag} className={s.extraItem}>
            <span className={s.tag} data-k-tip={def ? `${baseOf(tag)} · ${def.label}` : undefined}>{baseOf(tag)}</span>
            {v === null || isEmptyValue(v)
              ? <span className={s.none}><span aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></span>
              : <span className={s.extraVal}>{v.lines.join(' ')}</span>}
          </span>
        )
      })}
    </div>
  ) : null)

  return (
    <div className={s.form}>
      {schema.hero && schema.hero.length > 0 && renderHero && (
        <div className={s.hero} data-part="hero" style={{ gridTemplateColumns: schema.hero.map((_, i, a) => (i === a.length - 1 ? '1fr' : 'auto')).join(' ') }}>
          {schema.hero.map((id) => {
            const c = renderHero(id)
            return (
              <div key={id} className={s.heroCell} data-align={c.align}>
                <span className={s.heroLabel} data-k-tip={c.tip}>{c.label}</span>
                <span className={s.heroValue}>{c.value}</span>
              </div>
            )
          })}
        </div>
      )}
      {(schema.blocks ?? []).map((id) => <Fragment key={id}>{renderBlock?.(id)}</Fragment>)}
      {hasFields && (
        <>
          <div className={s.fh}>
            {schema.fieldsTitle && <h3 className={s.fhTitle}>{schema.fieldsTitle}</h3>}
            {schema.fieldsHint && <span className={s.hint}>{schema.fieldsHint}</span>}
            {hasGrid && (
              <button type="button" className={s.link} onClick={toggleFields}>
                {allOpen ? 'Свернуть поля' : 'Развернуть поля'}
              </button>
            )}
          </div>
          {grid(schema)}
          {extra(schema.extra)}
        </>
      )}
      {schema.seqB && (
        <>
          <div className={s.fh}><h3 className={s.fhTitle}>{schema.seqB.title}</h3></div>
          {grid(schema.seqB)}
          {extra(schema.seqB.extra)}
        </>
      )}
      {secs.length > 0 && (
        <>
          <div className={s.fh}>
            <h3 className={s.fhTitle}>{schema.sectionsTitle ?? 'Дополнительные блоки'}</h3>
            {secs.some(({ content }) => content !== null) && (
              <button type="button" className={s.link} onClick={toggleSections}>
                {anyShut ? 'Развернуть все' : 'Свернуть все'}
              </button>
            )}
          </div>
          {secs.map(({ sec, content }) => (
            <Disclosure key={sec.id} title={sec.title} empty={content === null} count={content?.count}
              open={isOpen(sec.id)} onOpenChange={(o) => setSection(sec.id, o)}>
              {content?.body}
            </Disclosure>
          ))}
        </>
      )}
    </div>
  )
}
