import s from './Value.module.css'
export type CounterProps = { value: number; active?: boolean }
export function Counter({ value, active }: CounterProps) {
  return <span className={s.counter} data-zero={value === 0 || undefined} data-active={active || undefined}>{value}</span>
}
