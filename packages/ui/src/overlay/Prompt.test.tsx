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

  it('клик по тексту коробки фокусирует коробку: Tab ведёт на кнопку, Esc — отказ без всплытия', async () => {
    const onResult = vi.fn()
    const parent = vi.fn()
    renderK(<div role="presentation" onKeyDown={parent}><Prompt open okLabel="Утвердить" onResult={onResult} /></div>)
    const box = screen.getByRole('alertdialog')
    box.focus()
    expect(box).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
    box.focus()
    parent.mockClear() // Tab всплывает — по контракту гасится только Esc
    await userEvent.keyboard('{Escape}')
    expect(onResult).toHaveBeenCalledWith(false)
    expect(parent).not.toHaveBeenCalled()
  })

  it('mousedown по подложке не левой кнопкой — без отказа', () => {
    const onResult = vi.fn()
    const { container } = renderK(<Prompt open onResult={onResult} />)
    const scrim = container.querySelector('[data-k-prompt]') as Element
    fireEvent.mouseDown(scrim, { button: 2 })
    fireEvent.mouseDown(scrim, { button: 1 })
    expect(onResult).not.toHaveBeenCalled()
  })

  it('note="" — как без note: нет описания и пустого блока', () => {
    renderK(<Prompt open note="" onResult={vi.fn()} />)
    const d = screen.getByRole('alertdialog')
    expect(d).not.toHaveAttribute('aria-describedby')
    expect(d.querySelector('[id]:not(h4)')).toBeNull()
  })

  it('размонтирование открытого окна возвращает фокус туда, где он был до открытия', async () => {
    function Host() {
      const [shown, setShown] = useState(false)
      return (
        <>
          <button onClick={() => setShown(true)}>Сохранить</button>
          {shown && <Prompt open onResult={() => setShown(false)} />}
        </>
      )
    }
    renderK(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Сохранить' })).toHaveFocus()
  })

  it('PromptChange: было → стало; axe без нарушений', async () => {
    const { container } = renderK(<Prompt open note={<PromptChange was="23.09.2026" now="24.09.2026" />} onResult={vi.fn()} />)
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('23.09.2026 → 24.09.2026')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Prompt: тело, блокировка, ошибка (спека 2d §2.1)', () => {
  const Body = () => <textarea aria-label="Причина" />

  it('children — между note и кнопками; при открытии фокус на поле тела', () => {
    renderK(<Prompt open note="Пояснение" okLabel="Отклонить" tone="danger" onResult={vi.fn()}><Body /></Prompt>)
    const d = screen.getByRole('alertdialog')
    const field = screen.getByRole('textbox', { name: 'Причина' })
    expect(field).toHaveFocus()
    const note = screen.getByText('Пояснение')
    const cancel = within(d).getByRole('button', { name: 'Отмена' })
    expect(note.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(field.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('ловушка Tab по всем фокусируемым: с последней кнопки — к полю, Shift+Tab с поля — к последней кнопке', async () => {
    renderK(
      <>
        <button>До</button>
        <Prompt open okLabel="Отклонить" onResult={vi.fn()}><Body /></Prompt>
        <button>После</button>
      </>,
    )
    const field = screen.getByRole('textbox', { name: 'Причина' })
    const cancel = screen.getByRole('button', { name: 'Отмена' })
    const ok = screen.getByRole('button', { name: 'Отклонить' })
    expect(field).toHaveFocus()
    await userEvent.tab()
    expect(cancel).toHaveFocus()
    await userEvent.tab()
    expect(ok).toHaveFocus()
    await userEvent.tab()
    expect(field).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(ok).toHaveFocus()
  })

  it('okDisabled — основная недоступна, клик без onResult; Tab её пропускает', async () => {
    const onResult = vi.fn()
    renderK(<Prompt open okDisabled okLabel="Отклонить" onResult={onResult}><Body /></Prompt>)
    const ok = screen.getByRole('button', { name: 'Отклонить' })
    expect(ok).toBeDisabled()
    await userEvent.click(ok)
    expect(onResult).not.toHaveBeenCalled()
    screen.getByRole('textbox', { name: 'Причина' }).focus() // клик по недоступной кнопке снимает фокус
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('textbox', { name: 'Причина' })).toHaveFocus()
  })

  it('okDisabled без тела: фокус при открытии — на первой доступной кнопке', () => {
    renderK(<Prompt open okDisabled onResult={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus()
  })

  it('busy — обе кнопки недоступны, aria-busy; Esc и подложка без onResult, Esc не всплывает', async () => {
    const onResult = vi.fn()
    const parent = vi.fn()
    const { container } = renderK(<div role="presentation" onKeyDown={parent}><Prompt open busy onResult={onResult}><Body /></Prompt></div>)
    expect(screen.getByRole('alertdialog')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Подтвердить' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    fireEvent.mouseDown(container.querySelector('[data-k-prompt]') as Element)
    expect(onResult).not.toHaveBeenCalled()
    expect(parent).not.toHaveBeenCalled()
  })

  it('busy после нажатия основной: фокус с недоступной кнопки уходит на коробку', async () => {
    function Host() {
      const [busy, setBusy] = useState(false)
      return <Prompt open busy={busy} onResult={(ok) => setBusy(ok)} />
    }
    renderK(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить' }))
    expect(screen.getByRole('alertdialog')).toHaveFocus()
  })

  it('без busy — aria-busy нет', () => {
    renderK(<Prompt open onResult={vi.fn()} />)
    expect(screen.getByRole('alertdialog')).not.toHaveAttribute('aria-busy')
  })

  it('error — строка role="alert" над кнопками; axe без нарушений', async () => {
    const { container } = renderK(<Prompt open error="Нет прав" onResult={vi.fn()}><Body /></Prompt>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Нет прав')
    expect(alert.compareDocumentPosition(screen.getByRole('button', { name: 'Отмена' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('без error — role="alert" нет', () => {
    renderK(<Prompt open onResult={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
