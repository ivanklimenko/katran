import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { exitOnEdgeTab } from './edgeTab'

/** Кнопка-триггер и «поповер»: обёртка с onKeyDown, внутри — держатель фокуса (tabIndex -1) с остановками или без. */
function Host({ stops }: { stops: string[] }) {
  const [open, setOpen] = useState(true)
  const btn = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={btn} type="button">триггер</button>
      {open && (
        <div role="presentation" onKeyDown={(e) => exitOnEdgeTab(e, btn, () => setOpen(false))}>
          <div tabIndex={-1} data-testid="body">
            {stops.map((s) => <button key={s} type="button">{s}</button>)}
          </div>
        </div>
      )}
    </>
  )
}

describe('exitOnEdgeTab: фокус на держателе — содержимом с tabIndex -1, внутри которого все остановки', () => {
  it('остановок нет — Tab и Shift+Tab с содержимого закрывают, фокус на триггере', () => {
    for (const shiftKey of [false, true]) {
      const { unmount } = render(<Host stops={[]} />)
      const body = screen.getByTestId('body')
      body.focus()
      fireEvent.keyDown(body, { key: 'Tab', shiftKey })
      expect(screen.queryByTestId('body')).toBeNull()
      expect(screen.getByRole('button', { name: 'триггер' })).toHaveFocus()
      unmount()
    }
  })

  it('остановки есть — Shift+Tab с содержимого закрывает; Tab с содержимого — нет (браузер идёт к первой остановке)', () => {
    const { unmount } = render(<Host stops={['а', 'б']} />)
    const body = screen.getByTestId('body')
    body.focus()
    fireEvent.keyDown(body, { key: 'Tab' })
    expect(screen.getByTestId('body')).toBeInTheDocument()
    fireEvent.keyDown(body, { key: 'Tab', shiftKey: true })
    expect(screen.queryByTestId('body')).toBeNull()
    expect(screen.getByRole('button', { name: 'триггер' })).toHaveFocus()
    unmount()
  })

  it('с остановок — как прежде: Tab с последней и Shift+Tab с первой закрывают, изнутри — нет', () => {
    const { unmount } = render(<Host stops={['а', 'б']} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'а' }), { key: 'Tab' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'б' }), { key: 'Tab', shiftKey: true })
    expect(screen.getByTestId('body')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: 'б' }), { key: 'Tab' })
    expect(screen.queryByTestId('body')).toBeNull()
    unmount()
    render(<Host stops={['а', 'б']} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'а' }), { key: 'Tab', shiftKey: true })
    expect(screen.queryByTestId('body')).toBeNull()
    expect(screen.getByRole('button', { name: 'триггер' })).toHaveFocus()
  })
})
