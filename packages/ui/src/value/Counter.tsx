export type CounterProps = {
  value: number
  active?: boolean | undefined
  /**
   * `accent` — счётчик на primary-кнопке (фон val): текст paper, рамка paper, фон прозрачный;
   * ноль остаётся читаемым (не faint). Эталон — бейдж кнопки «Фильтры» (финал 5b, I3).
   */
  tone?: 'accent' | undefined
  /** Класс потребителя на корне (styled(X)). */
  className?: string | undefined
}
export function Counter({ value, active, tone, className }: CounterProps) {
  return <span className={className ? `k-counter ${className}` : 'k-counter'} data-zero={value === 0 || undefined} data-active={active || undefined} data-tone={tone}>{value}</span>
}
