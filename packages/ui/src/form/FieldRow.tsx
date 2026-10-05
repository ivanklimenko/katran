import { useEffect, useRef, type CSSProperties } from 'react'
import { IconButton } from '../button'
import { useStableId } from '../compat/useStableId'
import { defaultPresent, isEmptyValue, type FieldPresenter } from './present'
import type { FieldDef, FieldEdit, FieldValue } from './types'
import s from './Form.module.css'

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
}

const Eye = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></svg>
// значок карандаша эталона (#i-edit, index.html:518)
const Pen = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>

/**
 * Строка SWIFT-поля (спека 2a §3.1, эталон cell() и textHtml(), index.html:941, 1004): тег, буква опции, значение.
 * Пустое поле остаётся бледной строкой с прочерком — два документа рядом читаются построчно; доступный текст — «не заполнено».
 * Правка (спека 2c §2.1, эталон penHtml/.cell.edited, index.html:202–245, 980): карандаш — кнопка-сосед строки, не её потомок;
 * изменённое поле — data-edited и «Было / Стало» с аудитом в раскрытии; у текстового поля раскрытия может не быть (70: show = lines),
 * поэтому его «Было / Стало» и аудит — в панели под текстом, видимой, пока у поля есть правки (решение в4).
 */
export function FieldRow({ tag, def, value, present = defaultPresent, optionLabels, open = false, onToggle, wide, editable, editing = false, onEdit, edit }: FieldRowProps) {
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
  const tagEl = <><span className={s.tag} data-k-tip={tip}>{base}</span>{def && <span className={s.sr}>{def.label}</span>}</>
  const editedSr = changed && <span className={s.sr}>изменено: {edit.tip}</span>
  const pen = editable && (
    <IconButton ref={penRef} size="s" className={s.pen} label={`Редактировать поле ${tag}`} data-k-tip="Редактировать" onClick={onEdit}>
      <Pen />
    </IconButton>
  )
  const cellAttrs = {
    ref: cellRef,
    'data-field': tag,
    'data-edited': changed ? '' : undefined,
    'data-editing': editing ? '' : undefined,
    'data-k-tip': changed ? edit.tip : undefined,
  }
  const fullText = (v: FieldValue | null) => (v === null || isEmptyValue(v) ? ['—'] : present(tag, v).full)
  // раскрытие поля сетки и панель текстового поля: «Было / Стало» (если changed), аудит, «✎ Изменить»
  const wasNow = changed && <div className={s.full}>{['Было:', ...fullText(edit.was), 'Стало:', ...fullText(value)].join('\n')}</div>
  const editBtn = editable && (
    <button type="button" className={s.ed} aria-label={`Изменить поле ${tag}`} onClick={onEdit}>
      <span aria-hidden="true">✎</span> Изменить
    </button>
  )

  if (def?.kind === 'text') {
    const lines = value?.lines ?? []
    const show = Math.min(def.show ?? def.lines ?? 4, def.lines ?? 4)
    const more = lines.length - show
    const moreText = open ? 'свернуть' : `ещё ${more} стр.`
    const cls = [s.cell, s.text, empty ? s.null : '', wide ? s.wide : '', editable ? s.textPen : ''].filter(Boolean).join(' ')
    return (
      <div className={cls} {...cellAttrs} data-empty={empty ? '' : undefined} style={{ '--k-show': String(show) } as CSSProperties}>
        {tagEl}
        {editedSr}
        <div className={s.body}>
          {empty
            ? <><span className={s.pre} aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></>
            : <pre id={panel} className={s.pre}>{(open ? lines : lines.slice(0, show)).join('\n')}</pre>}
          {more > 0 && (
            <button type="button" className={s.more} aria-expanded={open} aria-controls={panel} aria-label={`${moreText} — ${tip}`} onClick={onToggle}>
              {moreText}
            </button>
          )}
          {edit && <div className={s.textEdit}>{wasNow}{edit.audit}{editBtn}</div>}
        </div>
        {pen}
      </div>
    )
  }

  if (empty && !edit) {
    return (
      <div className={[s.cell, s.null, editable ? s.editable : ''].filter(Boolean).join(' ')} {...cellAttrs} data-empty="">
        <div className={s.row}>
          {tagEl}
          <span />
          <span className={s.main} aria-hidden="true">—</span>
          <span className={s.sr}>не заполнено</span>
        </div>
        {pen}
      </div>
    )
  }

  // Правка в пустое остаётся раскрываемой строкой: «Было / Стало» и аудит доступны (preflight Task 6, п. 3)
  const view = empty ? { main: '', second: '', full: [] } : present(tag, value)
  return (
    <div className={[s.cell, open ? s.open : '', editable ? s.editable : ''].filter(Boolean).join(' ')} {...cellAttrs}>
      <button type="button" className={[s.row, s.toggle].join(' ')} aria-expanded={open} aria-controls={panel} onClick={onToggle}>
        {tagEl}
        <span className={s.opt} data-k-tip={value?.opt ? optionLabels?.[value.opt] : undefined}>{value?.opt ?? ''}</span>
        {empty
          ? <><span className={s.main} aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></>
          : <span className={s.main}>{view.main}</span>}
        <span className={s.second}>{view.second}</span>
        <span className={s.eye} aria-hidden="true"><Eye /></span>
        {editedSr}
      </button>
      {pen}
      <div id={panel} className={s.panel} hidden={!open}>
        {wasNow || <div className={s.full}>{fullText(value).join('\n')}</div>}
        {edit?.audit}
        {editBtn}
      </div>
    </div>
  )
}
