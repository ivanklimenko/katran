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
  { id: 'valueDate', label: 'Валютирование', type: 'DATETIME', ops: [] },
] }

type Over = Partial<FilterPanelProps>
/** Смена условий мимо панели — как setLane модели: одна и та же правка применённых и черновика. */
type Outside = Record<string, (f: Filter) => Filter>
function Host({ initial = [], outside = {}, ...over }: { initial?: Filter; outside?: Outside } & Over) {
  const [conditions, setConditions] = useState<Filter>(initial)
  const [draft, setDraft] = useState<Filter>(initial)
  const [open, setOpen] = useState(true)
  const same = JSON.stringify(conditions) === JSON.stringify(draft)
  return (
    <>
    {Object.entries(outside).map(([name, fn]) => <button key={name} type="button" onClick={() => { setConditions(fn); setDraft(fn) }}>{name}</button>)}
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
    </>
  )
}
/** Лейн извне: EQ по status или снятие. */
const lane = (v: string | null) => (f: Filter): Filter => [...f.filter((x) => x.field !== 'status'), ...(v === null ? [] : [{ field: 'status', op: 'EQ' as const, value: v }])]

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
    expect(await axe(container)).toHaveNoViolations()
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
  it('промежуточный ввод без условия («-» перед числом) остаётся в поле; внешний откат возвращает применённое значение', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const sum = screen.getByRole('textbox', { name: 'Сумма' })
    await u.type(sum, '-')
    expect(sum).toHaveValue('-')
    expect(screen.queryByRole('list', { name: 'Применённые условия' })).toBeNull()
    await u.type(sum, '1{Enter}')
    expect(sum).toHaveValue('-1')
    expect(screen.getByRole('list', { name: 'Применённые условия' })).toHaveTextContent('Сумма = -1')
    await u.clear(sum)
    await u.type(sum, '-')
    expect(sum).toHaveValue('-')
    await u.click(screen.getByRole('button', { name: 'Отменить' }))
    expect(sum).toHaveValue('-1')
  })
  it('DATE — поле даты с EQ', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const date = screen.getByLabelText('Дата')
    await u.type(date, '2026-09-01')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(screen.getByRole('list', { name: 'Применённые условия' })).toHaveTextContent('Дата = 01.09.2026')
  })
  it('DATETIME: поле показывает набранную границу; пустые обе → условия нет (спека 6.2, Ruling 5)', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const from = screen.getByLabelText('Валютирование, с')
    const to = screen.getByLabelText('Валютирование, по')
    await u.type(from, '2026-09-01')
    expect(to).toHaveValue('')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(screen.getByRole('list', { name: 'Применённые условия' })).toHaveTextContent('Валютирование от 01.09.2026 00:00 до 01.09.2026 23:59')
    expect(from).toHaveValue('2026-09-01')
    expect(to).toHaveValue('')
    await u.clear(from)
    expect(from).toHaveValue('')
    expect(to).toHaveValue('')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(screen.queryByRole('list', { name: 'Применённые условия' })).toBeNull()
  })
  it('фокус после ✕: на ✕ следующего чипа, иначе предыдущего, иначе на «Фильтры»; после «Сбросить» — на «Фильтры»', async () => {
    const u = userEvent.setup()
    const { unmount } = renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }, { field: 'amount', op: 'GT', value: 10 }, { field: 'f50name', op: 'CONTAINS', value: 'Иван' }]} />)
    const toggle = screen.getByRole('button', { name: /Фильтры/ })
    const x = (name: string) => screen.getByRole('button', { name: `Убрать условие: ${name}` })
    await u.tab(); expect(toggle).toHaveFocus()
    await u.tab(); expect(x('Статус = Обработан')).toHaveFocus()
    await u.keyboard('{Enter}')
    expect(x('Сумма > 10')).toHaveFocus()
    await u.tab(); expect(x('Приказодатель содержит „Иван“')).toHaveFocus()
    await u.keyboard('{Enter}')
    expect(x('Сумма > 10')).toHaveFocus()
    await u.keyboard('{Enter}')
    expect(screen.queryByRole('list', { name: 'Применённые условия' })).toBeNull()
    expect(toggle).toHaveFocus()
    unmount()
    renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }, { field: 'amount', op: 'GT', value: 10 }]} />)
    await u.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(screen.getByRole('button', { name: /Фильтры/ })).toHaveFocus()
  })
  it('смена черновика извне (лейн) перекрывает выбранное в Select; снятие извне → «—»', async () => {
    const u = userEvent.setup()
    renderK(<Host outside={{ 'лейн: Ошибка': lane('ERROR'), 'лейн: Все': lane(null) }} />)
    const status = screen.getByRole('combobox', { name: 'Статус' })
    await u.selectOptions(status, 'DONE')
    expect(status).toHaveValue('DONE')
    await u.click(screen.getByRole('button', { name: 'лейн: Ошибка' }))
    expect(status).toHaveValue('ERROR')
    expect(status).toHaveDisplayValue('Ошибка')
    await u.click(screen.getByRole('button', { name: 'лейн: Все' }))
    expect(status).toHaveValue('')
    expect(status).toHaveDisplayValue('—')
  })
  it('«-» без условия: ввод в другом поле его не стирает, «Сбросить» — стирает', async () => {
    const u = userEvent.setup()
    renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }]} />)
    const sum = screen.getByRole('textbox', { name: 'Сумма' })
    await u.type(sum, '-')
    await u.type(screen.getByRole('textbox', { name: 'Приказодатель' }), 'Ив')
    expect(sum).toHaveValue('-')
    await u.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(sum).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Приказодатель' })).toHaveValue('')
  })
})
