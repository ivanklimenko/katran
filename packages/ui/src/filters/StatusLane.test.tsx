import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { StatusLane, type LaneItem } from './StatusLane'
import type { Scalar } from './types'

const items: LaneItem[] = [
  { value: 'IN_PROGRESS', label: 'В работе', tone: 'flow', count: 15 },
  { value: 'ERROR', label: 'Ошибка', tone: 'bad', count: 6 },
  { value: 'REJECTED', label: 'Отказ', tone: 'grey', count: 0 },
]
function Host({ initial = null }: { initial?: Scalar | null }) {
  const [v, setV] = useState<Scalar | null>(initial)
  return <StatusLane label="Статусы" items={items} value={v} onChange={setV} />
}

describe('StatusLane', () => {
  it('группа с именем, «Все» с суммой, aria-pressed у активной кнопки', async () => {
    const { container } = renderK(<Host />)
    const group = screen.getByRole('group', { name: 'Статусы' })
    const all = screen.getByRole('button', { name: /Все/ })
    expect(all).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveTextContent('21')
    expect(screen.getByRole('button', { name: /Ошибка/ })).toHaveAttribute('aria-pressed', 'false')
    expect(group.querySelectorAll('button')).toHaveLength(4)
    expect(await axe(container)).toHaveNoViolations()
  })
  it('клик выбирает статус, повторный клик и «Все» снимают', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.click(screen.getByRole('button', { name: /Ошибка/ }))
    expect(screen.getByRole('button', { name: /Ошибка/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Все/ })).toHaveAttribute('aria-pressed', 'false')
    await u.click(screen.getByRole('button', { name: /Ошибка/ }))
    expect(screen.getByRole('button', { name: /Все/ })).toHaveAttribute('aria-pressed', 'true')
    await u.click(screen.getByRole('button', { name: /В работе/ }))
    await u.click(screen.getByRole('button', { name: /Все/ }))
    expect(screen.getByRole('button', { name: /В работе/ })).toHaveAttribute('aria-pressed', 'false')
  })
  it('без счётчиков — без чисел', () => {
    const noCounts: LaneItem[] = items.map((it) => ({ value: it.value, label: it.label, tone: it.tone }))
    renderK(<StatusLane label="Статусы" items={noCounts} value={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /Все/ })).toHaveTextContent(/^Все$/)
  })
})
