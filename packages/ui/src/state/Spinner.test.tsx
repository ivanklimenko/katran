import { screen } from '@testing-library/react'
import { Spinner } from '../index'
import { renderK } from '../test/renderK'

describe('Spinner', () => {
  it('имеет имя по умолчанию, средний размер и декоративный круг', () => {
    renderK(<Spinner />)
    const status = screen.getByRole('status', { name: 'Загрузка' })
    expect(status).toHaveAttribute('data-size', 'm')
    expect(status.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it.each(['s', 'm', 'l'] as const)('поддерживает имя, className и размер %s в блоке', (size) => {
    renderK(<Spinner label="Загрузка реестра" className="consumer" size={size} block />)
    const status = screen.getByRole('status', { name: 'Загрузка реестра' })
    expect(status).toHaveClass('consumer')
    expect(status).toHaveAttribute('data-size', size)
    expect(status).toHaveAttribute('data-block')
  })
})
