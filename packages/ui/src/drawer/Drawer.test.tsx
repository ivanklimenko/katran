import { useRef, useState, type ReactNode } from 'react'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Menu } from '../overlay'
import { Tooltip } from '../tooltip'
import { Drawer } from './Drawer'
import { DrawerStack, type DrawerStackItem } from './DrawerStack'

type Open = { a: string | null; b: string | null }

/** Стенд теста: две кнопки открытия, стек, внешний «грид» с собственным Esc (как ячейка DataGrid). */
function Host({ start = { a: null, b: null }, extra }: { start?: Open; extra?: ReactNode }) {
  const [open, setOpen] = useState<Open>(start)
  const [tick, setTick] = useState(0)
  const opener = useRef<HTMLButtonElement>(null)
  const pane = (slot: 'a' | 'b', id: string) => (
    <Drawer
      label={`Документ ${id}`}
      title="Платёжная инструкция"
      meta={<span>uuid-{id}</span>}
      badge={slot === 'b' ? { text: 'B · сравнение', tone: 'b' } : { text: 'A', tone: 'a' }}
      onClose={() => setOpen((o) => (slot === 'b' ? { a: o.a, b: null } : { a: o.b, b: null }))}
      returnFocus={() => opener.current}
      focusKey={tick}
    >
      <input aria-label={`Поле ${id}`} />
      {extra}
    </Drawer>
  )
  const items: DrawerStackItem[] = []
  if (open.a) items.push({ key: open.a, slot: 'a', node: pane('a', open.a) })
  if (open.b) items.push({ key: open.b, slot: 'b', node: pane('b', open.b) })
  return (
    <>
      <button ref={opener} onClick={() => setOpen((o) => ({ ...o, a: 'd1' }))}>Открыть d1</button>
      <button onClick={() => setOpen((o) => ({ ...o, b: 'd2' }))}>Открыть d2 рядом</button>
      <button onClick={() => setTick((t) => t + 1)}>Фокус</button>
      {/* ячейка грида гасит Esc сама (useGridKeyboard) — деталка перехватывает раньше, в фазе захвата */}
      <div role="grid" aria-label="Грид"><div role="row"><div role="gridcell" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Escape') e.stopPropagation() }}>Ячейка</div></div></div>
      <DrawerStack items={items} onEscape={() => setOpen((o) => (o.b ? { a: o.a, b: null } : { a: null, b: null }))} />
    </>
  )
}

const names = () => screen.queryAllByRole('dialog').map((d) => d.getAttribute('aria-label'))

describe('Drawer / DrawerStack (спека 2a §3.1)', () => {
  it('открытие: dialog с именем без aria-modal, фокус в заголовке', async () => {
    renderK(<Host />)
    await userEvent.click(screen.getByText('Открыть d1'))
    const d = screen.getByRole('dialog', { name: 'Документ d1' })
    expect(d).not.toHaveAttribute('aria-modal')
    expect(d).toHaveAttribute('data-k-drawer')
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
    expect(d).toHaveTextContent('uuid-d1')
  })

  it('«Закрыть» закрывает и возвращает фокус туда, откуда открыли', async () => {
    renderK(<Host />)
    await userEvent.click(screen.getByText('Открыть d1'))
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Открыть d1')).toHaveFocus()
  })

  it('B слева от A: в DOM сначала B; пустой слот не рендерится', () => {
    renderK(<Host start={{ a: 'd1', b: 'd2' }} />)
    expect(names()).toEqual(['Документ d2', 'Документ d1'])
    expect(screen.getByText('B · сравнение')).toBeInTheDocument()
    expect(screen.getByText('A')).toBeInTheDocument()
  })

  it('без открытых — ничего не рендерится', () => {
    renderK(<Host />)
    expect(names()).toEqual([])
  })

  it('Esc закрывает верхний: сначала B, потом A', async () => {
    renderK(<Host start={{ a: 'd1', b: 'd2' }} />)
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual(['Документ d1'])
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual([])
  })

  it('Esc в поле ввода не закрывает', async () => {
    renderK(<Host start={{ a: 'd1', b: null }} />)
    await userEvent.click(screen.getByLabelText('Поле d1'))
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual(['Документ d1'])
  })

  it('Esc из ячейки, гасящей Esc сама, всё равно закрывает деталку (фаза захвата)', async () => {
    renderK(<Host start={{ a: 'd1', b: null }} />)
    screen.getByText('Ячейка').focus()
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual([])
  })

  it('Esc в открытом меню закрывает меню, а не drawer', async () => {
    function PrintMenu() {
      const [open, setOpen] = useState(false)
      const anchor = useRef<HTMLButtonElement>(null)
      return (
        <>
          <button ref={anchor} onClick={() => setOpen(true)}>Печать</button>
          <Menu open={open} anchor={anchor} onClose={() => setOpen(false)} items={[{ id: 'p', label: 'Платёжное поручение' }]} />
        </>
      )
    }
    renderK(<Host start={{ a: 'd1', b: null }} extra={<PrintMenu />} />)
    await userEvent.click(screen.getByText('Печать'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(names()).toEqual(['Документ d1'])
    await userEvent.keyboard('{Escape}')
    expect(names()).toEqual([])
  })

  it('Esc при видимом тултипе прячет тултип, а не drawer; второй Esc закрывает drawer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      renderK(<Host start={{ a: 'd1', b: null }} extra={<Tooltip content="Скопировать uuid"><button>uuid</button></Tooltip>} />)
      act(() => { screen.getByRole('button', { name: 'uuid' }).focus() })
      act(() => { vi.advanceTimersByTime(250) })
      expect(screen.getByRole('tooltip')).toHaveTextContent('Скопировать uuid')
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('tooltip')).toBeNull()
      expect(names()).toEqual(['Документ d1'])
      await user.keyboard('{Escape}')
      expect(names()).toEqual([])
    } finally {
      vi.useRealTimers()
    }
  })

  it('focusKey возвращает фокус в заголовок (повторное открытие открытого)', async () => {
    renderK(<Host start={{ a: 'd1', b: null }} />)
    await userEvent.click(screen.getByLabelText('Поле d1'))
    await userEvent.click(screen.getByText('Фокус'))
    expect(screen.getByRole('heading', { name: 'Платёжная инструкция' })).toHaveFocus()
  })

  it('без нарушений axe (A и B)', async () => {
    const { container } = renderK(<Host start={{ a: 'd1', b: 'd2' }} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
