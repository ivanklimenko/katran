import { screen, within } from '@testing-library/react'
import { Breadcrumbs, type BreadcrumbItem } from '../index'
import { renderK } from '../test/renderK'

describe('Breadcrumbs', () => {
  it('не выводит навигацию при пустом списке', () => {
    renderK(<Breadcrumbs items={[]} />)

    expect(screen.queryByRole('navigation', { name: 'Навигационная цепочка' })).not.toBeInTheDocument()
  })

  it('рендерит упорядоченный список и помечает последний текстовый пункт', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Главная', href: '/' },
      { label: 'Реестры', href: '/registries' },
      { label: 'Платежи' },
    ]
    renderK(<Breadcrumbs items={items} className="extra" />)
    const nav = screen.getByRole('navigation', { name: 'Навигационная цепочка' })
    const list = within(nav).getByRole('list')

    expect(nav.tagName).toBe('NAV')
    expect(nav).toHaveClass('extra')
    expect(list.tagName).toBe('OL')
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(nav).getByRole('link', { name: 'Главная', exact: true })).toHaveAttribute('href', '/')
    expect(within(nav).getByText('Платежи')).toHaveAttribute('aria-current', 'page')
    const separators = within(nav).getAllByText('/', { exact: true })
    expect(separators).toHaveLength(2)
    for (const separator of separators) {
      expect(separator).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('сохраняет ссылку последнего пункта и ставит aria-current на неё', () => {
    renderK(<Breadcrumbs items={[
      { label: 'Реестры', href: '/registries' },
      { label: 'Входящие' },
      { label: 'Платежи', href: '/payments' },
    ]} />)

    expect(screen.getByRole('link', { name: 'Реестры' })).not.toHaveAttribute('aria-current')
    expect(screen.queryByRole('link', { name: 'Входящие' })).not.toBeInTheDocument()
    const current = screen.getByRole('link', { name: 'Платежи', exact: true })
    expect(current).toHaveAttribute('href', '/payments')
    expect(current).toHaveAttribute('aria-current', 'page')
  })

  it('рендерит единственный пункт без разделителя и сохраняет явно переданный href', () => {
    renderK(<Breadcrumbs items={[{ label: 'Текущая страница', href: '' }]} />)

    const current = screen.getByRole('link', { name: 'Текущая страница' })
    expect(current).toHaveAttribute('href', '')
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByText('/', { exact: true })).not.toBeInTheDocument()
  })
})
