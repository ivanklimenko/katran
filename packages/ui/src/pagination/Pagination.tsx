import { Button, IconButton } from '../button'
import { Select } from '../input'
import s from './Pagination.module.css'

export type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  pageSizes?: number[] | undefined
  onPageSize?: ((n: number) => void) | undefined
}

/** Окно номеров: первая, последняя, текущая ±1; пропуски только если скрыто ≥ 2 страниц. */
export function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1]
    if (prev !== undefined) {
      if (p - prev === 2) out.push(prev + 1)
      else if (p - prev > 2) out.push('…')
    }
    out.push(p)
  })
  return out
}

export function Pagination({ page, pageSize, total, onPage, pageSizes, onPageSize }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const range = total === 0 ? '0 из 0' : `${from}–${to} из ${total}`
  return (
    <nav aria-label="Страницы" className={s.nav}>
      <span className={s.range}>{range}</span>
      <span className={s.pages}>
        <IconButton size="s" className={s.navBtn} label="Назад" disabled={page <= 1 || total === 0} onClick={() => onPage(page - 1)}>‹</IconButton>
        {total > 0 && pageWindow(page, pages).map((p, i) =>
          p === '…'
            ? <span key={`gap${i}`} className={s.gap} aria-hidden="true">…</span>
            : <Button key={p} size="s" className={s.pageBtn} aria-current={p === page ? 'page' : undefined} aria-label={`Страница ${p}`} onClick={() => onPage(p)}>{p}</Button>,
        )}
        <IconButton size="s" className={s.navBtn} label="Вперёд" disabled={page >= pages || total === 0} onClick={() => onPage(page + 1)}>›</IconButton>
      </span>
      {!!pageSizes?.length && onPageSize && (
        <span className={s.pageSize}>
          <span className={s.pageSizeLbl}>На странице</span>
          <Select size="s" aria-label="На странице" value={String(pageSize)} onChange={(e) => onPageSize(Number(e.target.value))}
            options={pageSizes.map((n) => ({ value: String(n), label: String(n) }))} />
        </span>
      )}
    </nav>
  )
}
