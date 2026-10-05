import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Button } from '../button'
import { useStableId } from '../compat/useStableId'
import type { FieldValue } from './types'
import s from './Edit.module.css'

export type FieldEditorProps = {
  /** Заголовок «Поле {tag без B.} · {name} — правка». */
  tag: string
  name: string
  /** «Как есть» — исходное значение с бека. */
  original: FieldValue
  /** Черновик. Строк меньше lines — поля дополняются ''; больше — не обрезаются (все поля видны): держать ≤ lines — дело модели. */
  value: FieldValue
  onChange: (next: FieldValue) => void
  /** Строк в поле и знаков в строке. */
  lines: number
  width: number
  /** Буквы опции; '' — «без буквы» (подпись «—»). */
  opts?: string[] | undefined
  /** Сторона: поле «Счёт / IBAN». */
  account?: boolean | undefined
  /** Первая ошибка проверки черновика; не null — «Сохранить» недоступна. */
  error: string | null
  /** Подвал слева: «4 строк по 35 символов, набор SWIFT X, счёт до 34». */
  rule: string
  /** Сохранение идёт: кнопки подвала недоступны, ввод сохраняется. */
  busy?: boolean | undefined
  saveError?: string | null | undefined
  onCancel: () => void
  onSave: () => void
}

const optName = (o: string) => (o ? `Опция ${o}` : 'Без буквы')
const optLabel = (o: string) => o || '—'
const total = (lines: string[]) => lines.reduce((n, l) => n + l.length, 0)
const padTo = (lines: string[], n: number) => (lines.length >= n ? lines : lines.concat(new Array<string>(n - lines.length).fill('')))

/**
 * Редактор поля SWIFT (эталон editor(), index.html:981–994; спека 2c §2.1): «Как есть» | «Редактирование» — исходное только для
 * чтения и черновик (опции, счёт стороны, N строк), живой счётчик, строка ошибки, подвал с правилом, «Отмена» и «Сохранить».
 * Правил домена нет: проверку, нормализацию и пределы даёт вызывающий. Esc в любом месте редактора — «Отмена» (пока идёт
 * сохранение — гасится); корень помечен data-k-edit, чтобы DrawerStack не закрывал деталку тем же Esc. Enter ничего не сохраняет.
 */
export function FieldEditor({
  tag, name, original, value, onChange, lines: n, width: w, opts, account, error, rule, busy, saveError, onCancel, onSave,
}: FieldEditorProps) {
  const errId = useStableId()
  const first = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLElement>(null)
  const max = n * w
  const draft = padTo(value.lines, n)
  const was = padTo(original.lines, n)
  const live = total(value.lines)
  const message = error ?? saveError ?? ''
  const invalid = error !== null ? { 'aria-invalid': true, 'aria-describedby': errId } : {}
  const title = `Поле ${tag.replace(/^B\./, '')} · ${name} — правка`

  // фокус при открытии: «Счёт» у стороны, иначе «Строка 1» (эталон :1456)
  useEffect(() => { first.current?.focus() }, [])
  // сохранение началось с фокусом на кнопке редактора: кнопка станет disabled и фокус уйдёт в body — Esc пройдёт мимо
  // редактора и закроет деталку. Переводим фокус в первое поле (поля при busy доступны).
  useEffect(() => {
    const active = document.activeElement
    if (busy && active instanceof HTMLButtonElement && root.current?.contains(active)) first.current?.focus()
  }, [busy])

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return
    e.preventDefault()
    e.stopPropagation()
    if (!busy) onCancel()
  }
  const setLine = (k: number, text: string) => {
    const next = draft.slice()
    next[k] = text
    onChange({ ...value, lines: next })
  }

  return (
    <section ref={root} className={s.fe} data-k-edit="" aria-label={title}>
      {/* Esc — на обёртке (role="presentation", как подложка Prompt): всплывает с полей и кнопок редактора */}
      <div role="presentation" onKeyDown={onKeyDown}>
        <h6 className={s.feTitle}>{title}</h6>
        <div className={s.feTwo}>
          <div className={s.feBox} data-ro="">
            <div className={s.feCap}><span>Как есть</span><span>{total(original.lines)}/{max}</span></div>
            {opts && (
              <div className={s.feOpts}>
                {/* исходная выделена цветом — для скринридера она названа текстом, чипы скрыты */}
                <span className={s.feSr}>{optName(original.opt ?? '')}</span>
                {opts.map((o) => (
                  <span key={o} className={s.feOpt} aria-hidden="true" data-on={o === (original.opt ?? '') ? '' : undefined}>{optLabel(o)}</span>
                ))}
              </div>
            )}
            {account && (
              <>
                <div className={s.feLbl}>Счёт / IBAN</div>
                <pre className={s.fePre}>{original.acc || '—'}</pre>
                <div className={s.feLbl}>Наименование / адрес</div>
              </>
            )}
            <pre className={s.fePre}>{was.map((l) => l || ' ').join('\n')}</pre>
          </div>
          <div className={s.feBox}>
            <div className={s.feCap}><span>Редактирование</span><span data-bad={live > max ? '' : undefined}>{live}/{max}</span></div>
            {opts && (
              <div className={s.feOpts}>
                {opts.map((o) => (
                  <button
                    key={o}
                    type="button"
                    className={s.feOpt}
                    aria-label={optName(o)}
                    aria-pressed={o === (value.opt ?? '')}
                    onClick={() => onChange({ ...value, opt: o })}
                  >
                    {optLabel(o)}
                  </button>
                ))}
              </div>
            )}
            {account && (
              <>
                <div className={s.feLbl}>Счёт / IBAN</div>
                <input
                  ref={first}
                  className={s.feInput}
                  aria-label="Счёт"
                  value={value.acc ?? ''}
                  onChange={(e) => onChange({ ...value, acc: e.target.value })}
                  {...invalid}
                />
                <div className={s.feLbl}>Наименование / адрес</div>
              </>
            )}
            {draft.map((l, k) => (
              <input
                key={k}
                ref={k === 0 && !account ? first : undefined}
                className={s.feInput}
                aria-label={`Строка ${k + 1}`}
                placeholder={`Строка ${k + 1} до ${w} символов`}
                value={l}
                onChange={(e) => setLine(k, e.target.value)}
                {...invalid}
              />
            ))}
            <div id={errId} className={s.feErr} aria-live="polite">{message}</div>
          </div>
        </div>
        <div className={s.feRow}>
          <span className={s.feRule}>{rule}</span>
          <Button size="s" disabled={busy} onClick={onCancel}>Отмена</Button>
          <Button size="s" variant="primary" disabled={error !== null || busy} onClick={onSave}>Сохранить</Button>
        </div>
      </div>
    </section>
  )
}
