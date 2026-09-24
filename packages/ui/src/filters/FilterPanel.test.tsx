import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { FilterPanel, type FilterPanelProps } from './FilterPanel'
import type { Filter, FilterMeta } from './types'

const meta: FilterMeta = { fields: [
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'DONE', label: 'Обработан' }, { value: 'ERROR', label: 'Ошибка' }] },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'f50name', label: 'Приказодатель', type: 'STRING', ops: [] },
  { id: 'created', label: 'Дата', type: 'DATE', ops: [] },
] }

type Over = Partial<FilterPanelProps>
function Host({ initial = [], ...over }: { initial?: Filter } & Over) {
  const [conditions, setConditions] = useState<Filter>(initial)
  const [draft, setDraft] = useState<Filter>(initial)
  const [open, setOpen] = useState(true)
  const same = JSON.stringify(conditions) === JSON.stringify(draft)
  return (
    <FilterPanel
      meta={meta} conditions={conditions} draft={draft} dirty={!same} open={open} onOpenChange={setOpen}
      onEdit={(c) => setDraft((d) => [...d.filter((x) => x.field !== c.field), c])}
      onDiscard={(f) => setDraft((d) => d.filter((x) => x.field !== f))}
      onApply={() => setConditions(draft)}
      onRevert={() => setDraft(conditions)}
      onReset={() => { setConditions([]); setDraft([]) }}
      onRemove={(f) => { setConditions((c) => c.filter((x) => x.field !== f)); setDraft((d) => d.filter((x) => x.field !== f)) }}
      {...over}
    />
  )
}

describe('FilterPanel', () => {
  it('строка состояния: кнопка с aria-expanded и счётчиком, чипы, «Сбросить»; без условий — «условия не заданы»', async () => {
    const u = userEvent.setup()
    const { container } = renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }, { field: 'amount', op: 'GT', value: 10 }]} />)
    const toggle = screen.getByRole('button', { name: /Фильтры/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('2')
    const list = screen.getByRole('list', { name: 'Применённые условия' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Статус = Обработан', 'Сумма > 10'])
    expect(await axe(container)).toHaveNoViolations()
    await u.click(within(list).getByRole('button', { name: 'Убрать условие: Статус = Обработан' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    await u.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(screen.queryByRole('list', { name: 'Применённые условия' })).toBeNull()
    expect(screen.getByText('условия не заданы')).toBeInTheDocument()
    await u.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Приказодатель' })).toBeNull()
  })
  it('поля по типам: строка → CONTAINS, число → EQ, ENUM → исходный скаляр; пустое поле снимает условие; Enter применяет; Отменить откатывает', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const apply = screen.getByRole('button', { name: 'Применить' })
    const revert = screen.getByRole('button', { name: 'Отменить' })
    expect(apply).toBeDisabled(); expect(revert).toBeDisabled()
    await u.type(screen.getByRole('textbox', { name: 'Приказодатель' }), 'Вас')
    await u.selectOptions(screen.getByRole('combobox', { name: 'Статус' }), 'ERROR')
    await u.type(screen.getByRole('textbox', { name: 'Сумма' }), '100')
    expect(apply).toBeEnabled()
    await u.type(screen.getByRole('textbox', { name: 'Сумма' }), '{Enter}')
    const list = screen.getByRole('list', { name: 'Применённые условия' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Приказодатель содержит „Вас“', 'Статус = Ошибка', 'Сумма = 100'])
    await u.clear(screen.getByRole('textbox', { name: 'Сумма' }))
    expect(revert).toBeEnabled()
    await u.click(revert)
    expect(screen.getByRole('textbox', { name: 'Сумма' })).toHaveValue('100')
    await u.clear(screen.getByRole('textbox', { name: 'Сумма' }))
    await u.click(apply)
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })
  it('набор не теряет символы, которые черновик нормализует: пробел в строке, дробная часть числа; внешняя смена черновика перезаписывает поле', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const name = screen.getByRole('textbox', { name: 'Приказодатель' })
    const sum = screen.getByRole('textbox', { name: 'Сумма' })
    await u.type(name, 'Иван Петров')
    await u.type(sum, '1,5')
    expect(name).toHaveValue('Иван Петров')
    expect(sum).toHaveValue('1,5')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    const list = screen.getByRole('list', { name: 'Применённые условия' })
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Приказодатель содержит „Иван Петров“', 'Сумма = 1.5'])
    await u.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(name).toHaveValue('')
    expect(sum).toHaveValue('')
  })
  it('DATE — поле даты с EQ', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const date = screen.getByLabelText('Дата')
    await u.type(date, '2026-09-01')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(screen.getByRole('list', { name: 'Применённые условия' })).toHaveTextContent('Дата = 01.09.2026')
  })
})
