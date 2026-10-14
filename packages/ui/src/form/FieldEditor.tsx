import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Button } from '../button'
import { useStableId } from '../compat/useStableId'
import { styled } from '../styled'
import type { FieldValue } from './types'
import { k } from '@katran/tokens'

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
  /**
   * Какие поля виноваты в ошибке: lines — индексы строк с 0, acc — поле «Счёт». Подсвечиваются (aria-invalid) только они, описание
   * ошибкой — у всех полей. Не задано — при ошибке подсвечены все поля (прежнее поведение). Без error не действует.
   */
  invalid?: { lines: number[]; acc: boolean } | undefined
  /** Подвал слева: «4 строк по 35 символов, набор SWIFT X, счёт до 34». */
  rule: string
  /** Сохранение идёт: кнопки подвала недоступны, ввод сохраняется. */
  busy?: boolean | undefined
  saveError?: string | null | undefined
  onCancel: () => void
  onSave: () => void
  className?: string | undefined
}

/* редактор поля FieldEditor (эталон .fe/.box/.opts/.btn, index.html:202–211, 427–443):
   рамка val, радиус 5, отступы 7 / 9 / 8, фон sunk; блоки, чья высота сверяется с эталоном, — border-box */
const Fe = styled.section`
  box-sizing: border-box;
  border: 1px solid ${k.val};
  border-radius: calc(${k.rS} * 1.25);
  padding: ${k.fePt} ${k.fePx} ${k.fePb};
  background: ${k.sunk};
`

/* заголовок 600 11, отступ снизу 5 */
const FeTitle = styled.h4`
  margin: 0 0 calc(${k.sp1} * 1.25);
  font: 600 ${k.fs2} ${k.sans};
  color: ${k.ink2};
`

/* «Как есть» | «Редактирование»: две равные колонки, зазор 10 */
const FeTwo = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: ${k.feGap};
`

/* коробка колонки: 5 / 7, радиус 4; «Как есть» — без фона */
const FeBox = styled.div`
  box-sizing: border-box;
  min-width: 0;
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
  padding: ${k.feBoxPy} ${k.feBoxPx};
  background: ${k.paper};

  &[data-ro] {
    background: none;
  }
`

/* подпись колонки и счётчик: 500 10.5, отступ снизу 3 */
const FeCap = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: calc(${k.sp1} * 0.75);
  font: 500 ${k.fs3} ${k.sans};
  color: ${k.muted};

  & [data-bad] {
    font-weight: 600;
    color: ${k.bad};
  }
`

/* опции: зазор 2, отступ снизу 4; кнопка и чип 18 × 22+, моно 600 10.5, радиус 3 */
const FeOpts = styled.div`
  display: flex;
  gap: calc(${k.sp1} / 2);
  margin-bottom: ${k.sp1};
`

/** Буква опции: чип «Как есть» (span) и кнопка «Редактирование» (as="button"). */
const FeOpt = styled.span`
  box-sizing: border-box;
  display: inline-grid;
  place-items: center;
  min-width: ${k.optMin};
  height: ${k.optBtn};
  padding: 0 ${k.sp1};
  border: 1px solid ${k.line};
  border-radius: calc(${k.rS} * 0.75);
  background: ${k.paper};
  font: 600 ${k.fs3} / 1 ${k.mono};
  color: ${k.muted};

  button& {
    cursor: pointer;
  }

  button&:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 0;
  }

  &[aria-pressed='true'],
  &[data-on] {
    border-color: transparent;
    background: ${k.optSoft};
    color: ${k.opt};
  }
`

const FeLbl = styled.div`
  font-size: ${k.fs2};
  color: ${k.muted};
`

/* поле строки: 21, моно 12, отступ 2, рамка только снизу; фокус — val и hover; ошибка — bad */
const FeInput = styled.input`
  box-sizing: border-box;
  display: block;
  width: 100%;
  height: ${k.feLine};
  padding: calc(${k.sp1} / 2);
  border: 0;
  border-bottom: 1px solid ${k.line2};
  border-radius: 0;
  background: ${k.paper};
  font: ${k.fsEdit} ${k.mono};
  letter-spacing: -0.01em;
  color: ${k.ink};

  &:focus {
    outline: none;
    border-bottom-color: ${k.val};
    background: ${k.hover};
  }

  &[aria-invalid='true'] {
    border-bottom-color: ${k.bad};
    background: ${k.badSoft};
  }
`

/* «Как есть»: строки 21 (блок из 4 — 84), моно 12, muted */
const FePre = styled.pre`
  margin: 0;
  overflow: hidden;
  font: ${k.fsEdit} / ${k.feLine} ${k.mono};
  white-space: pre;
  color: ${k.muted};
`

/* строка ошибки: 11 / 1.3, min-height 14, отступ сверху 4 */
const FeErr = styled.div`
  min-height: ${k.lh2};
  margin-top: ${k.sp1};
  font: ${k.fs2} / 1.3 ${k.sans};
  color: ${k.bad};
`

/* подвал: правило слева, кнопки справа; отступ сверху 7, зазор 8 */
const FeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${k.sp2};
  margin-top: ${k.fePt};
`

const FeRule = styled.span`
  margin-right: auto;
  font-size: ${k.fs2};
  color: ${k.muted};
`

/* только для скринридера (как Sr «Общих данных»): исходная опция «Как есть» */
const FeSr = styled.span`
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
`

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
  tag, name, original, value, onChange, lines: n, width: w, opts, account, error, invalid, rule, busy, saveError, onCancel, onSave, className,
}: FieldEditorProps) {
  const errId = useStableId()
  const first = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLElement>(null)
  const max = n * w
  const draft = padTo(value.lines, n)
  const was = padTo(original.lines, n)
  const live = total(value.lines)
  const message = error ?? saveError ?? ''
  // ошибка — описание у всех полей; подсветка — у виноватых (invalid) или у всех
  const bad = (which: { line: number } | 'acc') => {
    if (error === null) return {}
    const own = invalid === undefined || (which === 'acc' ? invalid.acc : invalid.lines.includes(which.line))
    return own ? { 'aria-invalid': true, 'aria-describedby': errId } : { 'aria-describedby': errId }
  }
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
    <Fe ref={root} className={className} data-k-edit="" aria-label={title}>
      {/* Esc — на обёртке (role="presentation", как подложка Prompt): всплывает с полей и кнопок редактора */}
      <div role="presentation" onKeyDown={onKeyDown}>
        <FeTitle>{title}</FeTitle>
        <FeTwo>
          <FeBox data-ro="">
            <FeCap><span>Как есть</span><span>{total(original.lines)}/{max}</span></FeCap>
            {opts && (
              <FeOpts>
                {/* исходная выделена цветом — для скринридера она названа текстом, чипы скрыты */}
                <FeSr>{optName(original.opt ?? '')}</FeSr>
                {opts.map((o) => (
                  <FeOpt key={o} aria-hidden="true" data-on={o === (original.opt ?? '') ? '' : undefined}>{optLabel(o)}</FeOpt>
                ))}
              </FeOpts>
            )}
            {account && (
              <>
                <FeLbl>Счёт / IBAN</FeLbl>
                <FePre>{original.acc || '—'}</FePre>
                <FeLbl>Наименование / адрес</FeLbl>
              </>
            )}
            <FePre>{was.map((l) => l || ' ').join('\n')}</FePre>
          </FeBox>
          <FeBox>
            <FeCap><span>Редактирование</span><span data-bad={live > max ? '' : undefined}>{live}/{max}</span></FeCap>
            {opts && (
              <FeOpts>
                {opts.map((o) => (
                  <FeOpt
                    as="button"
                    key={o}
                    type="button"
                    aria-label={optName(o)}
                    aria-pressed={o === (value.opt ?? '')}
                    onClick={() => onChange({ ...value, opt: o })}
                  >
                    {optLabel(o)}
                  </FeOpt>
                ))}
              </FeOpts>
            )}
            {account && (
              <>
                <FeLbl>Счёт / IBAN</FeLbl>
                <FeInput
                  ref={first}
                  aria-label="Счёт"
                  value={value.acc ?? ''}
                  onChange={(e) => onChange({ ...value, acc: e.target.value })}
                  {...bad('acc')}
                />
                <FeLbl>Наименование / адрес</FeLbl>
              </>
            )}
            {draft.map((l, k) => (
              <FeInput
                key={k}
                ref={k === 0 && !account ? first : undefined}
                aria-label={`Строка ${k + 1}`}
                placeholder={`Строка ${k + 1} до ${w} символов`}
                value={l}
                onChange={(e) => setLine(k, e.target.value)}
                {...bad({ line: k })}
              />
            ))}
            <FeErr id={errId} aria-live="polite">{message}</FeErr>
          </FeBox>
        </FeTwo>
        <FeRow>
          <FeRule>{rule}</FeRule>
          <Button size="s" disabled={busy} onClick={onCancel}>Отмена</Button>
          <Button size="s" variant="primary" disabled={error !== null || busy} onClick={onSave}>Сохранить</Button>
        </FeRow>
      </div>
    </Fe>
  )
}
