import { useRef, useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { ColumnsMenu } from './ColumnsMenu'
import type { ColumnDef, ColumnsState } from './types'

type R = { a: number }
const columns: ColumnDef<R>[] = [
  { id: 'st', menuTitle: 'Статус', render: () => null },
  { id: 'id', title: 'ID', render: () => null },
  { id: 'dt', title: 'Дата', render: () => null },
]

function Host({ onChange }: { onChange: (s: ColumnsState) => void }) {
  const [open, setOpen] = useState(true)
  const [st, setSt] = useState<ColumnsState>({ order: ['st', 'id', 'dt'], hidden: [] })
  const a = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={a} onClick={() => setOpen(true)}>Колонки</button>
      <ColumnsMenu open={open} anchor={a} onClose={() => setOpen(false)} columns={columns} order={st.order} hidden={st.hidden} onChange={(s) => { setSt(s); onChange(s) }} />
    </>
  )
}

describe('ColumnsMenu', () => {
  it('список в порядке order, галочки, скрытие и показ', async () => {
    const onChange = vi.fn()
    renderK(<Host onChange={onChange} />)
    const dialog = screen.getByRole('dialog', { name: 'Состав колонок' })
    const boxes = within(dialog).getAllByRole('checkbox')
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Статус', 'ID', 'Дата'])
    await userEvent.click(boxes[1]!)
    expect(onChange).toHaveBeenLastCalledWith({ order: ['st', 'id', 'dt'], hidden: ['id'] })
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'ID' }))
    expect(onChange).toHaveBeenLastCalledWith({ order: ['st', 'id', 'dt'], hidden: [] })
  })
  it('перенос вверх/вниз; крайние кнопки недоступны', async () => {
    const onChange = vi.fn()
    renderK(<Host onChange={onChange} />)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Статус — выше' })).toBeDisabled()
    expect(within(dialog).getByRole('button', { name: 'Дата — ниже' })).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Дата — выше' }))
    expect(onChange).toHaveBeenLastCalledWith({ order: ['st', 'dt', 'id'], hidden: [] })
  })
  it('поиск фильтрует список; последнюю видимую скрыть нельзя', async () => {
    const onChange = vi.fn()
    renderK(<Host onChange={onChange} />)
    const dialog = screen.getByRole('dialog')
    await userEvent.type(within(dialog).getByRole('textbox', { name: 'Поиск колонки' }), 'дат')
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(1)
    await userEvent.clear(within(dialog).getByRole('textbox', { name: 'Поиск колонки' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Статус' }))
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'ID' }))
    expect(within(dialog).getByRole('checkbox', { name: 'Дата' })).toBeDisabled()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<Host onChange={() => {}} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
