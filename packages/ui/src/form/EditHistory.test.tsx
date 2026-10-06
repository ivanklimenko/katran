import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { EditHistory, type EditHistoryEntry } from './EditHistory'

const entries: EditHistoryEntry[] = [
  { who: 'Кузнецов Д. А.', when: '22.09.2026 09:15', status: 'confirmed', by: 'Смирнова Е. В.', at: '22.09.2026 09:40', note: 'BIC филиала по справочнику', diff: [{ label: '2/', was: 'VKRBRU8KXXX', now: 'VKRBRU8K2KD' }] },
  { who: 'Иванова М. П.', when: '22.09.2026 10:42', status: 'pending', note: 'Полное наименование филиала', diff: [] },
]

describe('EditHistory', () => {
  it('сводка: «2 изменения», люди, бейдж по последней записи', () => {
    renderK(<EditHistory entries={entries} label="поля 57" />)
    expect(screen.getByText('2 изменения')).toBeInTheDocument()
    expect(screen.getByText('Кузнецов Д. А., Иванова М. П.')).toBeInTheDocument()
    expect(screen.getByText('ожидает утверждения')).toHaveAttribute('data-badge', 'wait')
    expect(screen.queryByRole('list')).toBeNull()
  })
  it('сводка: последняя утверждена — «утверждено»; повторяющиеся люди — один раз', () => {
    const one: EditHistoryEntry = { ...entries[0]! }
    renderK(<EditHistory entries={[one, one]} label="поля 57" />)
    expect(screen.getByText('Кузнецов Д. А.')).toBeInTheDocument()
    expect(screen.getByText('утверждено')).toHaveAttribute('data-badge', 'ok')
  })
  it('«История» раскрывает список, «Свернуть историю» сворачивает; aria-expanded/aria-controls', async () => {
    const user = userEvent.setup()
    renderK(<EditHistory entries={entries} label="поля 57" />)
    const btn = screen.getByRole('button', { name: 'История' })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    await user.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(btn).toHaveAccessibleName('Свернуть историю')
    const list = screen.getByRole('list', { name: 'История изменений поля 57' })
    expect(btn).toHaveAttribute('aria-controls', list.id)
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    await user.click(btn)
    expect(screen.getByRole('button', { name: 'История' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('list')).toBeNull()
  })
  it('запись: кто, время, бейдж «утверждено» с тултипом «Утвердил(а) Смирнова Е. В., 22.09.2026 09:40», примечание, дифф было/стало', async () => {
    const user = userEvent.setup()
    renderK(<EditHistory entries={entries} label="поля 57" />)
    await user.click(screen.getByRole('button', { name: 'История' }))
    const [first, second] = within(screen.getByRole('list')).getAllByRole('listitem')
    const a = within(first!)
    expect(a.getByText('Кузнецов Д. А.')).toBeInTheDocument()
    expect(a.getByText('22.09.2026 09:15')).toBeInTheDocument()
    const ok = a.getByText('утверждено')
    expect(ok).toHaveAttribute('data-badge', 'ok')
    expect(ok.closest('[data-k-tip]')).toHaveAttribute('data-k-tip', 'Утвердил(а) Смирнова Е. В., 22.09.2026 09:40')
    expect(a.getByText('BIC филиала по справочнику')).toBeInTheDocument()
    expect(a.getByText('VKRBRU8KXXX').tagName).toBe('S')
    expect(a.getByText('VKRBRU8K2KD').tagName).toBe('B')
    expect(a.getByText('VKRBRU8KXXX').parentElement).toHaveTextContent(/^2\/ VKRBRU8KXXX → VKRBRU8K2KD$/)
    expect(first).toHaveAttribute('data-status', 'confirmed')
    const b = within(second!)
    expect(b.getByText('ожидает')).toHaveAttribute('data-badge', 'wait')
    expect(b.getByText('ожидает').closest('[data-k-tip]')).toBeNull()
    expect(second).toHaveAttribute('data-status', 'pending')
  })
  it('пустой дифф — «без изменений»; пустой список — ничего', async () => {
    const user = userEvent.setup()
    const { rerender } = renderK(<EditHistory entries={entries} label="поля 57" />)
    await user.click(screen.getByRole('button', { name: 'История' }))
    const second = within(screen.getByRole('list')).getAllByRole('listitem')[1]!
    expect(within(second).getByText('без изменений')).toBeInTheDocument()
    rerender(<EditHistory entries={[]} label="поля 57" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByText(/изменени/)).toBeNull()
  })
  it('пустая сторона строки диффа — «—», строка без метки — без префикса', async () => {
    const user = userEvent.setup()
    renderK(<EditHistory entries={[{ who: 'Вы', when: '22.09.2026 10:42', status: 'pending', diff: [{ label: '', was: '', now: 'NEW' }] }]} label="поля 72" />)
    await user.click(screen.getByRole('button', { name: 'История' }))
    expect(screen.getByText('NEW').parentElement).toHaveTextContent(/^— → NEW$/)
  })
  it('axe без нарушений в раскрытом виде', async () => {
    const user = userEvent.setup()
    const { container } = renderK(<EditHistory entries={entries} label="поля 57" />)
    expect(await axe(container)).toHaveNoViolations()
    await user.click(screen.getByRole('button', { name: 'История' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('EditHistory: решение второй руки и rejected (спека 2d §2.1)', () => {
  const pendingLast: EditHistoryEntry[] = [
    { who: 'Иванова М. П.', when: '21.09.2026 08:00', status: 'pending', diff: [] },
    { who: 'Иванова М. П.', when: '22.09.2026 10:42', status: 'pending', diff: [] },
  ]
  const open = async () => { await userEvent.click(screen.getByRole('button', { name: 'История' })) }

  it('обработчики заданы, последняя pending — «Утвердить» и «Отклонить» только в последней записи; клик вызывает обработчик', async () => {
    const onConfirm = vi.fn()
    const onReject = vi.fn()
    renderK(<EditHistory entries={pendingLast} label="поля 57" onConfirm={onConfirm} onReject={onReject} />)
    await open()
    const [first, last] = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(within(first!).queryAllByRole('button')).toHaveLength(0)
    expect(within(last!).getAllByRole('button').map((b) => b.textContent)).toEqual(['Утвердить', 'Отклонить'])
    await userEvent.click(within(last!).getByRole('button', { name: 'Утвердить' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    await userEvent.click(within(last!).getByRole('button', { name: 'Отклонить' }))
    expect(onReject).toHaveBeenCalledTimes(1)
  })

  it('подписи — свойствами confirmLabel/rejectLabel; задан один обработчик — одна кнопка', async () => {
    renderK(<EditHistory entries={pendingLast} label="поля 57" onReject={vi.fn()} rejectLabel="Вернуть" confirmLabel="Принять" />)
    await open()
    const last = within(screen.getByRole('list')).getAllByRole('listitem')[1]!
    expect(within(last).getAllByRole('button').map((b) => b.textContent)).toEqual(['Вернуть'])
  })

  it('последняя confirmed — кнопок нет; обработчики не заданы — кнопок нет', async () => {
    const { rerender } = renderK(<EditHistory entries={entries.slice(0, 1)} label="поля 57" onConfirm={vi.fn()} onReject={vi.fn()} />)
    await open()
    expect(within(screen.getByRole('list')).queryAllByRole('button')).toHaveLength(0)
    rerender(<EditHistory entries={pendingLast} label="поля 57" />)
    expect(within(screen.getByRole('list')).queryAllByRole('button')).toHaveLength(0)
  })

  it('rejected: бейдж «отклонено» (bad), подсказка «Отклонил(а) …», строка «Причина: …», примечание автора', async () => {
    const rej: EditHistoryEntry = {
      who: 'Иванова М. П.', when: '22.09.2026 10:42', status: 'rejected', by: 'Смирнова Е. В.', at: '23.09.2026 10:00',
      note: 'Полное наименование филиала', reason: 'BIC не по справочнику', diff: [],
    }
    renderK(<EditHistory entries={[rej]} label="поля 57" onConfirm={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText('отклонено')).toHaveAttribute('data-badge', 'bad')
    await open()
    const item = within(screen.getByRole('list')).getByRole('listitem')
    expect(item).toHaveAttribute('data-status', 'rejected')
    const badge = within(item).getByText('отклонено')
    expect(badge).toHaveAttribute('data-badge', 'bad')
    expect(badge.closest('[data-k-tip]')).toHaveAttribute('data-k-tip', 'Отклонил(а) Смирнова Е. В., 23.09.2026 10:00')
    expect(within(item).getByText('Причина: BIC не по справочнику')).toBeInTheDocument()
    expect(within(item).getByText('Полное наименование филиала')).toBeInTheDocument()
    expect(within(item).queryAllByRole('button')).toHaveLength(0)
  })

  it('axe без нарушений для истории с кнопками', async () => {
    const { container } = renderK(<EditHistory entries={pendingLast} label="поля 57" onConfirm={vi.fn()} onReject={vi.fn()} />)
    await open()
    expect(await axe(container)).toHaveNoViolations()
  })
})
