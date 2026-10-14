import { CopyValue } from './CopyValue'

export type SwiftFieldProps = {
  /** Буква опции (A, F, K…); нет — не показывается. */
  opt?: string | undefined
  /** Главное значение: счёт или BIC; пусто — «—». */
  main: string
  /** Подпись ниже: наименование банка или стороны, прописными. */
  caption?: string | undefined
  /** Обрезка главного значения, px при плотности 1; полное — в тултипе. */
  maxWidth?: number | undefined
  tabIndex?: number | undefined
}

/** Ячейка SWIFT-поля (эталон fld()): буква опции, главное значение mono, подпись прописными (спека 5b §3). */
export function SwiftField({ opt, main, caption, maxWidth, tabIndex }: SwiftFieldProps) {
  if (!main) return <span className="k-none">—</span>
  return (
    <>
      <span className="k-field">
        {opt && <span className="k-opt">{opt}</span>}
        <CopyValue value={main} tone="ink" className="k-field-main" maxWidth={maxWidth} tabIndex={tabIndex} />
      </span>
      {caption && <div><CopyValue value={caption} tone="muted" className="k-caption" tabIndex={tabIndex} /></div>}
    </>
  )
}
