import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { vi } from 'vitest'
import { ConfigForm, Drawer, DrawerStack } from '@katran/ui'
import type { Rates } from '../../../shared/api'
import type { DetailLookups, LookupView } from '../../../shared/lib/detail'
import { renderK } from '../../../shared/lib/test'
import { FX_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseFxDocDetail } from '../api/detail.mapper'
import { fxDocDetailDomain as dom } from './detail'
import { RatesView } from './RatesView'

const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
const RATES: Rates = {
  cb: { rate: '92,4517', date: '2026-09-22', rub: '138 723,84' },
  deal: { rate: '1,0886', from: 'EUR', to: 'USD', amount: '1 378,75' },
}
const viewOf = (over: Partial<LookupView<Rates>> = {}): LookupView<Rates> => ({
  state: 'idle', value: null, error: null, load: vi.fn(), retry: vi.fn(), refresh: vi.fn(), ...over,
})

describe('RatesView (спека 2e §4 п. 6, 8)', () => {
  it('ready с deal: курс ЦБ на дату, рублёвый эквивалент, курс сделки', () => {
    const { container } = renderK(<RatesView view={viewOf({ state: 'ready', value: RATES })} ccy="USD" />)
    const lines = Array.from(container.querySelectorAll('p')).map((p) => p.textContent)
    expect(lines).toEqual([
      'Курс ЦБ на 22.09.2026 — 92,4517 RUB за 1 USD',
      'Рублёвый эквивалент — 138 723,84 RUB',
      'Курс сделки EUR→USD — 1,0886 · списано 1 378,75 EUR',
    ])
  })

  it('без deal — третьей строки нет', () => {
    const { container } = renderK(<RatesView view={viewOf({ state: 'ready', value: { ...RATES, deal: null } })} ccy="USD" />)
    expect(container.querySelectorAll('p')).toHaveLength(2)
    expect(container).not.toHaveTextContent('Курс сделки')
  })

  it('loading — скелетон с aria-busy; error — текст и «Повторить» (retry)', async () => {
    const { container, rerender } = renderK(<RatesView view={viewOf({ state: 'loading' })} ccy="USD" />)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(container).not.toHaveTextContent('Курс ЦБ')
    const view = viewOf({ state: 'error', error: 'Курс недоступен' })
    rerender(<RatesView view={view} ccy="USD" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Курс недоступен')
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(view.retry).toHaveBeenCalledTimes(1)
  })
})

/** Сводка в drawer под DrawerStack: Esc поповера не должен дойти до деталки. */
function renderHero(lookups: DetailLookups | null) {
  const onEscape = vi.fn()
  const onKeyDown = vi.fn()
  const form = (
    <ConfigForm schema={dom.schemaOf(d)} fields={dom.fields} value={(t) => dom.value(d, t)} present={dom.present}
      optionLabels={dom.optionLabels} renderHero={(id) => dom.renderHero(d, id, null, lookups)} renderBlock={(id) => dom.renderBlock(d, id, null, lookups)} />
  )
  const utils = renderK(
    <DrawerStack onEscape={onEscape} items={[{ key: 'd1', slot: 'a', node: <Drawer label="Документ" title="Документ" onClose={vi.fn()} onKeyDown={onKeyDown}>{form}</Drawer> }]} />,
  )
  return { ...utils, onEscape, onKeyDown }
}
const hero = () => document.querySelector('[data-part="hero"]') as HTMLElement

describe('«Курс» в сводке 32A (спека 2e §4 п. 6, 8; Review Focus 5)', () => {
  it('без lookups — кнопки «Курс» нет', () => {
    renderHero(null)
    expect(within(hero()).queryByRole('button', { name: 'Курс' })).toBeNull()
    expect(hero()).toHaveTextContent(/1\s500\.50USD/)
  })

  it('кнопка «Курс» в ячейке 32A: клик открывает поповер «Курс» (dialog) и вызывает load; повторный клик закрывает', async () => {
    const rates = viewOf({ state: 'ready', value: RATES })
    renderHero({ rates })
    const cell = document.querySelector('[data-part="hero"] [data-align="right"]') as HTMLElement
    const btn = within(cell).getByRole('button', { name: 'Курс' })
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(btn)
    const pop = screen.getByRole('dialog', { name: 'Курс' })
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(btn).toHaveAttribute('aria-controls', pop.id)
    expect(rates.load).toHaveBeenCalledTimes(1)
    expect(pop).toHaveTextContent('Курс ЦБ на 22.09.2026 — 92,4517 RUB за 1 USD')
    expect(pop.contains(document.activeElement)).toBe(true)
    await userEvent.click(btn)
    expect(screen.queryByRole('dialog', { name: 'Курс' })).toBeNull()
  })

  it('Esc при загрузке: закрыт только поповер, фокус на «Курс», keydown до drawer не дошёл', async () => {
    const t = renderHero({ rates: viewOf({ state: 'loading' }) })
    const btn = screen.getByRole('button', { name: 'Курс' })
    await userEvent.click(btn)
    const pop = screen.getByRole('dialog', { name: 'Курс' })
    // скелетон без кнопок — фокус всё равно внутри поповера, а не на «Курс» в drawer
    expect(pop.contains(document.activeElement)).toBe(true)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'Курс' })).toBeNull()
    expect(document.activeElement).toBe(btn)
    expect(t.onEscape).not.toHaveBeenCalled()
    expect(t.onKeyDown).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Документ' })).toBeInTheDocument()
    // следующий Esc — уже деталке
    await userEvent.keyboard('{Escape}')
    expect(t.onEscape).toHaveBeenCalledTimes(1)
  })

  it('клик вне — поповер закрыт, фокус на «Курс»', async () => {
    renderHero({ rates: viewOf({ state: 'ready', value: RATES }) })
    const btn = screen.getByRole('button', { name: 'Курс' })
    await userEvent.click(btn)
    await userEvent.click(screen.getByText('32A · сумма'))
    expect(screen.queryByRole('dialog', { name: 'Курс' })).toBeNull()
    expect(document.activeElement).toBe(btn)
  })

  it.each(['loading', 'ready'] as const)('Tab с тела поповера без остановок (%s) — поповер закрыт, фокус на «Курс», деталь открыта', async (state) => {
    const t = renderHero({ rates: viewOf(state === 'ready' ? { state, value: RATES } : { state }) })
    const btn = screen.getByRole('button', { name: 'Курс' })
    await userEvent.click(btn)
    const pop = screen.getByRole('dialog', { name: 'Курс' })
    expect(within(pop).queryAllByRole('button')).toEqual([])
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab' })
    expect(screen.queryByRole('dialog', { name: 'Курс' })).toBeNull()
    expect(document.activeElement).toBe(btn)
    expect(t.onEscape).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Документ' })).toBeInTheDocument()
  })

  it('Shift+Tab с тела поповера — так же: закрыт, фокус на «Курс»', async () => {
    renderHero({ rates: viewOf({ state: 'ready', value: RATES }) })
    const btn = screen.getByRole('button', { name: 'Курс' })
    await userEvent.click(btn)
    fireEvent.keyDown(document.activeElement as Element, { key: 'Tab', shiftKey: true })
    expect(screen.queryByRole('dialog', { name: 'Курс' })).toBeNull()
    expect(document.activeElement).toBe(btn)
  })

  it('без нарушений axe: открытый поповер с курсом сделки', async () => {
    const { baseElement } = renderHero({ rates: viewOf({ state: 'ready', value: RATES }) })
    await userEvent.click(screen.getByRole('button', { name: 'Курс' }))
    expect(await axe(baseElement)).toHaveNoViolations()
  })
})
