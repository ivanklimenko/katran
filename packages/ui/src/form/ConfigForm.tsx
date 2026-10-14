import { Fragment, useState, type ReactNode } from 'react'
import { Disclosure } from './Disclosure'
import { FieldRow } from './FieldRow'
import { Hint, Sr, TagMark } from './parts'
import { isEmptyValue, type FieldPresenter } from './present'
import type { FieldDef, FieldRef, FieldValue, FormEdit, FormPart, FormSchema, HeroCell, SectionContent } from './types'
import { styled } from '../styled'
import { k } from '@katran/tokens'

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
  /**
   * Правка (спека 2c §2.1): карандаши у полей can(tag), состояние правки state(tag) и один редактор editing —
   * у поля сетки после обеих ячеек его строки, у текстового — сразу после поля, на всю ширину сетки. Не задано — вид 2a/2b.
   */
  edit?: FormEdit | undefined
  className?: string | undefined
}

/* «Общие данные» деталки (спека 2a §3.1, эталон index.html:131–260) */
const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp2};
`

/* сводка (эталон .hero) */
const Hero = styled.div`
  display: grid;
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
  background: ${k.sunk};
`

const HeroCellBox = styled.div`
  min-width: 0;
  padding: ${k.sp1} ${k.sp3};

  & + & {
    border-left: 1px solid ${k.line};
  }

  &[data-align='right'] {
    text-align: right;
  }
`

const HeroLabel = styled.span`
  display: block;
  font: ${k.fs3} / ${k.lh3} ${k.sans};
  color: ${k.muted};
`

const HeroValue = styled.span`
  font: 600 ${k.fsHero} / ${k.lh1} ${k.sans};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`

/* заголовок группы полей (эталон .fh) */
const Fh = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${k.sp2};
`

const FhTitle = styled.h3`
  margin: 0;
  font: 600 ${k.fs2} / ${k.lh2} ${k.sans};
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${k.ink2};
`

const Link = styled.button`
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  font: 500 ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.val};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }
`

/* сетка пар 50–54 | 55–59 (эталон .fg) */
const Fg = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: ${k.sp1} ${k.sp2};
`

const Gap = styled.div`
  visibility: hidden;
`

/* короткие поля одной строкой (эталон .xrow) */
const Extra = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${k.sp1} ${k.sp4};
  padding: ${k.sp1} ${k.sp2};
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
  white-space: nowrap;
`

const ExtraItem = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: ${k.sp1};
`

const ExtraVal = styled.span`
  color: ${k.val};
`

const None = styled.span`
  color: ${k.faint};
`

/* слот редактора — на всю ширину сетки полей (эталон .fe, grid-column: 1 / -1) */
const Editor = styled.div`
  grid-column: 1 / -1;
  min-width: 0;
`

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
export function ConfigForm({ schema, fields, value, present, optionLabels, renderHero, renderBlock, renderSection, expanded, onExpandedChange, edit, className }: ConfigFormProps) {
  const [open, setOpen] = useState<string[]>([])
  const [sections, setSections] = useState<Record<string, boolean>>({})
  const parts: FormPart[] = [schema, ...(schema.seqB ? [schema.seqB] : [])]
  const filled = (tag: string) => !isEmptyValue(value(tag))
  const edited = (tag: string) => (edit?.state(tag) ?? null) !== null
  // Раскрывается заполненное поле и поле с правками — у пустого после правки «в пусто» в раскрытии «Было / Стало» и аудит
  const expandable = (tag: string) => filled(tag) || edited(tag)
  const groups = mateGroups(parts)
  const allTags = parts.flatMap((p) => [...(p.grid ?? []).flatMap((row) => refsOfRow(row).map(tagOf)), ...(p.text ?? []).map(tagOf)]).filter(expandable)
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
      : [...cur.filter((t) => !mates.includes(t)), ...mates.filter(expandable)])
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
        open={isOpen(tag)} onToggle={() => toggle(tag)} wide={wide}
        editable={edit?.can(tag)} editing={edit?.editing === tag} onEdit={() => edit?.onEdit(tag)} edit={edit?.state(tag)} />
    )
  }
  const editor = (tags: string[]) => (edit && edit.editing !== null && tags.includes(edit.editing)
    ? <Editor key={`editor:${edit.editing}`} data-part="editor">{edit.renderEditor(edit.editing)}</Editor>
    : null)
  const grid = (part: FormPart) => (
    <Fg>
      {(part.grid ?? []).map((row, i) => {
        const hide = row.map((r) => r === null || (typeof r !== 'string' && r.hideIfEmpty === true && !expandable(r.tag)))
        if (hide.every(Boolean)) return null
        return (
          <Fragment key={i}>
            {row.map((r, k) => (r === null || hide[k]
              ? <Gap key={`gap${k}`} data-part="gap" aria-hidden="true" />
              : cell(r, false)))}
            {editor(row.filter((r, k): r is FieldRef => r !== null && !hide[k]).map(tagOf))}
          </Fragment>
        )
      })}
      {(part.text ?? []).map((r) => (
        <Fragment key={tagOf(r)}>
          {cell(r, (part.text ?? []).length === 1)}
          {editor([tagOf(r)])}
        </Fragment>
      ))}
    </Fg>
  )
  const extra = (refs: FieldRef[] | undefined) => (refs && refs.length > 0 ? (
    <Extra>
      {refs.map((r) => {
        const tag = tagOf(r)
        const v = value(tag)
        const def = fields[baseOf(tag)]
        return (
          <ExtraItem key={tag}>
            <TagMark data-k-tip={def ? `${baseOf(tag)} · ${def.label}` : undefined}>{baseOf(tag)}</TagMark>
            {v === null || isEmptyValue(v)
              ? <None><span aria-hidden="true">—</span><Sr>не заполнено</Sr></None>
              : <ExtraVal>{v.lines.join(' ')}</ExtraVal>}
          </ExtraItem>
        )
      })}
    </Extra>
  ) : null)

  return (
    <Form className={className}>
      {schema.hero && schema.hero.length > 0 && renderHero && (
        <Hero data-part="hero" style={{ gridTemplateColumns: schema.hero.map((_, i, a) => (i === a.length - 1 ? '1fr' : 'auto')).join(' ') }}>
          {schema.hero.map((id) => {
            const c = renderHero(id)
            return (
              <HeroCellBox key={id} data-align={c.align}>
                <HeroLabel data-k-tip={c.tip}>{c.label}</HeroLabel>
                <HeroValue>{c.value}</HeroValue>
              </HeroCellBox>
            )
          })}
        </Hero>
      )}
      {(schema.blocks ?? []).map((id) => <Fragment key={id}>{renderBlock?.(id)}</Fragment>)}
      {hasFields && (
        <>
          <Fh>
            {schema.fieldsTitle && <FhTitle>{schema.fieldsTitle}</FhTitle>}
            {schema.fieldsHint && <Hint>{schema.fieldsHint}</Hint>}
            {hasGrid && (
              <Link type="button" onClick={toggleFields}>
                {allOpen ? 'Свернуть поля' : 'Развернуть поля'}
              </Link>
            )}
          </Fh>
          {grid(schema)}
          {extra(schema.extra)}
        </>
      )}
      {schema.seqB && (
        <>
          <Fh><FhTitle>{schema.seqB.title}</FhTitle></Fh>
          {grid(schema.seqB)}
          {extra(schema.seqB.extra)}
        </>
      )}
      {secs.length > 0 && (
        <>
          <Fh>
            <FhTitle>{schema.sectionsTitle ?? 'Дополнительные блоки'}</FhTitle>
            {secs.some(({ content }) => content !== null) && (
              <Link type="button" onClick={toggleSections}>
                {anyShut ? 'Развернуть все' : 'Свернуть все'}
              </Link>
            )}
          </Fh>
          {secs.map(({ sec, content }) => (
            <Disclosure key={sec.id} title={sec.title} empty={content === null} count={content?.count}
              open={isOpen(sec.id)} onOpenChange={(o) => setSection(sec.id, o)}>
              {content?.body}
            </Disclosure>
          ))}
        </>
      )}
    </Form>
  )
}
