import { useEffect, useRef, type CSSProperties } from 'react'
import { IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import { styled } from '../styled'
import { Sr, TagMark } from './parts'
import { defaultPresent, isEmptyValue, type FieldPresenter } from './present'
import type { FieldDef, FieldEdit, FieldValue } from './types'
import { k } from '@katran/tokens'

export type FieldRowProps = {
  /** Тег как в схеме: '50' или 'B.50' — показывается без префикса. */
  tag: string
  def: FieldDef | undefined
  value: FieldValue | null
  present?: FieldPresenter | undefined
  /** Подсказки букв опции: { A: 'Опция A — BIC', … } — данные приложения. */
  optionLabels?: Record<string, string> | undefined
  open?: boolean | undefined
  onToggle?: (() => void) | undefined
  /** Текстовое поле одно в группе — во всю ширину сетки. */
  wide?: boolean | undefined
  /** Карандаш у поля (спека 2c §2.1). */
  editable?: boolean | undefined
  /** Редактор поля открыт (его рисует ConfigForm соседом ячейки). */
  editing?: boolean | undefined
  onEdit?: (() => void) | undefined
  /** Состояние правки; null — правок не было. */
  edit?: FieldEdit | null | undefined
  className?: string | undefined
}

const Row = styled.div`
  display: grid;
  grid-template-columns: ${k.fieldTag} ${k.fieldOpt} minmax(0, 1fr) auto ${k.iconM};
  gap: 0 ${k.fieldGap};
  align-items: center;
  width: 100%;
`

/** Строка-кнопка раскрытия: та же сетка строки (рендерится как button). */
const Toggle = styled(Row)`
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 2px;
  }
`

const Opt = styled.span`
  font: 700 ${k.fs1} / 1 ${k.mono};
  color: ${k.opt};
  text-align: center;
`

const Main = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
  color: ${k.val};
`

const Second = styled.span`
  font: ${k.fs2} / ${k.lh2} ${k.mono};
  color: ${k.ink2};
  white-space: nowrap;
`

const Eye = styled.span`
  display: grid;
  place-items: center;
  color: ${k.faint};

  & svg {
    width: ${k.iconM};
    height: ${k.iconM};
  }
`

/* раскрытие поля под значением: полный текст, аудит, «✎ Изменить» — с колонки значения (эталон .full/.hs/.ed, grid-column: 3 / -1) */
const Panel = styled.div`
  margin-left: calc(${k.fieldTag} + ${k.fieldOpt} + 2 * ${k.fieldGap});
`

/* полный текст раскрытого поля (эталон .full) */
const Full = styled.div`
  margin: 0 0 ${k.sp1};
  padding-top: ${k.sp1};
  border-top: 1px dashed ${k.line};
  font: ${k.fs1} / ${k.lh1} ${k.mono};
  color: ${k.val};
  white-space: pre-wrap;
`

const Body = styled.div`
  flex: 1;
  min-width: 0;
`

const Pre = styled.pre`
  display: block;
  margin: 0;
  min-height: calc(${k.lhPre} * var(--k-show, 4));
  overflow: hidden;
  font: ${k.fsPre} / ${k.lhPre} ${k.mono};
  color: ${k.val};
  white-space: pre;
`

const More = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: ${k.fs3} / ${k.lh3} ${k.sans};
  color: ${k.muted};
  cursor: pointer;

  &:hover {
    color: ${k.val};
  }
`

/* карандаш: значок 14 в кнопке 17, без рамки; виден при наведении на ячейку и в фокусе (двойной класс — выше варианта и размера кнопки кита) */
const PenBtn = styled(IconButton)`
  && {
    width: ${k.pen};
    height: ${k.pen};
    border-color: transparent;
    border-radius: ${k.rS};
    background: none;
    color: ${k.faint};
    opacity: 0;
  }

  &&:hover:not(:disabled) {
    border-color: transparent;
    background: ${k.valSoft};
    color: ${k.val};
  }
`

/* «✎ Изменить» в раскрытии (эталон .ed: 500 11, цвет val) */
const Ed = styled.button`
  display: block;
  margin-bottom: calc(${k.sp1} / 2);
  padding: 0;
  border: 0;
  background: none;
  font: 500 ${k.fs2} / ${k.lh2} ${k.sans};
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

/* панель правки текстового поля под текстом (решение в4): «Было / Стало», аудит, «✎ Изменить» */
const TextEdit = styled.div`
  margin-top: ${k.sp1};
  padding-top: ${k.sp1};
  border-top: 1px dashed ${k.line};

  & > ${Full} {
    padding-top: 0;
    border-top: 0;
  }
`

/**
 * Ячейка поля (эталон .cell, border-box); relative — для карандаша текстового поля и точки правки.
 * Модификаторы — атрибутами под :where() (специфичность прежних классов (0,1,0)): пустое — data-empty, раскрытое — data-open,
 * текстовое — data-kind="text", во всю ширину — data-wide, с карандашом — data-editable.
 */
const Cell = styled.div`
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  min-height: ${k.fieldRow};
  padding: 0 ${k.sp2};
  border: 1px solid ${k.line};
  border-radius: ${k.rS};

  &:where([data-empty]) {
    border-style: dashed;
  }

  /* текстовые поля 70/72/79 (эталон .cell.txt) */
  &:where([data-kind='text']) {
    flex-direction: row;
    align-items: flex-start;
    justify-content: flex-start;
    gap: ${k.fieldGap};
    padding-top: ${k.sp1};
    padding-bottom: ${k.sp1};
  }

  &:where([data-wide]) {
    grid-column: 1 / -1;
  }

  /* правимая строка сетки: строка-кнопка и карандаш-сосед — колонками, раскрытие — на всю ширину под ними */
  &:where([data-editable]:not([data-kind='text'])) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) ${k.pen};
    gap: 0 ${k.fieldGap};
    align-items: center;
    align-content: center;
  }

  /* у текстового поля карандаш — в правом верхнем углу (эталон .cell.txt .pen: 4 / 6, отступ справа 24) */
  &:where([data-editable][data-kind='text']) {
    padding-right: ${k.sp6};
  }

  &:hover {
    border-color: ${k.val};
  }

  &:where([data-empty]):hover {
    border-color: ${k.line};
  }

  &:where([data-empty]) ${Main} {
    font-weight: 400;
    color: ${k.faint};
  }

  &:where([data-open]) ${Second} {
    visibility: hidden;
  }

  &:hover ${Eye} {
    color: ${k.val};
  }

  &:where([data-kind='text']):hover {
    border-color: ${k.line};
  }

  &:where([data-kind='text']) ${TagMark} {
    flex: none;
    width: ${k.fieldTag};
  }

  &:where([data-empty]) ${Pre} {
    color: ${k.faint};
  }

  &:where([data-editable]) > ${Panel} {
    grid-column: 1 / -1;
  }

  &:where([data-kind='text']) ${PenBtn} {
    position: absolute;
    top: ${k.sp1};
    right: calc(${k.sp2} - ${k.sp1} / 2);
  }

  &:hover ${PenBtn},
  &:focus-within ${PenBtn},
  &[data-editing] ${PenBtn} {
    color: ${k.muted};
    opacity: 1;
  }

  /* изменённое поле: фон warn-row, рамка, главное значение и текст 70/72 — warn, точка 8 в углу со сдвигом −3 */
  &[data-edited],
  &[data-edited]:hover {
    border-color: ${k.warn};
    background: ${k.warnRow};
  }

  &[data-edited] ${Main},
  &[data-edited] ${Pre} {
    color: ${k.warn};
  }

  &[data-edited]::after {
    content: '';
    position: absolute;

    /* сдвиг эталона −3 при точке 8 — в долях точки, чтобы масштабироваться с плотностью вместе с ней */
    top: calc(${k.editDot} * -3 / 8);
    right: calc(${k.editDot} * -3 / 8);
    width: ${k.editDot};
    height: ${k.editDot};
    border-radius: 50%;
    background: ${k.warn};
    box-shadow: 0 0 0 2px ${k.paper};
  }

  /* ячейка с открытым редактором (эталон .cell.editing) */
  &[data-editing],
  &[data-editing]:hover {
    border-color: ${k.val};
    box-shadow: inset 0 0 0 1px ${k.val};
  }
`

const EyeIcon = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></svg>
// значок карандаша эталона (#i-edit, index.html:518)
const PenIcon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>

/**
 * Строка SWIFT-поля (спека 2a §3.1, эталон cell() и textHtml(), index.html:941, 1004): тег, буква опции, значение.
 * Пустое поле остаётся бледной строкой с прочерком — два документа рядом читаются построчно; доступный текст — «не заполнено».
 * Правка (спека 2c §2.1, эталон penHtml/.cell.edited, index.html:202–245, 980): карандаш — кнопка-сосед строки, не её потомок;
 * изменённое поле — data-edited и «Было / Стало» с аудитом в раскрытии; у текстового поля раскрытия может не быть (70: show = lines),
 * поэтому его «Было / Стало» и аудит — в панели под текстом, видимой, пока у поля есть правки (решение в4).
 */
export function FieldRow({ tag, def, value, present = defaultPresent, optionLabels, open = false, onToggle, wide, editable, editing = false, onEdit, edit, className }: FieldRowProps) {
  const panel = useStableId()
  const cellRef = useRef<HTMLDivElement>(null)
  const penRef = useRef<HTMLButtonElement>(null)
  const wasEditing = useRef(editing)
  // Закрытие редактора возвращает фокус на карандаш — если фокус потерян (редактор снят) или остался в ячейке;
  // ушедший на другой элемент (карандаш соседнего поля, другая вкладка) не трогается.
  useEffect(() => {
    if (wasEditing.current && !editing) {
      const active = document.activeElement
      if (!active || active === document.body || cellRef.current?.contains(active)) penRef.current?.focus()
    }
    wasEditing.current = editing
  }, [editing])

  const base = tag.replace(/^B\./, '')
  const tip = def ? `${base} · ${def.label}` : base
  const empty = value === null || isEmptyValue(value)
  const changed = edit?.changed === true
  // Название поля — не только тултипом (его не видят клавиатура и скринридер): скрытым текстом рядом с тегом.
  // Сосед, а не потомок тега: абсолютно позиционированный, он не занимает ячейку сетки строки и не меняет текст тега.
  const tagEl = <><TagMark data-k-tip={tip}>{base}</TagMark>{def && <Sr>{def.label}</Sr>}</>
  const editedSr = changed && <Sr>{edit.tip}</Sr>
  const pen = editable && (
    <PenBtn ref={penRef} size="s" label={`Редактировать поле ${tag}`} data-k-tip="Редактировать" onClick={onEdit}>
      <PenIcon />
    </PenBtn>
  )
  const cellAttrs = {
    ref: cellRef,
    className,
    'data-field': tag,
    'data-editable': editable ? '' : undefined,
    'data-edited': changed ? '' : undefined,
    'data-editing': editing ? '' : undefined,
    'data-k-tip': changed ? edit.tip : undefined,
  }
  const fullText = (v: FieldValue | null) => (v === null || isEmptyValue(v) ? ['—'] : present(tag, v).full)
  // раскрытие поля сетки и панель текстового поля: «Было / Стало» (если changed), аудит, «✎ Изменить»
  const wasNow = changed && <Full>{['Было:', ...fullText(edit.was), 'Стало:', ...fullText(value)].join('\n')}</Full>
  // «✎ Изменить» — только у поля с правками (эталон: f.edit); первая правка — карандашом
  const editBtn = editable && edit && (
    <Ed type="button" aria-label={`Изменить поле ${tag}`} onClick={onEdit}>
      <span aria-hidden="true">✎</span> Изменить
    </Ed>
  )

  if (def?.kind === 'text') {
    const lines = value?.lines ?? []
    const show = Math.min(def.show ?? def.lines ?? 4, def.lines ?? 4)
    const more = lines.length - show
    const moreText = open ? 'свернуть' : `ещё ${more} стр.`
    return (
      <Cell {...cellAttrs} data-kind="text" data-wide={wide ? '' : undefined} data-empty={empty ? '' : undefined} style={{ '--k-show': String(show) } as CSSProperties}>
        {tagEl}
        {editedSr}
        <Body>
          {empty
            ? <><Pre as="span" aria-hidden="true">—</Pre><Sr>не заполнено</Sr></>
            : <Pre id={panel}>{(open ? lines : lines.slice(0, show)).join('\n')}</Pre>}
          {more > 0 && (
            <More type="button" aria-expanded={open} aria-controls={panel} aria-label={`${moreText} — ${tip}`} onClick={onToggle}>
              {moreText}
            </More>
          )}
          {edit && <TextEdit>{wasNow}{edit.audit}{editBtn}</TextEdit>}
        </Body>
        {pen}
      </Cell>
    )
  }

  if (empty && !edit) {
    return (
      <Cell {...cellAttrs} data-empty="">
        <Row>
          {tagEl}
          <span />
          <Main aria-hidden="true">—</Main>
          <Sr>не заполнено</Sr>
        </Row>
        {pen}
      </Cell>
    )
  }

  // Правка в пустое остаётся раскрываемой строкой: «Было / Стало» и аудит доступны (preflight Task 6, п. 3)
  const view = empty ? { main: '', second: '', full: [] } : present(tag, value)
  return (
    <Cell {...cellAttrs} data-empty={empty ? '' : undefined} data-open={open ? '' : undefined}>
      <Toggle as="button" type="button" aria-expanded={open} aria-controls={panel} onClick={onToggle}>
        {tagEl}
        <Opt data-k-tip={value?.opt ? optionLabels?.[value.opt] : undefined}>{value?.opt ?? ''}</Opt>
        {empty
          ? <><Main aria-hidden="true">—</Main><Sr>не заполнено</Sr></>
          : <Main>{view.main}</Main>}
        <Second>{view.second}</Second>
        <Eye aria-hidden="true"><EyeIcon /></Eye>
        {editedSr}
      </Toggle>
      {pen}
      <Panel id={panel} hidden={!open}>
        {wasNow || <Full>{fullText(value).join('\n')}</Full>}
        {edit?.audit}
        {editBtn}
      </Panel>
    </Cell>
  )
}
