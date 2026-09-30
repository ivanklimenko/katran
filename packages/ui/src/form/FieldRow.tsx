import type { CSSProperties } from 'react'
import { useStableId } from '../compat/useStableId'
import { defaultPresent, isEmptyValue, type FieldPresenter } from './present'
import type { FieldDef, FieldValue } from './types'
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
}

const Eye = () => <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8 12.1 12.5 8 12.5 1.5 8 1.5 8z" /><circle cx="8" cy="8" r="2" /></svg>

/**
 * Строка SWIFT-поля (спека 2a §3.1, эталон cell() и textHtml(), index.html:941, 1004): тег, буква опции, значение.
 * Пустое поле остаётся бледной строкой с прочерком — два документа рядом читаются построчно; доступный текст — «не заполнено».
 */
export function FieldRow({ tag, def, value, present = defaultPresent, optionLabels, open = false, onToggle, wide }: FieldRowProps) {
  const panel = useStableId()
  const base = tag.replace(/^B\./, '')
  const tip = def ? `${base} · ${def.label}` : base
  const empty = value === null || isEmptyValue(value)
  // Название поля — не только тултипом (его не видят клавиатура и скринридер): скрытым текстом рядом с тегом.
  // Сосед, а не потомок тега: абсолютно позиционированный, он не занимает ячейку сетки строки и не меняет текст тега.
  const tagEl = <><span className={s.tag} data-k-tip={tip}>{base}</span>{def && <span className={s.sr}>{def.label}</span>}</>

  if (def?.kind === 'text') {
    const lines = value?.lines ?? []
    const show = Math.min(def.show ?? def.lines ?? 4, def.lines ?? 4)
    const more = lines.length - show
    const moreText = open ? 'свернуть' : `ещё ${more} стр.`
    return (
      <div className={[s.cell, s.text, empty ? s.null : '', wide ? s.wide : ''].filter(Boolean).join(' ')} data-field={tag} data-empty={empty ? '' : undefined} style={{ '--k-show': String(show) } as CSSProperties}>
        {tagEl}
        <div className={s.body}>
          {empty
            ? <><span className={s.pre} aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></>
            : <pre id={panel} className={s.pre}>{(open ? lines : lines.slice(0, show)).join('\n')}</pre>}
          {more > 0 && (
            <button type="button" className={s.more} aria-expanded={open} aria-controls={panel} aria-label={`${moreText} — ${tip}`} onClick={onToggle}>
              {moreText}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (value === null || empty) {
    return (
      <div className={[s.cell, s.null].join(' ')} data-field={tag} data-empty="">
        <div className={s.row}>
          {tagEl}
          <span />
          <span className={s.main} aria-hidden="true">—</span>
          <span className={s.sr}>не заполнено</span>
        </div>
      </div>
    )
  }

  const view = present(tag, value)
  return (
    <div className={[s.cell, open ? s.open : ''].filter(Boolean).join(' ')} data-field={tag}>
      <button type="button" className={[s.row, s.toggle].join(' ')} aria-expanded={open} aria-controls={panel} onClick={onToggle}>
        {tagEl}
        <span className={s.opt} data-k-tip={value.opt ? optionLabels?.[value.opt] : undefined}>{value.opt ?? ''}</span>
        <span className={s.main}>{view.main}</span>
        <span className={s.second}>{view.second}</span>
        <span className={s.eye} aria-hidden="true"><Eye /></span>
      </button>
      <div id={panel} className={s.full} hidden={!open}>{view.full.join('\n')}</div>
    </div>
  )
}
