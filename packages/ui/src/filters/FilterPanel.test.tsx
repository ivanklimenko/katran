import { useState } from 'react'
import { screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { FilterPanel, type FilterPanelProps } from './FilterPanel'
import type { Condition, Filter, FilterMeta, SuggestState } from './types'

const META: FilterMeta = { fields: [
  { id: 'docNumber', label: 'Номер документа', type: 'NUMBER', ops: [], defaultOp: 'IN' },
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: [{ value: 'ERROR', label: 'Ошибка' }, { value: 'REJECTED', label: 'Отказ' }, { value: 'DONE', label: 'Обработан' }] },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'created', label: 'Дата документа', type: 'DATE', ops: [] },
  { id: 'purpose', label: 'Назначение', type: 'STRING', ops: [], suggest: true },
  { id: 'urgent', label: 'Срочный', type: 'BOOLEAN', ops: [] },
  { id: 'valueDate', label: 'Валютирование', type: 'DATETIME', ops: [] },
] }

const replaceField = (list: Filter, field: string, cs: Condition[]): Filter => {
  const i = list.findIndex((x) => x.field === field)
  if (i < 0) return cs.length ? [...list, ...cs] : list
  return [...list.slice(0, i), ...cs, ...list.slice(i).filter((x) => x.field !== field)]
}

/** Смена условий мимо панели — как setLane модели: одна и та же правка применённых и черновика. */
type Outside = Record<string, (f: Filter) => Filter>
function Host({ initial = [], meta = META, onSuggest, suggest = null, outside = {}, ...p }: Partial<FilterPanelProps> & { initial?: Filter; outside?: Outside }) {
  const [conditions, setConditions] = useState<Filter>(initial)
  const [draft, setDraft] = useState<Filter>(initial)
  const [open, setOpen] = useState(true)
  return (
    <>
      {Object.entries(outside).map(([name, fn]) => <button key={name} type="button" onClick={() => { setConditions(fn); setDraft(fn) }}>{name}</button>)}
      <FilterPanel
        meta={meta} conditions={conditions} draft={draft} dirty={JSON.stringify(conditions) !== JSON.stringify(draft)} open={open} onOpenChange={setOpen}
        onEdit={(c) => setDraft((d) => replaceField(d, c.field, [c]))}
        onDiscard={(f) => setDraft((d) => d.filter((x) => x.field !== f))}
        onSetField={({ field, conditions: cs }) => setDraft((d) => replaceField(d, field, cs))}
        onApply={() => setConditions(draft)} onRevert={() => setDraft(conditions)}
        onReset={() => { setConditions([]); setDraft([]) }}
        onRemove={(f) => { setConditions((c) => c.filter((x) => x.field !== f)); setDraft((d) => d.filter((x) => x.field !== f)) }}
        suggest={suggest} onSuggest={onSuggest} {...p}
      />
    </>
  )
}
const applied = () => within(screen.getByRole('list', { name: 'Применённые условия' })).getAllByRole('listitem').map((li) => li.getAttribute('data-k-tip'))
/** Лейн извне: EQ по status или снятие. */
const lane = (v: string | null) => (f: Filter): Filter => [...f.filter((x) => x.field !== 'status'), ...(v === null ? [] : [{ field: 'status', op: 'EQ' as const, value: v }])]

describe('FilterPanel', () => {
  it('строка состояния: кнопка с aria-expanded и счётчиком, чипы, «Сбросить»; без условий — «условия не заданы»', async () => {
    const u = userEvent.setup()
    renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }, { field: 'amount', op: 'GT', value: 10 }]} />)
    const toggle = screen.getByRole('button', { name: /Фильтры/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('2')
    const list = screen.getByRole('list', { name: 'Применённые условия' })
    const items = within(list).getAllByRole('listitem')
    expect(items.map((li) => li.textContent)).toEqual(['Статус = Обработан', 'Сумма > 10'])
    // Чип — три части в отдельных элементах (поле, оператор, значение), не одна строка.
    expect(items[0]?.children.length).toBeGreaterThanOrEqual(4) // cf, co, cv, ✕-кнопка
    await u.click(within(list).getByRole('button', { name: 'Убрать условие: Статус = Обработан' }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(1)
    await u.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(screen.queryByRole('list', { name: 'Применённые условия' })).toBeNull()
    expect(screen.getByText('условия не заданы')).toBeInTheDocument()
    await u.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('textbox', { name: 'Назначение' })).toBeNull()
  })
  // axe — отдельными случаями с явным таймаутом: под нагрузкой полного прогона два прохода axe в одном
  // тесте с кликами упирались в таймаут по умолчанию 5 с (флак D4 плана 5b)
  const AXE_TIMEOUT = 15_000
  it('axe: строка с чипами и открытым телом на всех контролах', async () => {
    const { container } = renderK(<Host initial={[
      { field: 'docNumber', op: 'IN', values: [400, 403] },
      { field: 'status', op: 'IN', values: ['ERROR', 'DONE'] },
      { field: 'created', op: 'BETWEEN', from: '2026-09-01', to: '2026-09-13' },
      { field: 'purpose', op: 'CONTAINS', value: 'Оплата' },
      { field: 'purpose', op: 'CONTAINS', value: 'договор' },
      { field: 'urgent', op: 'EQ', value: true },
    ]} />)
    expect(await axe(container)).toHaveNoViolations()
  }, AXE_TIMEOUT)
  it('axe: без условий, тело свёрнуто', async () => {
    const { container } = renderK(<Host open={false} />)
    expect(screen.getByText('условия не заданы')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  }, AXE_TIMEOUT)
  it('чип: полный текст условия — общим тултипом data-k-tip, без нативного title; счётчик на primary-кнопке — tone accent и в нуле', () => {
    const { rerender } = renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }]} />)
    const li = within(screen.getByRole('list', { name: 'Применённые условия' })).getAllByRole('listitem')[0]!
    expect(li).toHaveAttribute('data-k-tip', 'Статус = Обработан')
    expect(li).not.toHaveAttribute('title')
    expect(screen.getByRole('button', { name: /Фильтры/ }).querySelector('[data-tone="accent"]')).toHaveTextContent('1')
    rerender(<Host key="empty" />)
    const zero = screen.getByRole('button', { name: /Фильтры/ }).querySelector('[data-tone="accent"]')
    expect(zero).toHaveTextContent('0')
    expect(zero).toHaveAttribute('data-zero', 'true')
  })
  it('несколько условий поля — один чип, счётчик по полям; ✕ снимает все условия поля', async () => {
    const u = userEvent.setup()
    renderK(<Host initial={[
      { field: 'purpose', op: 'CONTAINS', value: 'Оплата' },
      { field: 'amount', op: 'EQ', value: 5 },
      { field: 'purpose', op: 'CONTAINS', value: 'договор' },
    ]} />)
    expect(applied()).toEqual(['Назначение содержит „Оплата“ и „договор“', 'Сумма = 5'])
    expect(screen.getByRole('button', { name: /^Фильтры/ })).toHaveTextContent('2')
    await u.click(screen.getByRole('button', { name: 'Убрать условие: Назначение содержит „Оплата“ и „договор“' }))
    expect(applied()).toEqual(['Сумма = 5'])
    expect(screen.getByRole('textbox', { name: 'Назначение' })).toHaveValue('')
    expect(screen.queryByRole('list', { name: 'Назначение' })).toBeNull()
  })
  it('поля по типам: фраза → CONTAINS, число → EQ, справочник → исходный скаляр; пустое поле снимает условие; Enter применяет; Отменить откатывает', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const apply = screen.getByRole('button', { name: 'Применить' })
    const revert = screen.getByRole('button', { name: 'Отменить' })
    expect(apply).toBeDisabled(); expect(revert).toBeDisabled()
    await u.type(screen.getByRole('textbox', { name: 'Назначение' }), 'Вас')
    await u.click(screen.getByRole('button', { name: 'Статус: Не выбрано' }))
    await u.click(screen.getByRole('option', { name: 'Ошибка' }))
    await u.keyboard('{Escape}')
    await u.type(screen.getByRole('textbox', { name: 'Сумма' }), '100')
    expect(apply).toBeEnabled()
    await u.type(screen.getByRole('textbox', { name: 'Сумма' }), '{Enter}')
    expect(applied()).toEqual(['Назначение содержит „Вас“', 'Статус = Ошибка', 'Сумма = 100'])
    await u.clear(screen.getByRole('textbox', { name: 'Сумма' }))
    expect(revert).toBeEnabled()
    await u.click(revert)
    expect(screen.getByRole('textbox', { name: 'Сумма' })).toHaveValue('100')
    await u.clear(screen.getByRole('textbox', { name: 'Сумма' }))
    await u.click(apply)
    expect(applied()).toHaveLength(2)
  })
  it('BOOLEAN — выбор «да»/«нет» без поиска, EQ', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.click(screen.getByRole('combobox', { name: 'Срочный' }))
    await u.click(screen.getByRole('option', { name: 'нет' }))
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Срочный = нет'])
  })
  it('набор не теряет символы, которые черновик нормализует: пробел во фразе, дробная часть числа; внешняя смена черновика перезаписывает поле', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const name = screen.getByRole('textbox', { name: 'Назначение' })
    const sum = screen.getByRole('textbox', { name: 'Сумма' })
    await u.type(name, 'Иван Петров')
    await u.type(sum, '1,5')
    expect(name).toHaveValue('Иван Петров')
    expect(sum).toHaveValue('1,5')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Назначение содержит „Иван Петров“', 'Сумма = 1.5'])
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
  it('DATE: равные границы — EQ, Enter в поле даты применяет', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.type(screen.getByRole('textbox', { name: 'Дата документа, с' }), '01092026')
    await u.type(screen.getByRole('textbox', { name: 'Дата документа, по' }), '01092026{Enter}')
    expect(applied()).toEqual(['Дата документа = 01.09.2026'])
  })
  it('DATETIME: одна граница — с начала дня; поле показывает набранное; пустые обе → условия нет', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    const from = screen.getByRole('textbox', { name: 'Валютирование, с' })
    const to = screen.getByRole('textbox', { name: 'Валютирование, по' })
    await u.type(from, '01092026')
    expect(to).toHaveValue('')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Валютирование с 01.09.2026'])
    expect(from).toHaveValue('01.09.2026')
    expect(to).toHaveValue('')
    await u.clear(from)
    expect(from).toHaveValue('')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(screen.queryByRole('list', { name: 'Применённые условия' })).toBeNull()
  })
  it('фокус после ✕: на ✕ следующего чипа, иначе предыдущего, иначе на «Фильтры»; после «Сбросить» — на «Фильтры»', async () => {
    const u = userEvent.setup()
    const { unmount } = renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }, { field: 'amount', op: 'GT', value: 10 }, { field: 'purpose', op: 'CONTAINS', value: 'Иван' }]} />)
    const toggle = screen.getByRole('button', { name: /Фильтры/ })
    const x = (name: string) => screen.getByRole('button', { name: `Убрать условие: ${name}` })
    await u.tab(); expect(toggle).toHaveFocus()
    await u.tab(); expect(x('Статус = Обработан')).toHaveFocus()
    await u.keyboard('{Enter}')
    expect(x('Сумма > 10')).toHaveFocus()
    await u.tab(); expect(x('Назначение содержит „Иван“')).toHaveFocus()
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
  it('смена черновика извне (лейн) перекрывает выбранное в мультиселекте; снятие извне → «Не выбрано»', async () => {
    const u = userEvent.setup()
    renderK(<Host outside={{ 'лейн: Ошибка': lane('ERROR'), 'лейн: Все': lane(null) }} />)
    await u.click(screen.getByRole('button', { name: 'Статус: Не выбрано' }))
    await u.click(screen.getByRole('option', { name: 'Обработан' }))
    await u.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: 'Статус: выбрано 1' })).toHaveAccessibleDescription('Обработан')
    await u.click(screen.getByRole('button', { name: 'лейн: Ошибка' }))
    expect(screen.getByRole('button', { name: 'Статус: выбрано 1' })).toHaveAccessibleDescription('Ошибка')
    await u.click(screen.getByRole('button', { name: 'лейн: Все' }))
    expect(screen.getByRole('button', { name: 'Статус: Не выбрано' })).toBeInTheDocument()
  })
  it('«-» без условия: ввод в другом поле его не стирает, «Сбросить» — стирает', async () => {
    const u = userEvent.setup()
    renderK(<Host initial={[{ field: 'status', op: 'EQ', value: 'DONE' }]} />)
    const sum = screen.getByRole('textbox', { name: 'Сумма' })
    await u.type(sum, '-')
    await u.type(screen.getByRole('textbox', { name: 'Назначение' }), 'Ив')
    expect(sum).toHaveValue('-')
    await u.click(screen.getByRole('button', { name: 'Сбросить' }))
    expect(sum).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Назначение' })).toHaveValue('')
  })
})

describe('FilterPanel: контролы по типам', () => {
  it('список номеров вставкой — IN, чип «в списке … и ещё N»', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    fireEvent.paste(screen.getByRole('textbox', { name: 'Номер документа' }), { clipboardData: { getData: () => '400\n403\n406\n409' } })
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Номер документа в списке 400, 403, 406, 409'])
    expect(screen.getByRole('list', { name: 'Применённые условия' })).toHaveTextContent('400, 403, 406 и ещё 1')
  })
  it('две фразы — два CONTAINS по полю, один чип; счётчик — число полей', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.type(screen.getByRole('textbox', { name: 'Назначение' }), '"счёт не найден" "инструкция инвалидна"{Enter}')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Назначение содержит „счёт не найден“ и „инструкция инвалидна“'])
    expect(screen.getByRole('button', { name: /^Фильтры/ })).toHaveTextContent('1')
  })
  it('набранный, но не ставший чипом текст учитывается при «Применить»', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.type(screen.getByRole('textbox', { name: 'Назначение' }), 'Василёк')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Назначение содержит „Василёк“'])
  })
  it('справочник: одно значение — EQ, два — IN', async () => {
    const u = userEvent.setup()
    renderK(<Host />)
    await u.click(screen.getByRole('button', { name: 'Статус: Не выбрано' }))
    await u.click(screen.getByRole('option', { name: 'Ошибка' }))
    await u.keyboard('{Escape}')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Статус = Ошибка'])
    await u.click(screen.getByRole('button', { name: /^Статус: выбрано/ }))
    await u.click(screen.getByRole('option', { name: 'Отказ' }))
    await u.keyboard('{Escape}')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Статус в списке Ошибка, Отказ'])
  })
  it('чужой оператор поля (внешний NE по справочнику) не читается контролом и переживает правку поля', async () => {
    const u = userEvent.setup()
    renderK(<Host initial={[{ field: 'status', op: 'NE', value: 'ERROR' }]} />)
    expect(screen.getByRole('button', { name: 'Статус: Не выбрано' })).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Статус: Не выбрано' }))
    await u.click(screen.getByRole('option', { name: 'Отказ' }))
    await u.keyboard('{Escape}')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Статус ≠ Ошибка и = Отказ'])
    // снятие выбора оставляет чужое условие
    await u.click(screen.getByRole('button', { name: /^Статус: выбрано/ }))
    await u.click(screen.getByRole('option', { name: 'Отказ' }))
    await u.keyboard('{Escape}')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Статус ≠ Ошибка'])
  })
  it('внешняя смена черновика (лейн) показывается в мультиселекте', () => {
    const { rerender } = renderK(<FilterPanel meta={META} conditions={[]} draft={[]} dirty={false} open onOpenChange={() => {}} onEdit={() => {}} onDiscard={() => {}} onApply={() => {}} onRevert={() => {}} onReset={() => {}} onRemove={() => {}} />)
    rerender(<FilterPanel meta={META} conditions={[]} draft={[{ field: 'status', op: 'EQ', value: 'DONE' }]} dirty open onOpenChange={() => {}} onEdit={() => {}} onDiscard={() => {}} onApply={() => {}} onRevert={() => {}} onReset={() => {}} onRemove={() => {}} />)
    expect(screen.getByRole('button', { name: 'Статус: выбрано 1' })).toBeInTheDocument()
    expect(screen.getByText('Обработан')).toBeInTheDocument()
  })
  it('период горячей кнопкой: «Сегодня» — EQ, «3 дня» — с … по', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 23, 12, 0))
    const u = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderK(<Host />)
    const quick = within(screen.getByRole('group', { name: 'Дата документа' }).parentElement!).getByRole('group', { name: 'Дата документа: быстрый период' })
    await u.click(within(quick).getByRole('button', { name: 'Сегодня' }))
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Дата документа = 23.09.2026'])
    await u.click(within(quick).getByRole('button', { name: '3 дня' }))
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Дата документа с 21.09.2026 по 23.09.2026'])
    vi.useRealTimers()
  })
  it('dateFormat панели — в полях и чипах', async () => {
    const u = userEvent.setup()
    renderK(<Host dateFormat="YYYY-MM-DD" />)
    await u.type(screen.getByRole('textbox', { name: 'Дата документа, с' }), '20260901')
    await u.click(screen.getByRole('button', { name: 'Применить' }))
    expect(applied()).toEqual(['Дата документа с 2026-09-01'])
    expect(screen.getByRole('textbox', { name: 'Дата документа, с' })).toHaveValue('2026-09-01')
  })
  it('без BETWEEN у даты — «по» недоступно', () => {
    renderK(<Host meta={{ fields: [{ id: 'created', label: 'Дата документа', type: 'DATE', ops: ['EQ', 'GTE'] }] }} />)
    expect(screen.getByRole('textbox', { name: 'Дата документа, по' })).toBeDisabled()
  })
  it('подсказки — только полю из suggest.field, без уже выбранных; ввод зовёт onSuggest', async () => {
    const u = userEvent.setup()
    const onSuggest = vi.fn()
    const s: SuggestState = { field: 'purpose', query: 'оп', items: ['Оплата', 'Оплата по договору'], loading: false }
    renderK(<Host onSuggest={onSuggest} suggest={s} onSuggestClose={() => {}} initial={[{ field: 'purpose', op: 'CONTAINS', value: 'Оплата' }]} />)
    // поле без suggest: true остаётся простой строкой ввода, подсказки ему не идут
    expect(screen.getByRole('textbox', { name: 'Номер документа' })).toBeInTheDocument()
    await u.type(screen.getByRole('combobox', { name: 'Назначение' }), 'оп')
    expect(onSuggest).toHaveBeenLastCalledWith({ field: 'purpose', query: 'оп' })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Оплата по договору'])
  })
  it('подсказки другого поля не показываются', async () => {
    const u = userEvent.setup()
    const s: SuggestState = { field: 'other', query: 'оп', items: ['Оплата'], loading: false }
    renderK(<Host onSuggest={() => {}} suggest={s} onSuggestClose={() => {}} />)
    await u.type(screen.getByRole('combobox', { name: 'Назначение' }), 'оп')
    expect(screen.queryByRole('option')).toBeNull()
  })
  it('подсказки: загрузка видна у поля из suggest.field; Escape закрывает список и зовёт onSuggestClose', async () => {
    const u = userEvent.setup()
    const onSuggestClose = vi.fn()
    const s: SuggestState = { field: 'purpose', query: 'о', items: [], loading: true }
    renderK(<Host onSuggest={() => {}} suggest={s} onSuggestClose={onSuggestClose} />)
    await u.type(screen.getByRole('combobox', { name: 'Назначение' }), 'о')
    expect(screen.getByRole('listbox', { name: 'Подсказки: Назначение' })).toHaveTextContent('Ищу…')
    await u.keyboard('{Escape}')
    expect(onSuggestClose).toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()
  })
  it('без onSetField — совместимость: первое условие поля через onEdit', async () => {
    const u = userEvent.setup()
    const onEdit = vi.fn()
    renderK(<FilterPanel meta={META} conditions={[]} draft={[]} dirty={false} open onOpenChange={() => {}} onEdit={onEdit} onDiscard={() => {}} onApply={() => {}} onRevert={() => {}} onReset={() => {}} onRemove={() => {}} />)
    await u.type(screen.getByRole('textbox', { name: 'Сумма' }), '5')
    expect(onEdit).toHaveBeenLastCalledWith({ field: 'amount', op: 'EQ', value: 5 })
  })
})

/** Хост старого API: без onSetField, черновик правит только onEdit/onDiscard. */
function CompatHost({ initial = [], onEditSpy = () => {} }: { initial?: Filter; onEditSpy?: (c: Condition) => void }) {
  const [draft, setDraft] = useState<Filter>(initial)
  return (
    <FilterPanel meta={META} conditions={initial} draft={draft} dirty={JSON.stringify(initial) !== JSON.stringify(draft)} open onOpenChange={() => {}}
      onEdit={(c) => { onEditSpy(c); setDraft((d) => replaceField(d, c.field, [c])) }}
      onDiscard={(f) => setDraft((d) => d.filter((x) => x.field !== f))}
      onApply={() => {}} onRevert={() => {}} onReset={() => {}} onRemove={() => {}} />
  )
}

describe('FilterPanel: совместимый режим (без onSetField)', () => {
  it('фразы ограничены одной: вторая не добавляется, видна строка о пределе; наружу — одно условие', async () => {
    const u = userEvent.setup()
    const onEdit = vi.fn()
    renderK(<CompatHost onEditSpy={onEdit} />)
    const input = screen.getByRole('textbox', { name: 'Назначение' })
    await u.type(input, 'счёт{Enter}')
    await u.type(input, 'инструкция{Enter}')
    expect(screen.getByText('Не добавлено: предел 1', { selector: 'span' })).toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'Назначение' })).getAllByRole('listitem')).toHaveLength(1)
    expect(input).toHaveValue('инструкция')
    expect(onEdit).toHaveBeenLastCalledWith({ field: 'purpose', op: 'CONTAINS', value: 'счёт' })
  })
  it('чужое условие поля (внешний NE) не уходит вместо правки поля', async () => {
    const u = userEvent.setup()
    const onEdit = vi.fn()
    renderK(<CompatHost onEditSpy={onEdit} initial={[{ field: 'purpose', op: 'NE', value: 'x' }]} />)
    await u.type(screen.getByRole('textbox', { name: 'Назначение' }), 'В')
    expect(onEdit).toHaveBeenLastCalledWith({ field: 'purpose', op: 'CONTAINS', value: 'В' })
    expect(screen.getByRole('textbox', { name: 'Назначение' })).toHaveValue('В')
  })
})
