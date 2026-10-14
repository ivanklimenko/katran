export type FieldTagProps = { tag: string; title?: string | undefined; className?: string | undefined }
/** Номер SWIFT-поля. Операторы знают номера — заголовка нет, объяснение в подсказке. */
export function FieldTag({ tag, title, className }: FieldTagProps) {
  return <span className={className ? `k-ftag ${className}` : 'k-ftag'} data-k-tip={title}>{tag}</span>
}
