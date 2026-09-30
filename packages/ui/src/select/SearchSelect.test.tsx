import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import type { Scalar } from '../filters/types'
import type { Option } from './options'
import { SearchSelect, type SearchSelectProps } from './SearchSelect'

const MANY: Option[] = ['В работе', 'К экспорту', 'В обработке', 'Ошибка', 'Отложенный', 'Экспортирован', 'Невалидный', 'Отказ', 'Обработан']
  .map((label, i) => ({ value: `S${i}`, label }))
const FEW: Option[] = [{ value: 'true', label: 'да' }, { value: 'false', label: 'нет' }]

function Host({ initial = null, onValue = () => {}, ...p }: Partial<SearchSelectProps> & { initial?: Scalar | null; onValue?: (v: Scalar | null) => void }) {
  const [v, setV] = useState<Scalar | null>(initial)
  return <SearchSelect aria-label="Статус" options={MANY} {...p} value={v} onChange={(x) => { setV(x); onValue(x) }} />
}

describe('SearchSelect', () => {
  it('с поиском (вариантов больше 7): ввод фильтрует, стрелка и Enter выбирают', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    const box = screen.getByRole('combobox', { name: 'Статус' })
    expect(box.tagName).toBe('INPUT')
    await u.click(box)
    expect(screen.getByRole('listbox', { name: 'Статус' })).toBeInTheDocument()
    await u.type(box, 'отка') // «отк» нашёл бы и «В обраб*отк*е»
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Отказ'])
    await u.keyboard('{Enter}')
    expect(onValue).toHaveBeenLastCalledWith('S7')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(box).toHaveValue('Отказ')
  })
  it('aria-activedescendant следует за стрелками; Escape закрывает без выбора', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host onValue={onValue} />)
    const box = screen.getByRole('combobox', { name: 'Статус' })
    box.focus()
    await u.keyboard('{ArrowDown}{ArrowDown}')
    const opt = document.getElementById(box.getAttribute('aria-activedescendant')!)
    expect(opt).toHaveTextContent('К экспорту')
    await u.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onValue).not.toHaveBeenCalled()
  })
  it('без поиска: кнопка-комбобокс, Enter открывает, буква переходит, Enter выбирает', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    renderK(<Host options={FEW} onValue={onValue} />)
    const box = screen.getByRole('combobox', { name: 'Статус' })
    expect(box.tagName).toBe('BUTTON')
    box.focus()
    await u.keyboard('{Enter}')
    await u.keyboard('н')
    expect(document.getElementById(box.getAttribute('aria-activedescendant')!)).toHaveTextContent('нет')
    await u.keyboard('{Enter}')
    expect(onValue).toHaveBeenLastCalledWith('false')
  })
  it('очистка кнопкой и Delete; Enter не отправляет форму', async () => {
    const u = userEvent.setup()
    const onValue = vi.fn()
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    renderK(<form onSubmit={onSubmit}><Host initial="S3" onValue={onValue} /></form>)
    await u.click(screen.getByRole('button', { name: 'Очистить' }))
    expect(onValue).toHaveBeenLastCalledWith(null)
    const box = screen.getByRole('combobox', { name: 'Статус' })
    await u.click(box)
    await u.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
    await u.keyboard('{Escape}')
    await u.keyboard('{Delete}')
    expect(onValue).toHaveBeenLastCalledWith(null)
  })
  it('пустой результат — «Ничего не найдено»', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.type(screen.getByRole('combobox', { name: 'Статус' }), 'яяя')
    expect(screen.getByRole('option')).toHaveTextContent('Ничего не найдено')
  })
  it('axe: закрыт и открыт', async () => {
    const u = userEvent.setup()
    const { container } = renderK(<Host initial="S1" />)
    expect(await axe(container)).toHaveNoViolations()
    await u.click(screen.getByRole('combobox', { name: 'Статус' }))
    // список портируется в корень KatranProvider внутри container; axe(document.body) ловит страничное правило region
    expect(container).toContainElement(screen.getByRole('listbox', { name: 'Статус' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
