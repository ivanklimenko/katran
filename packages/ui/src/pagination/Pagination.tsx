import { k } from '@katran/tokens'
import { Button, IconButton } from '../button'
import { Select } from '../input'
import { styled } from '../styled'

export type PaginationProps = {
  page: number
  pageSize: number
  total: number
  onPage: (page: number) => void
  pageSizes?: number[] | undefined
  onPageSize?: ((n: number) => void) | undefined
  className?: string | undefined
}

/* Полоса подвала (W4): h-ctl-s + sp-3 = 36 — ближайшая сумма токенов к эталонным 37, допуск ± 2
   (border-box считает padding и рамку внутрь min-height, иначе сумма превысила бы 37 на паддинги). */
const Nav = styled.nav`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  column-gap: ${k.sp3};
  box-sizing: border-box;
  min-height: calc(${k.hCtlS} + ${k.sp3});
  padding: 0 ${k.sp5};
  background: ${k.sunk};
  border-top: 1px solid ${k.line};
  font-size: ${k.fs2};
  color: ${k.muted};
`

/* мелкий текст на полосе sunk — ink2 (финал 5b, I2) */
const Range = styled.span`
  justify-self: start;
  white-space: nowrap;
  color: ${k.ink2};
`

const Pages = styled.span`
  display: flex;
  justify-self: center;
  align-items: center;
  gap: ${k.sp1};
`

const Gap = styled.span`
  padding: 0 ${k.sp1};
  color: ${k.faint};
`

/* Кнопки номеров и стрелок — переопределения кнопки кита через styled(Button) и styled(IconButton): правила вложены
   под Pages (Pages Номер — (0,2,0) и выше, как прежде .pages .pageBtn), а группа обёртки стоит в листе после группы
   кнопки и при равной специфичности перебивает её (текущая страница при наведении — (0,3,0) против наведения
   ghost-кнопки (0,3,0)). Номера — компактные, ближе всего к эталонным 22 даёт токен h-field (23).
   На стенде (.appf .pg button) кнопки в покое без рамки и фона, фон только при наведении; неактивная — приглушённый текст. */
const PageBtn = styled(Button)`
  ${Pages} & {
    min-width: ${k.hField};
    height: ${k.hField};
    padding: 0;
    justify-content: center;
    border-color: transparent;
    background: none;
  }

  ${Pages} &:disabled {
    color: ${k.faint};
  }

  /* текущая страница — фон val, текст paper (контраст paper/val уже в contrast.rules.ts) */
  ${Pages} &[aria-current='page'] {
    background: ${k.val};
    border-color: ${k.val};
    color: ${k.paper};
  }

  /* hover — фон hover, как в эталоне (:not не даёт погасить подсветку текущей страницы под курсором) */
  ${Pages} &:not([aria-current='page']):hover {
    border-color: transparent;
    background: ${k.hover};
    color: ${k.ink2};
  }
`

const NavBtn = styled(IconButton)`
  ${Pages} & {
    width: ${k.hField};
    height: ${k.hField};
    font-size: ${k.fs1};
    border-color: transparent;
    background: none;
  }

  ${Pages} &:disabled {
    color: ${k.faint};
  }

  ${Pages} &:hover:not(:disabled) {
    border-color: transparent;
    background: ${k.hover};
    color: ${k.ink2};
  }
`

const PageSize = styled.span`
  display: flex;
  justify-self: end;
  align-items: center;
  gap: ${k.sp1};
  white-space: nowrap;
`

const PageSizeLbl = styled.span`
  white-space: nowrap;
`

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

export function Pagination({ page, pageSize, total, onPage, pageSizes, onPageSize, className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const range = total === 0 ? '0 из 0' : `${from}–${to} из ${total}`
  return (
    <Nav aria-label="Страницы" className={className}>
      <Range>{range}</Range>
      <Pages>
        <NavBtn size="s" label="Назад" disabled={page <= 1 || total === 0} onClick={() => onPage(page - 1)}>‹</NavBtn>
        {total > 0 && pageWindow(page, pages).map((p, i) =>
          p === '…'
            ? <Gap key={`gap${i}`} aria-hidden="true">…</Gap>
            : <PageBtn key={p} size="s" aria-current={p === page ? 'page' : undefined} aria-label={`Страница ${p}`} onClick={() => onPage(p)}>{p}</PageBtn>,
        )}
        <NavBtn size="s" label="Вперёд" disabled={page >= pages || total === 0} onClick={() => onPage(page + 1)}>›</NavBtn>
      </Pages>
      {!!pageSizes?.length && onPageSize && (
        <PageSize>
          <PageSizeLbl>На странице</PageSizeLbl>
          <Select size="s" aria-label="На странице" value={String(pageSize)} onChange={(e) => onPageSize(Number(e.target.value))}
            options={pageSizes.map((n) => ({ value: String(n), label: String(n) }))} />
        </PageSize>
      )}
    </Nav>
  )
}
