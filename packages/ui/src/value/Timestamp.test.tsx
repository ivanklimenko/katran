import { screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Timestamp } from './Timestamp'

describe('Timestamp', () => {
  it('дата, время и доли секунды раздельно; полная форма — тултипом; машинное значение — в dateTime', () => {
    const { container } = renderK(<Timestamp iso="2026-09-22T07:31:45.241" />)
    const t = container.querySelector('time')!
    expect(t).toHaveTextContent('22.09 07:31:45.241')
    expect(t).toHaveAttribute('datetime', '2026-09-22T07:31:45.241')
    expect(t).toHaveAttribute('data-k-tip', '22.09.2026 07:31:45.241')
    expect(screen.getByText('07:31:45').tagName).toBe('B')
    expect(screen.getByText('.241')).toBeInTheDocument()
  })
  it('без долей секунды — хвоста нет', () => {
    const { container } = renderK(<Timestamp iso="2026-09-22T07:31:59" />)
    expect(container.querySelector('time')).toHaveTextContent(/^22\.09 07:31:59$/)
    expect(container.querySelector('time')).toHaveAttribute('data-k-tip', '22.09.2026 07:31:59')
  })
  it('не дата-время — текст как есть, без тултипа; пусто — «—»', () => {
    const { container, rerender } = renderK(<Timestamp iso="22.09.2026 07:31:51" />)
    expect(container.querySelector('time')).toBeNull()
    expect(screen.getByText('22.09.2026 07:31:51')).not.toHaveAttribute('data-k-tip')
    rerender(<Timestamp iso="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<><Timestamp iso="2026-09-22T07:31:45.241" /><Timestamp iso="нет" /></>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
