import { k } from '@katran/tokens'
import { Link } from '../button/Link'
import { styled } from '../styled'

export type BreadcrumbItem = {
  label: string
  href?: string
}

export type BreadcrumbsProps = {
  items: BreadcrumbItem[]
  className?: string
}

const Root = styled.nav`
  color: ${k.ink2};
  font: 400 ${k.fs2} / ${k.lh2} ${k.sans};

  & > ol {
    display: flex;
    flex-wrap: wrap;
    gap: ${k.sp1};
    margin: 0;
    padding: 0;
    list-style: none;
  }

  & > ol > li {
    display: flex;
    align-items: baseline;
    gap: ${k.sp1};
    min-width: 0;
    overflow-wrap: anywhere;
  }

  & [aria-hidden='true'] {
    color: ${k.muted};
  }

  & [aria-current='page'] {
    color: ${k.ink};
  }
`

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <Root aria-label="Навигационная цепочка" className={className}>
      <ol>
        {items.map(({ label, href }, index) => {
          const current = index === items.length - 1 ? 'page' : undefined
          return (
            <li key={index}>
              {index > 0 && <span aria-hidden="true">/</span>}
              {href === undefined
                ? <span aria-current={current}>{label}</span>
                : <Link href={href} aria-current={current}>{label}</Link>}
            </li>
          )
        })}
      </ol>
    </Root>
  )
}
