import s from './Value.module.css'
export type StatusTone = 'flow' | 'flowl' | 'flowd' | 'bad' | 'badd' | 'warn' | 'ok' | 'okl' | 'grey'
export type StatusDotProps = { tone: StatusTone; size?: 's' | 'm'; letter?: string; label?: string }

export function StatusDot({ tone, size = 'm', letter, label }: StatusDotProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const }
  return <span className={[s.dot, s[`dot${size.toUpperCase()}`]].join(' ')} data-tone={tone} {...a11y}>{letter}</span>
}
