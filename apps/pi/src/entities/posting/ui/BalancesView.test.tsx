import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { vi } from 'vitest'
import { Drawer, DrawerStack } from '@katran/ui'
import type { Balances } from '../../../shared/api'
import type { LookupView } from '../../../shared/lib/detail'
import { renderK } from '../../../shared/lib/test'
import type { Tx } from '../model/posting'
import { BalancesView } from './BalancesView'
import { TxBlock } from './TxBlock'

const BAL: Balances = {
  asOf: '2026-10-07T10:00:00',
  items: [
    { acc: '30110840700000001842', ccy: 'USD', balance: '1 500 250,00', available: '1 480 250,00' },
    { acc: '40817840500010042371', ccy: 'USD', balance: '12 000,00', available: null },
    { acc: '47422840500000000311', ccy: 'USD', error: 'Счёт временно недоступен' },
  ],
}
const viewOf = (over: Partial<LookupView<Balances>> = {}): LookupView<Balances> => ({
  state: 'idle', value: null, error: null, load: vi.fn(), retry: vi.fn(), refresh: vi.fn(), ...over,
})
const cells = (row: HTMLElement) => within(row).getAllByRole(/cell|rowheader/).map((c) => c.textContent)

describe('BalancesView (спека 2e §4 п. 7, 8)', () => {
  it('таблица «Счёт · Валюта · Остаток · Доступно»; available null — «—»; подпись «по состоянию на»', () => {
    renderK(<BalancesView view={viewOf({ state: 'ready', value: BAL })} />)
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Счёт', 'Валюта', 'Остаток', 'Доступно'])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(cells(rows[0]!)).toEqual(['30110840700000001842', 'USD', '1 500 250,00', '1 480 250,00'])
    expect(cells(rows[1]!)).toEqual(['40817840500010042371', 'USD', '12 000,00', '—'])
    expect(screen.getByText(/^по состоянию на/)).toHaveTextContent('по состоянию на 07.10.2026 10:00:00')
  })

  it('строка счёта с ошибкой — текст ошибки ячейкой на всю ширину после счёта', () => {
    renderK(<BalancesView view={viewOf({ state: 'ready', value: BAL })} />)
    const row = screen.getAllByRole('row')[3]!
    expect(cells(row)).toEqual(['47422840500000000311', 'Счёт временно недоступен'])
    expect(within(row).getByRole('cell')).toHaveAttribute('colspan', '3')
  })

  it('«Обновить» вызывает refresh; во время обновления старая таблица видна, «Обновить» занята', async () => {
    const view = viewOf({ state: 'ready', value: BAL })
    const { rerender } = renderK(<BalancesView view={view} />)
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(view.refresh).toHaveBeenCalledTimes(1)
    rerender(<BalancesView view={viewOf({ state: 'loading', value: BAL })} />)
    expect(screen.getByRole('table')).toHaveTextContent('1 500 250,00')
    expect(screen.getByRole('button', { name: 'Обновить' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Обновить' })).toHaveAttribute('aria-disabled', 'true')
  })

  it('Review Focus 3: неудачное «Обновить» — старая таблица видна, под ней текст ошибки и «Повторить» (retry)', async () => {
    const view = viewOf({ state: 'error', value: BAL, error: 'Остатки недоступны' })
    renderK(<BalancesView view={view} />)
    expect(screen.getByRole('table')).toHaveTextContent('1 500 250,00')
    expect(screen.getByRole('alert')).toHaveTextContent('Остатки недоступны')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(view.retry).toHaveBeenCalledTimes(1)
  })

  it('loading без данных — скелетон (aria-busy); error без данных — текст и «Повторить»', async () => {
    const { container, rerender } = renderK(<BalancesView view={viewOf({ state: 'loading' })} />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    const view = viewOf({ state: 'error', error: 'Сеть недоступна' })
    rerender(<BalancesView view={view} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Сеть недоступна')
    expect(screen.queryByRole('table')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(view.retry).toHaveBeenCalledTimes(1)
  })
})

const TXS: Tx[] = [{ dir: 'DEBIT', acc: '30110840700000001842', amount: 1500.5, currency: 'USD', st: 'EXECUTED', reg: 'MAIN', time: '2026-09-23T10:52:11' }]

function renderTx(balances?: LookupView<Balances>) {
  const onEscape = vi.fn()
  const onKeyDown = vi.fn()
  const ui = (b?: LookupView<Balances>) => (
    <DrawerStack onEscape={onEscape} items={[{ key: 'd1', slot: 'a', node: <Drawer label="Документ" title="Документ" onClose={vi.fn()} onKeyDown={onKeyDown}><TxBlock txs={TXS} txId="TX1" txAt="2026-09-23T10:52:11" balances={b} /></Drawer> }]} />
  )
  const utils = renderK(ui(balances))
  return { ...utils, onEscape, onKeyDown, rerenderWith: (b: LookupView<Balances>) => { utils.rerender(ui(b)) } }
}

describe('«Проверить баланс» в блоке «Транзакции» (спека 2e §4 п. 7, 8)', () => {
  it('без balances — ссылки нет', () => {
    renderTx()
    expect(screen.queryByRole('button', { name: 'Проверить баланс' })).toBeNull()
  })

  it('клик, Enter и Space по ссылке не меняют aria-expanded блока; поповер — load, таблица', async () => {
    const balances = viewOf({ state: 'ready', value: BAL })
    renderTx(balances)
    const head = screen.getByRole('button', { name: 'Транзакции' })
    const link = screen.getByRole('button', { name: 'Проверить баланс' })
    expect(head).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(link)
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(balances.load).toHaveBeenCalledTimes(1)
    const pop = screen.getByRole('dialog', { name: 'Проверить баланс' })
    expect(within(pop).getByRole('table')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(document.activeElement).toBe(link)
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'Проверить баланс' })).toBeInTheDocument()
    expect(head).toHaveAttribute('aria-expanded', 'false')
    await userEvent.keyboard('{Escape}')
    link.focus()
    await userEvent.keyboard(' ')
    expect(screen.getByRole('dialog', { name: 'Проверить баланс' })).toBeInTheDocument()
    expect(head).toHaveAttribute('aria-expanded', 'false')
  })

  it('Esc в поповере закрывает только его: деталь открыта, фокус на ссылке', async () => {
    const t = renderTx(viewOf({ state: 'ready', value: BAL }))
    const link = screen.getByRole('button', { name: 'Проверить баланс' })
    await userEvent.click(link)
    expect(screen.getByRole('dialog', { name: 'Проверить баланс' }).contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Проверить баланс' })).toBeNull()
    expect(t.onEscape).not.toHaveBeenCalled()
    expect(t.onKeyDown).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(link)
  })

  it('первое открытие при idle — один load; запись снята при открытом поповере (reset → idle) — load снова, не вечный скелетон', async () => {
    const first = viewOf()
    const t = renderTx(first)
    await userEvent.click(screen.getByRole('button', { name: 'Проверить баланс' }))
    expect(first.load).toHaveBeenCalledTimes(1)
    const ready = viewOf({ state: 'ready', value: BAL })
    t.rerenderWith(ready)
    expect(ready.load).not.toHaveBeenCalled()
    const afterReset = viewOf()
    t.rerenderWith(afterReset)
    expect(afterReset.load).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: 'Проверить баланс' })).toBeInTheDocument()
  })

  it('закрытый поповер при idle не грузит', () => {
    const view = viewOf()
    renderTx(view)
    expect(view.load).not.toHaveBeenCalled()
  })

  it('«Повторить» пропала после нажатия — фокус остаётся в поповере, Esc закрывает только его', async () => {
    const view = viewOf({ state: 'error', error: 'Сеть недоступна' })
    const t = renderTx(view)
    await userEvent.click(screen.getByRole('button', { name: 'Проверить баланс' }))
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(view.retry).toHaveBeenCalledTimes(1)
    t.rerenderWith(viewOf({ state: 'loading' }))
    const pop = screen.getByRole('dialog', { name: 'Проверить баланс' })
    expect(within(pop).queryByRole('button', { name: 'Повторить' })).toBeNull()
    expect(pop.contains(document.activeElement)).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Проверить баланс' })).toBeNull()
    expect(t.onEscape).not.toHaveBeenCalled()
  })

  it.each([false, true])('Tab с «Обновить» (shift %s) — единственная остановка и первая, и последняя: поповер закрыт, фокус на ссылке', async (shiftKey) => {
    const t = renderTx(viewOf({ state: 'ready', value: BAL }))
    const link = screen.getByRole('button', { name: 'Проверить баланс' })
    await userEvent.click(link)
    const refresh = screen.getByRole('button', { name: 'Обновить' })
    refresh.focus()
    fireEvent.keyDown(refresh, { key: 'Tab', shiftKey })
    expect(screen.queryByRole('dialog', { name: 'Проверить баланс' })).toBeNull()
    expect(document.activeElement).toBe(link)
    expect(t.onEscape).not.toHaveBeenCalled()
  })

  it('Tab с «Повторить» в ошибке — поповер закрыт, фокус на ссылке', async () => {
    renderTx(viewOf({ state: 'error', error: 'Сеть недоступна' }))
    const link = screen.getByRole('button', { name: 'Проверить баланс' })
    await userEvent.click(link)
    const retry = screen.getByRole('button', { name: 'Повторить' })
    retry.focus()
    fireEvent.keyDown(retry, { key: 'Tab' })
    expect(screen.queryByRole('dialog', { name: 'Проверить баланс' })).toBeNull()
    expect(document.activeElement).toBe(link)
  })

  it('с тела: Shift+Tab — за край (закрыт, фокус на ссылке); Tab при остановках — к первой остановке, поповер открыт', async () => {
    renderTx(viewOf({ state: 'ready', value: BAL }))
    const link = screen.getByRole('button', { name: 'Проверить баланс' })
    await userEvent.click(link)
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Обновить' })).toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Проверить баланс' })).toBeInTheDocument()
    await userEvent.click(link)
    await userEvent.click(link)
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true })
    expect(screen.queryByRole('dialog', { name: 'Проверить баланс' })).toBeNull()
    expect(document.activeElement).toBe(link)
  })

  it('без нарушений axe: открытый поповер с ошибкой счёта и ошибкой обновления', async () => {
    const { baseElement } = renderTx(viewOf({ state: 'error', value: BAL, error: 'Остатки недоступны' }))
    await userEvent.click(screen.getByRole('button', { name: 'Проверить баланс' }))
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
