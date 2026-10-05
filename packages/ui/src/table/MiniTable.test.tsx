import { useState } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { MiniTable, type MiniColumn } from './MiniTable'

type Ev = { at: string; route: string; code: string }
const EVENTS: Ev[] = [
  { at: '07:31:45', route: '—', code: 'fx-dup-check.end' },
  { at: '07:31:46', route: 'RT_FX_IN', code: 'fx-in-checks.start' },
]
const COLS: MiniColumn<Ev>[] = [
  { id: 'at', header: 'Дата/время', width: 118, mono: true, render: (r) => r.at },
  { id: 'route', header: 'Маршрут', width: 150, render: (r) => r.route },
  { id: 'code', header: 'Статус', render: (r) => r.code },
  { id: 'n', header: 'Δ', width: 50, align: 'end', render: (_, i) => `#${i}` },
]
const byCode = (r: Ev) => r.code

type Task = { id: string; text: string; history: string }
const TASKS: Task[] = [
  { id: 't1', text: 'Подтвердить маршрут', history: 'Назначена · Иванова' },
  { id: 't2', text: 'Проверить тариф', history: 'Создана · система' },
]
const TASK_COLS: MiniColumn<Task>[] = [
  { id: 'text', header: '', render: (r) => r.text },
  { id: 'hist', header: '', width: 60, render: () => <a href="#hist">История</a> },
  { id: 'act', header: '', width: 60, render: () => <button type="button">Действие</button> },
]
const byId = (r: Task) => r.id
const rowOf = (text: string) => screen.getByText(text).closest('[role="row"]') as HTMLElement
const toggleOf = (text: string) => within(rowOf(text)).getByRole('button', { name: /^(Раскрыть|Свернуть) строку \d+$/ })

describe('MiniTable', () => {
  it('таблица с именем, шапка, ячейки из render(row, index), моно и выравнивание', () => {
    renderK(<MiniTable label="Статусы" columns={COLS} rows={EVENTS} rowKey={byCode} empty="Статусов нет" />)
    const table = screen.getByRole('table', { name: 'Статусы' })
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Дата/время', 'Маршрут', 'Статус', 'Δ'])
    expect(within(table).getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('fx-in-checks.start')).toHaveAttribute('role', 'cell')
    expect(screen.getByText('07:31:45').className).toMatch(/mono/)
    expect(screen.getByText('#1')).toHaveAttribute('data-align', 'end')
  })

  it('ширины колонок — px при плотности 1, умножаются на плотность; без ширины — minmax(0, 1fr)', () => {
    renderK(<MiniTable label="Статусы" columns={COLS} rows={EVENTS} rowKey={byCode} empty="Статусов нет" numbered />)
    expect(screen.getByRole('table').style.getPropertyValue('--k-cols'))
      .toBe('var(--k-tt-num) calc(118px * var(--k-density)) calc(150px * var(--k-density)) minmax(0, 1fr) calc(50px * var(--k-density))')
  })

  it('numbered — колонка «№» (для скринридера) с номерами строк с единицы', () => {
    renderK(<MiniTable label="Статусы" columns={COLS} rows={EVENTS} rowKey={byCode} empty="Статусов нет" numbered />)
    expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('№')
    const [, first, second] = screen.getAllByRole('row')
    expect(within(first!).getAllByRole('cell')[0]).toHaveTextContent('1')
    expect(within(second!).getAllByRole('cell')[0]).toHaveTextContent('2')
  })

  it('пустой заголовок — пустая ячейка шапки, не columnheader; все пустые — шапки нет', () => {
    const cols: MiniColumn<Ev>[] = [...COLS.slice(0, 2), { id: 'link', header: '', width: 120, render: () => 'Исходное сообщение' }]
    const { unmount } = renderK(<MiniTable label="Нотификации" columns={cols} rows={EVENTS} rowKey={byCode} empty="Нотификаций нет" />)
    expect(screen.getAllByRole('columnheader')).toHaveLength(2)
    expect(screen.getAllByRole('row')).toHaveLength(3)
    unmount()
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" />)
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
    expect(screen.getAllByRole('row')).toHaveLength(2)
  })

  it('пусто — текст эталона вместо таблицы, полоса над таблицей остаётся', () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={[]} rowKey={byId} empty="Задач нет" toolbar={<><span>0 задач</span><button type="button">Перейти</button></>} />)
    expect(screen.getByText('Задач нет')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText('0 задач')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Перейти' })).toBeInTheDocument()
  })

  it('раскрытие без управления: defaultExpanded, кнопка-шеврон с aria-expanded/aria-controls, панель под строкой', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" defaultExpanded={['t2']} renderExpanded={(r) => <p>{r.history}</p>} />)
    const b1 = toggleOf('Подтвердить маршрут')
    const b2 = toggleOf('Проверить тариф')
    expect(b1).toHaveAttribute('aria-expanded', 'false')
    expect(b2).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(b2.getAttribute('aria-controls')!)).toHaveTextContent('Создана · система')
    expect(screen.queryByText('Назначена · Иванова')).toBeNull()
    await userEvent.click(b1)
    expect(b1).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById(b1.getAttribute('aria-controls')!)).toHaveTextContent('Назначена · Иванова')
    await userEvent.click(b2)
    expect(b2).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById(b2.getAttribute('aria-controls')!)).not.toBeVisible()
  })

  it('имя переключателя — «Раскрыть»/«Свернуть» и rowLabel строки', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} rowLabel={(r) => r.text} />)
    await userEvent.click(screen.getByRole('button', { name: 'Раскрыть Подтвердить маршрут' }))
    expect(screen.getByRole('button', { name: 'Свернуть Подтвердить маршрут' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Раскрыть Проверить тариф' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('без rowLabel — «Раскрыть строку N» с номером строки с единицы', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} />)
    expect(screen.getByRole('button', { name: 'Раскрыть строку 1' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Раскрыть строку 2' }))
    expect(screen.getByRole('button', { name: 'Свернуть строку 2' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('клик по строке раскрывает и сворачивает её; по ссылке и кнопке внутри строки — нет', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} />)
    await userEvent.click(screen.getByText('Подтвердить маршрут'))
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(screen.getByText('Подтвердить маршрут'))
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(within(rowOf('Проверить тариф')).getByRole('link', { name: 'История' }))
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(within(rowOf('Проверить тариф')).getByRole('button', { name: 'Действие' }))
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'false')
  })

  it('выделение текста мышью строку не раскрывает', () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} />)
    const cell = screen.getByText('Подтвердить маршрут')
    window.getSelection()!.selectAllChildren(cell)
    try {
      fireEvent.click(cell)
      expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'false')
    } finally {
      // упавшая проверка не должна оставлять выделение соседним тестам
      window.getSelection()!.removeAllRanges()
    }
  })

  it('строки пришли после пустого первого рендера — клик по строке раскрывает', async () => {
    const props = { label: 'Задачи', columns: TASK_COLS, rowKey: byId, empty: 'Задач нет', renderExpanded: (r: Task) => r.history }
    const { rerender } = renderK(<MiniTable {...props} rows={[]} />)
    rerender(<MiniTable {...props} rows={TASKS} />)
    await userEvent.click(screen.getByText('Подтвердить маршрут'))
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'true')
  })

  it('клавиатура: Tab до шеврона, Enter и Space переключают', async () => {
    renderK(<MiniTable label="Задачи" columns={TASK_COLS.slice(0, 1)} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} />)
    await userEvent.tab()
    const b1 = toggleOf('Подтвердить маршрут')
    expect(b1).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(b1).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard(' ')
    expect(b1).toHaveAttribute('aria-expanded', 'false')
  })

  it('управляемый режим: состояние — из expanded, клик только сообщает новый набор', async () => {
    const onChange = vi.fn()
    const { rerender } = renderK(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history}
      expanded={['t1']} onExpandedChange={onChange} />)
    await userEvent.click(toggleOf('Проверить тариф'))
    // новый ключ — в конец набора, снятый — удаляется
    expect(onChange).toHaveBeenLastCalledWith(['t1', 't2'])
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(toggleOf('Подтвердить маршрут'))
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'true')
    rerender(<MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history}
      expanded={['t2']} onExpandedChange={onChange} />)
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'false')
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'true')
  })

  it('управляемый режим с хозяином состояния — раскрытие переживает перемонтирование таблицы', async () => {
    function Host() {
      const [keys, setKeys] = useState<string[]>([])
      const [shown, setShown] = useState(true)
      return (
        <>
          <button type="button" onClick={() => setShown((v) => !v)}>Вкладка</button>
          {shown && <MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" renderExpanded={(r) => r.history} expanded={keys} onExpandedChange={setKeys} />}
        </>
      )
    }
    renderK(<Host />)
    await userEvent.click(toggleOf('Проверить тариф'))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    expect(toggleOf('Проверить тариф')).toHaveAttribute('aria-expanded', 'true')
  })

  it('клик по строке вложенной раскрываемой таблицы раскрывает её строку, внешнюю не трогает', async () => {
    const inner = (r: Task) => (
      <MiniTable label={`История ${r.id}`} columns={[{ id: 'h', header: '', render: (x: Task) => x.history }]} rows={[r]} rowKey={byId} empty="—"
        renderExpanded={() => 'подробности'} />
    )
    renderK(<MiniTable label="Связанные" columns={TASK_COLS.slice(0, 1)} rows={TASKS} rowKey={byId} empty="—" defaultExpanded={['t1']} renderExpanded={inner} />)
    const nested = screen.getByRole('table', { name: 'История t1' })
    await userEvent.click(within(nested).getByText('Назначена · Иванова'))
    expect(within(nested).getByRole('button', { name: 'Свернуть строку 1' })).toHaveAttribute('aria-expanded', 'true')
    expect(toggleOf('Подтвердить маршрут')).toHaveAttribute('aria-expanded', 'true')
  })

  it('без нарушений axe: простая, с номерами и пустым заголовком, раскрываемая с открытой строкой, пустая', async () => {
    const cols: MiniColumn<Ev>[] = [...COLS, { id: 'link', header: '', width: 120, render: () => <a href="#src">Исходное сообщение</a> }]
    const { container } = renderK(<>
      <MiniTable label="Статусы" columns={cols} rows={EVENTS} rowKey={byCode} empty="Статусов нет" numbered />
      <MiniTable label="Задачи" columns={TASK_COLS} rows={TASKS} rowKey={byId} empty="Задач нет" defaultExpanded={['t1']} renderExpanded={(r) => r.history}
        toolbar={<><span>2 задачи</span><button type="button">Перейти</button></>} />
      <MiniTable label="Стриминг" columns={COLS} rows={[]} rowKey={byCode} empty="Событий стриминга нет" />
    </>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
