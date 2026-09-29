import s from './Value.module.css'
export type StatusTone = 'flow' | 'flowl' | 'flowd' | 'bad' | 'badd' | 'warn' | 'ok' | 'okl' | 'grey'
export type StatusDotProps = {
  tone: StatusTone
  size?: 's' | 'm' | 'l' | undefined
  /**
   * Буква в точке; допустима на всех тонах. На flow/flowd/bad/badd/warn/ok — цвет `paper`,
   * на flowl/okl/grey — `st-letter-soft` (контраст ≥ 4.5 в обеих темах).
   */
  letter?: string | undefined
  /** Подпись для скринридера и тултип (статус не только цветом). */
  label?: string | undefined
}

/**
 * Тон — атрибутом `data-st`, не общим `data-tone` (его носят Tag и Counter): грид обесцвечивает в
 * заблокированной/неактивной записи только точки `[data-st]`, теги остаются читаемыми (финал 5b, I1).
 */
export function StatusDot({ tone, size = 'm', letter, label }: StatusDotProps) {
  const a11y = label ? { role: 'img', 'aria-label': label, 'data-k-tip': label } : { 'aria-hidden': true as const }
  return <span className={[s.dot, s[`dot${size.toUpperCase()}`]].filter(Boolean).join(' ')} data-st={tone} {...a11y}>{letter}</span>
}
