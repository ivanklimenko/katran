import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { DateInput, type DateInputProps } from './DateInput'
import type { DateValue } from './dateStr'
import { PRESET_TODAY, PRESET_YESTERDAY } from './presets'

function Host({ initial = '', onValue = () => {}, ...p }: Partial<DateInputProps> & { initial?: DateValue; onValue?: (v: DateValue) => void }) {
  const [v, setV] = useState<DateValue>(initial)
  return <DateInput aria-label="Дата" today="2026-09-23" {...p} value={v} onChange={(x) => { setV(x); onValue(x) }} />
}

describe('DateInput', () => {
  it('маска по шаблону: полная валидная дата уходит ISO, неполная — пусто без подсветки', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Дата' })
    expect(input).toHaveAttribute('placeholder', 'дд.мм.гггг')
    await u.type(input, '0109')
    expect(input).toHaveValue('01.09')
    expect(input).not.toHaveAttribute('aria-invalid')
    await u.type(input, '2026')
    expect(input).toHaveValue('01.09.2026')
    expect(onValue).toHaveBeenLastCalledWith('2026-09-01')
  })
  it('невалидная полная дата — поле invalid, наружу пусто', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host initial="2026-09-01" onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Дата' })
    await u.clear(input)
    await u.type(input, '31022026')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onValue).toHaveBeenLastCalledWith('')
  })
  it('формат YYYY-MM-DD и время необязательно', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host format="YYYY-MM-DD" time initial="2026-09-01T18:30" onValue={onValue} />)
    const input = screen.getByRole('textbox', { name: 'Дата' })
    expect(input).toHaveValue('2026-09-01 18:30')
    await u.clear(input)
    await u.type(input, '20260902')
    expect(onValue).toHaveBeenLastCalledWith('2026-09-02')
    await u.type(input, '0915')
    expect(onValue).toHaveBeenLastCalledWith('2026-09-02T09:15')
  })
  it('календарь: выбор дня ставит значение, закрывает поповер и возвращает фокус в поле', async () => {
    const u = userEvent.setup()
    renderK(<Host initial="2026-09-01" />)
    await u.click(screen.getByRole('button', { name: 'Выбрать дату' }))
    const dialog = screen.getByRole('dialog', { name: 'Выбор даты' })
    expect(document.activeElement).toHaveAccessibleName('1 сентября 2026, вторник')
    await u.click(screen.getByRole('button', { name: /^15 сентября/ }))
    expect(dialog).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Дата' })).toHaveValue('15.09.2026')
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Дата' }))
  })
  it('календарь со временем: день, время, «Готово»', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host time onValue={onValue} />)
    await u.click(screen.getByRole('button', { name: 'Выбрать дату' }))
    await u.click(screen.getByRole('button', { name: /^15 сентября/ }))
    await u.type(screen.getByRole('textbox', { name: 'Время' }), '0930')
    expect(onValue).toHaveBeenLastCalledWith('2026-09-15T09:30')
    await u.click(screen.getByRole('button', { name: 'Готово' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('со временем: Enter в поле времени закрывает поповер, фокус в поле даты', async () => {
    const u = userEvent.setup()
    renderK(<Host time initial="2026-09-15" />)
    await u.click(screen.getByRole('button', { name: 'Выбрать дату' }))
    await u.type(screen.getByRole('textbox', { name: 'Время' }), '0930{Enter}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Дата' })).toHaveValue('15.09.2026 09:30')
    expect(screen.getByRole('textbox', { name: 'Дата' })).toHaveFocus()
  })
  it('курсор: Backspace и Delete по разделителю стирают соседнюю цифру, курсор остаётся на месте', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Дата' })
    await u.type(input, '0109')
    await u.type(input, '{Backspace}', { initialSelectionStart: 3, initialSelectionEnd: 3 })
    expect(input).toHaveValue('00.9')
    expect(input.selectionStart).toBe(1)
    await u.clear(input)
    await u.type(input, '0109')
    await u.type(input, '{Delete}', { initialSelectionStart: 2, initialSelectionEnd: 2 })
    expect(input).toHaveValue('01.9')
    expect(input.selectionStart).toBe(2)
  })
  it('курсор: правка в середине не уводит курсор в конец', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host initial="2026-09-01" onValue={onValue} />)
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Дата' })
    await u.type(input, '10', { initialSelectionStart: 3, initialSelectionEnd: 5 })
    expect(input).toHaveValue('01.10.2026')
    expect(input.selectionStart).toBe(5)
    expect(onValue).toHaveBeenLastCalledWith('2026-10-01')
  })
  it('горячие кнопки: ставят день, отмеченная — снимает', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host quick={[PRESET_TODAY, PRESET_YESTERDAY]} onValue={onValue} />)
    const group = screen.getByRole('group', { name: 'Быстрый выбор' })
    await u.click(screen.getByRole('button', { name: 'Вчера' }))
    expect(onValue).toHaveBeenLastCalledWith('2026-09-22')
    expect(screen.getByRole('button', { name: 'Вчера' })).toHaveAttribute('aria-pressed', 'true')
    await u.click(screen.getByRole('button', { name: 'Вчера' }))
    expect(onValue).toHaveBeenLastCalledWith('')
    expect(group).toBeInTheDocument()
  })
  it('min: дата раньше — invalid', async () => {
    const u = userEvent.setup()
    renderK(<Host min="2026-09-10" />)
    await u.type(screen.getByRole('textbox', { name: 'Дата' }), '01092026')
    expect(screen.getByRole('textbox', { name: 'Дата' })).toHaveAttribute('aria-invalid', 'true')
  })
  it('axe: закрыт и открыт', async () => {
    const u = userEvent.setup()
    const { container } = renderK(<Host initial="2026-09-01" time quick={[PRESET_TODAY]} />)
    expect(await axe(container)).toHaveNoViolations()
    await u.click(screen.getByRole('button', { name: 'Выбрать дату' }))
    // поповер портируется в корень KatranProvider внутри container; axe(document.body) ловит страничное правило region
    expect(container).toContainElement(screen.getByRole('dialog', { name: 'Выбор даты' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
