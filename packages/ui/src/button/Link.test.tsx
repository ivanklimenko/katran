import { createRef } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { Link } from '../index'
import { renderK } from '../test/renderK'

describe('Link', () => {
  it('передаёт нативные атрибуты, className, обработчик и ref в a', () => {
    const ref = createRef<HTMLAnchorElement>()
    const onClick = vi.fn()
    renderK(
      <Link ref={ref} href="#document" target="_self" download="document.txt" className="extra" onClick={onClick}>
        Документ
      </Link>,
    )
    const link = screen.getByRole('link', { name: 'Документ' })

    expect(link.tagName).toBe('A')
    expect(ref.current).toBe(link)
    expect(link).toHaveAttribute('href', '#document')
    expect(link).toHaveAttribute('target', '_self')
    expect(link).toHaveAttribute('download', 'document.txt')
    expect(link).not.toHaveAttribute('rel')
    expect(link).toHaveClass('extra')
    fireEvent.click(link, { ctrlKey: true })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['_blank', undefined, 'noopener noreferrer'],
    ['_BLANK', 'nofollow NOOPENER', 'nofollow NOOPENER noreferrer'],
    ['_blank', 'noreferrer external', 'noreferrer external noopener'],
    ['_blank', 'external NoReferrer NoOpener', 'external NoReferrer NoOpener'],
    ['_self', 'nofollow', 'nofollow'],
    ['reports', undefined, null],
    ['_blanK', undefined, null],
    ['_blank\n', undefined, null],
    ['_blank', 'noopener\u00a0external', 'noopener\u00a0external noopener noreferrer'],
  ])('для target=%s и rel=%s сохраняет ожидаемые отношения', (target, rel, expected) => {
    renderK(<Link href="/document" target={target} rel={rel}>Документ</Link>)

    expect(screen.getByRole('link').getAttribute('rel')).toBe(expected)
  })
})
