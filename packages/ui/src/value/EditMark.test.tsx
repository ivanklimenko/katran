import { screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { EditMark } from './EditMark'

const TIP = 'Было X · Вы, 22.09.2026 10:42'

describe('EditMark', () => {
  it('без status — одна точка, имя и тултип — tip', () => {
    renderK(<EditMark tip={TIP} />)
    const m = screen.getByRole('img', { name: TIP })
    expect(m).toHaveAttribute('data-k-tip', TIP)
    expect(m).not.toHaveAttribute('data-status')
    expect(m).not.toHaveTextContent('✓')
    expect(m.children).toHaveLength(1)
  })
  it('pending — галочка скрыта, confirmed — видна', () => {
    const { rerender } = renderK(<EditMark tip={TIP} status="pending" />)
    const m = screen.getByRole('img', { name: TIP })
    expect(m).toHaveAttribute('data-status', 'pending')
    expect(m).toHaveTextContent('✓')
    rerender(<EditMark tip={TIP} status="confirmed" />)
    expect(screen.getByRole('img', { name: TIP })).toHaveAttribute('data-status', 'confirmed')
    expect(screen.getByRole('img', { name: TIP })).toHaveTextContent('✓')
  })
  it('rejected — data-status="rejected"', () => {
    renderK(<EditMark tip="Правка отклонена · Смирнова Е. В., 23.09.2026 10:00" status="rejected" />)
    expect(screen.getByRole('img', { name: 'Правка отклонена · Смирнова Е. В., 23.09.2026 10:00' })).toHaveAttribute('data-status', 'rejected')
  })
  it('axe без нарушений', async () => {
    const { container } = renderK(<p>Дата <EditMark tip={TIP} /> <EditMark tip="Утверждено" status="confirmed" /></p>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
