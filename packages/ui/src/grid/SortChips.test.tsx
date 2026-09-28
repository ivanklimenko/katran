import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { SortChips } from './SortChips'
import type { ColumnDef } from './types'

const columns: ColumnDef<unknown>[] = [
  { id: 't', title: 'Тип', sort: [{ id: 'type', label: 'Тип сообщения' }], render: () => null },
  { id: 'b', title: '52', sort: [{ id: 'f52', label: 'BIC 52' }], render: () => null },
]

describe('SortChips', () => {
  it('пусто — ничего; уровни — «Сортировка: 1 … › 2 …», подсказка при двух и более', async () => {
    const { container, rerender } = renderK(<SortChips sort={[]} columns={columns} onSort={() => {}} />)
    expect(screen.queryByText('Сортировка:')).toBeNull()
    const onSort = vi.fn()
    rerender(<SortChips sort={[{ key: 'type', dir: 'asc' }, { key: 'f52', dir: 'desc' }]} columns={columns} onSort={onSort} />)
    expect(screen.getByText('Сортировка:')).toBeInTheDocument()
    expect(screen.getByText('Shift+клик по заголовку — ещё уровень')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Уровень 1: Тип сообщения, по возрастанию — сменить направление' }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'desc' }, { key: 'f52', dir: 'desc' }])
    expect(screen.getByRole('button', { name: 'Уровень 2: BIC 52, по убыванию — сменить направление' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Убрать уровень BIC 52' }))
    expect(onSort).toHaveBeenLastCalledWith([{ key: 'type', dir: 'asc' }])
    expect(await axe(container)).toHaveNoViolations()
  })
})
