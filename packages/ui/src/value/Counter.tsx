import s from './Value.module.css'
export type CounterProps = {
  value: number
  active?: boolean | undefined
  /**
   * `accent` — счётчик на primary-кнопке (фон val): текст paper, рамка paper, фон прозрачный;
   * ноль остаётся читаемым (не faint). Эталон — бейдж кнопки «Фильтры» (финал 5b, I3).
   */
  tone?: 'accent' | undefined
}
export function Counter({ value, active, tone }: CounterProps) {
  return <span className={s.counter} data-zero={value === 0 || undefined} data-active={active || undefined} data-tone={tone}>{value}</span>
}
