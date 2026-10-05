import { useState } from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { Prompt, PromptChange } from './Prompt'

describe('Prompt (спека 2c §2.1, эталон prompt.js)', () => {
  it('open=false — ничего', () => {
    renderK(<Prompt open={false} onResult={vi.fn()} />)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('alertdialog, aria-modal, имя — заголовок, описание — note; умолчания prompt.js; порядок кнопок', () => {
    renderK(<Prompt open note="Пояснение" onResult={vi.fn()} />)
    const d = screen.getByRole('alertdialog', { name: 'Подтвердите действие' })
    expect(d).toHaveAttribute('aria-modal', 'true')
    expect(d).toHaveAccessibleDescription('Пояснение')
    expect(within(d).getAllByRole('button').map((b) => b.textContent)).toEqual(['Отмена', 'Подтвердить'])
  })

  it('фокус: neutral — основная, danger — «Отмена»', () => {
    const { rerender } = renderK(<Prompt open okLabel="Утвердить" onResult={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Утвердить' })).toHaveFocus()
    rerender(<Prompt open={false} onResult={vi.fn()} />)
    rerender(<Prompt open tone="danger" onResult={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
  })

  it('Tab и Shift+Tab ходят только между двумя кнопками', async () => {
    renderK(
      <>
        <button>До</button>
        <Prompt open okLabel="Утвердить" onResult={vi.fn()} />
        <button>После</button>
      </>,
    )
    const ok = screen.getByRole('button', { name: 'Утвердить' })
    const cancel = screen.getByRole('button', { name: 'Отмена' })
    expect(ok).toHaveFocus()
    await userEvent.tab()
    expect(cancel).toHaveFocus()
    await userEvent.tab()
    expect(ok).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(cancel).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(ok).toHaveFocus()
  })

  it('Esc → onResult(false), keydown не доходит до родителя', async () => {
    const onResult = vi.fn()
    const parent = vi.fn()
    renderK(<div role="presentation" onKeyDown={parent}><Prompt open onResult={onResult} /></div>)
    await userEvent.keyboard('{Escape}')
    expect(onResult).toHaveBeenCalledWith(false)
    expect(parent).not.toHaveBeenCalled()
  })

  it('mousedown по подложке → false; по коробке — нет', () => {
    const onResult = vi.fn()
    const { container } = renderK(<Prompt open onResult={onResult} />)
    fireEvent.mouseDown(screen.getByRole('alertdialog'))
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Подтвердите действие' }))
    expect(onResult).not.toHaveBeenCalled()
    const scrim = container.querySelector('[data-k-prompt]')
    expect(scrim).not.toBeNull()
    fireEvent.mouseDown(scrim as Element)
    expect(onResult).toHaveBeenCalledTimes(1)
    expect(onResult).toHaveBeenCalledWith(false)
  })

  it('кнопки: «Отмена» → false, основная → true', async () => {
    const onResult = vi.fn()
    renderK(<Prompt open okLabel="Утвердить" onResult={onResult} />)
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    await userEvent.click(screen.getByRole('button', { name: 'Утвердить' }))
    expect(onResult.mock.calls).toEqual([[false], [true]])
  })

  it('закрытие возвращает фокус туда, где он был до открытия', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Сохранить</button>
          <Prompt open={open} onResult={() => setOpen(false)} />
        </>
      )
    }
    renderK(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Сохранить' })).toHaveFocus()
  })

  it('PromptChange: было → стало; axe без нарушений', async () => {
    const { container } = renderK(<Prompt open note={<PromptChange was="23.09.2026" now="24.09.2026" />} onResult={vi.fn()} />)
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('23.09.2026 → 24.09.2026')
    expect(await axe(container)).toHaveNoViolations()
  })
})
