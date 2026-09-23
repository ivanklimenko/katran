import s from './Value.module.css'
export type FieldTagProps = { tag: string; title?: string }
/** Номер SWIFT-поля. Операторы знают номера — заголовка нет, объяснение в подсказке. */
export function FieldTag({ tag, title }: FieldTagProps) {
  return <span className={s.ftag} data-k-tip={title}>{tag}</span>
}
