import s from './Value.module.css'
export type StatusTone = 'flow' | 'flowl' | 'flowd' | 'bad' | 'badd' | 'warn' | 'ok' | 'okl' | 'grey'
export type StatusDotProps = {
  tone: StatusTone
  size?: 's' | 'm' | undefined
  /**
   * Буква в точке; допустима на всех тонах. На flow/flowd/bad/badd/warn/ok — цвет `paper`,
   * на flowl/okl/grey — `st-letter-soft` (контраст ≥ 4.5 в обеих темах).
   */
  letter?: string | undefined
  label?: string | undefined
}

export function StatusDot({ tone, size = 'm', letter, label }: StatusDotProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return <span className={[s.dot, s[`dot${size.toUpperCase()}`]].filter(Boolean).join(' ')} data-tone={tone} {...a11y}>{letter}</span>
}
