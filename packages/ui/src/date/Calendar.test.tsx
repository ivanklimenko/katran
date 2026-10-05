import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Calendar } from './Calendar'
import type { IsoDay } from './dateStr'

function Host({ start = '2026-09-15', min, onPick = () => {} }: { start?: IsoDay; min?: IsoDay; onPick?: (d: IsoDay) => void }) {
  const [month, setMonth] = useState<IsoDay>(start)
  const [value, setValue] = useState<IsoDay | ''>(start)
  return <Calendar month={month} onMonthChange={setMonth} value={value} min={min} today="2026-09-23" onPick={(d) => { setValue(d); onPick(d) }} />
}

describe('Calendar', () => {
  it('сетка месяца: имя, дни недели, 42 дня, сегодня, выбранный', async () => {
    const { container } = renderK(<Host />)
    const grid = screen.getByRole('grid', { name: 'Сентябрь 2026' })
    expect(grid.querySelectorAll('th')).toHaveLength(7)
    expect(grid.querySelectorAll('button[data-day]')).toHaveLength(42)
    expect(screen.getByRole('button', { name: '23 сентября 2026, среда' })).toHaveAttribute('aria-current', 'date')
    expect(screen.getByRole('button', { name: '15 сентября 2026, вторник' }).closest('td')).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: '15 сентября 2026, вторник' })).toHaveAttribute('tabindex', '0')
    expect(await axe(container)).toHaveNoViolations()
  })
  it('клик выбирает день; день вне min не выбирается', async () => {
    const u = userEvent.setup()
    const onPick = vi.fn()
    renderK(<Host min="2026-09-10" onPick={onPick} />)
    await u.click(screen.getByRole('button', { name: '20 сентября 2026, воскресенье' }))
    expect(onPick).toHaveBeenCalledWith('2026-09-20')
    const early = screen.getByRole('button', { name: '5 сентября 2026, суббота' })
    expect(early).toHaveAttribute('aria-disabled', 'true')
    await u.click(early)
    expect(onPick).toHaveBeenCalledTimes(1)
  })
  it('клавиатура: стрелки, край месяца листает, PgDn, Shift+PgUp, Home/End, Enter', async () => {
    const u = userEvent.setup()
    const onPick = vi.fn()
    renderK(<Host start="2026-09-29" onPick={onPick} />)
    screen.getByRole('button', { name: /^29 сентября/ }).focus()
    await u.keyboard('{ArrowRight}{ArrowRight}')
    expect(screen.getByRole('grid', { name: 'Октябрь 2026' })).toBeInTheDocument()
    expect(document.activeElement).toHaveAccessibleName('1 октября 2026, четверг')
    await u.keyboard('{ArrowDown}')
    expect(document.activeElement).toHaveAccessibleName('8 октября 2026, четверг')
    await u.keyboard('{Home}')
    expect(document.activeElement).toHaveAccessibleName('5 октября 2026, понедельник')
    await u.keyboard('{End}')
    expect(document.activeElement).toHaveAccessibleName('11 октября 2026, воскресенье')
    await u.keyboard('{PageDown}')
    expect(screen.getByRole('grid', { name: 'Ноябрь 2026' })).toBeInTheDocument()
    await u.keyboard('{Shift>}{PageUp}{/Shift}')
    expect(screen.getByRole('grid', { name: 'Ноябрь 2025' })).toBeInTheDocument()
    await u.keyboard('{Enter}')
    expect(onPick).toHaveBeenCalledWith('2025-11-11')
  })
  it('кнопки месяцев листают', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.click(screen.getByRole('button', { name: 'Следующий месяц' }))
    expect(screen.getByRole('grid', { name: 'Октябрь 2026' })).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Предыдущий месяц' }))
    await u.click(screen.getByRole('button', { name: 'Предыдущий месяц' }))
    expect(screen.getByRole('grid', { name: 'Август 2026' })).toBeInTheDocument()
  })
  it('диапазон: края и середина отмечены', () => {
    renderK(<Calendar month="2026-09-01" onMonthChange={() => {}} range={{ from: '2026-09-10', to: '2026-09-12' }} onPick={() => {}} today="2026-09-23" />)
    expect(screen.getByRole('button', { name: /^10 сентября/ })).toHaveAttribute('data-edge', 'true')
    expect(screen.getByRole('button', { name: /^11 сентября/ })).toHaveAttribute('data-in', 'true')
    expect(screen.getByRole('button', { name: /^12 сентября/ })).toHaveAttribute('data-edge', 'true')
    expect(screen.getByRole('button', { name: /^13 сентября/ })).not.toHaveAttribute('data-in')
  })
  it('Home на понедельнике не оставляет «залипший» фокус: листание кнопкой не уводит фокус в сетку', async () => {
    const u = userEvent.setup()
    renderK(<Host start="2026-09-14" />)
    screen.getByRole('button', { name: /^14 сентября/ }).focus()
    await u.keyboard('{Home}')
    expect(document.activeElement).toHaveAccessibleName('14 сентября 2026, понедельник')
    const next = screen.getByRole('button', { name: 'Следующий месяц' })
    await u.click(next)
    expect(screen.getByRole('grid', { name: 'Октябрь 2026' })).toBeInTheDocument()
    expect(next).toHaveFocus()
  })
  it('клавиши с Alt/Ctrl/Meta не двигают день', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    screen.getByRole('button', { name: /^15 сентября/ }).focus()
    await u.keyboard('{Alt>}{ArrowLeft}{/Alt}')
    await u.keyboard('{Control>}{ArrowRight}{/Control}')
    expect(document.activeElement).toHaveAccessibleName('15 сентября 2026, вторник')
    expect(screen.getByRole('button', { name: /^15 сентября/ })).toHaveAttribute('tabindex', '0')
  })
  it('значение сменили снаружи — таб-стоп переезжает на него, фокус не трогаем', () => {
    const props = { month: '2026-09-01', onMonthChange: () => {}, onPick: () => {}, today: '2026-09-23' }
    const { rerender } = renderK(<Calendar {...props} value="2026-09-15" />)
    expect(screen.getByRole('button', { name: /^15 сентября/ })).toHaveAttribute('tabindex', '0')
    rerender(<Calendar {...props} value="2026-09-20" />)
    expect(screen.getByRole('button', { name: /^20 сентября/ })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('button', { name: /^15 сентября/ })).toHaveAttribute('tabindex', '-1')
    expect(document.body).toHaveFocus()
  })
})
