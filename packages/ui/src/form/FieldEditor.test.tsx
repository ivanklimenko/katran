import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { FieldEditor, type FieldEditorProps } from './FieldEditor'
import type { FieldValue } from './types'

const ERR = "Строка 1: недопустимые символы (только латиница, цифры и / - ? : ( ) . , ' +)"

const onChange = vi.fn<(next: FieldValue) => void>()
const onCancel = vi.fn<() => void>()
const onSave = vi.fn<() => void>()

const setup = (p: Partial<FieldEditorProps> = {}) => {
  onChange.mockClear()
  onCancel.mockClear()
  onSave.mockClear()
  const props: FieldEditorProps = {
    tag: '57',
    name: 'Банк получателя',
    original: { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK', 'VKRBRU8KXXX'] },
    value: { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK', 'VKRBRU8KXXX'] },
    onChange,
    lines: 4,
    width: 35,
    opts: ['A', 'B', 'C', 'D'],
    error: null,
    rule: '4 строк по 35 символов, набор SWIFT X',
    onCancel,
    onSave,
    ...p,
  }
  return renderK(<FieldEditor {...props} />)
}

describe('FieldEditor', () => {
  it('заголовок, две колонки, счётчики «Как есть» и живой', () => {
    setup({ value: { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK', 'VKRBRU8K2KD'] } })
    const region = screen.getByRole('region', { name: 'Поле 57 · Банк получателя — правка' })
    expect(region).toHaveAttribute('data-k-edit')
    expect(screen.getByRole('heading', { name: 'Поле 57 · Банк получателя — правка' })).toBeInTheDocument()
    expect(screen.getByText('Как есть')).toBeInTheDocument()
    expect(screen.getByText('Редактирование')).toBeInTheDocument()
    expect(screen.getAllByText('32/140')).toHaveLength(2)
    // «Как есть» — исходные строки, дополненные до N; чип исходной опции отмечен
    const pre = screen.getByText((_, el) => el?.tagName === 'PRE' && el.textContent === 'VOSTOCHNY KREDIT BANK\nVKRBRU8KXXX\n \n ')
    expect(pre).toBeInTheDocument()
    expect(within(region).getAllByText('A').find((el) => el.tagName === 'SPAN')).toHaveAttribute('data-on')
    // живой счётчик, N полей с текущим черновиком, дополненным ''
    expect(screen.getByRole('textbox', { name: 'Строка 2' })).toHaveValue('VKRBRU8K2KD')
    expect(screen.getByRole('textbox', { name: 'Строка 4' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: 'Строка 4' })).toHaveAttribute('placeholder', 'Строка 4 до 35 символов')
  })

  it('живой счётчик больше N·W — признак bad', () => {
    setup({ lines: 1, width: 10, value: { lines: ['ABCDEFGHIJK'] }, original: { lines: [] } })
    expect(screen.getByText('0/10')).not.toHaveAttribute('data-bad')
    expect(screen.getByText('11/10')).toHaveAttribute('data-bad')
  })

  it('B.57 — заголовок с тегом без префикса', () => {
    setup({ tag: 'B.57' })
    expect(screen.getByRole('region', { name: 'Поле 57 · Банк получателя — правка' })).toBeInTheDocument()
  })

  it('опции — кнопки aria-pressed, «—» с именем «Без буквы»; выбор зовёт onChange', async () => {
    setup({ opts: ['', 'A', 'F'], value: { lines: [] } })
    const none = screen.getByRole('button', { name: 'Без буквы' })
    expect(none).toHaveAttribute('aria-pressed', 'true')
    expect(none).toHaveTextContent('—')
    expect(screen.getByRole('button', { name: 'Опция A' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Опция F' }))
    expect(onChange).toHaveBeenLastCalledWith({ opt: 'F', lines: [] })
  })

  it('без opts — нет кнопок опций и чипов', () => {
    setup({ opts: undefined })
    expect(screen.queryByRole('button', { name: /^Опция/ })).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('N полей «Строка k», ввод — onChange с полным массивом строк; сторона — поле «Счёт» и фокус в нём', async () => {
    const { unmount } = setup({ value: { opt: 'A', lines: ['AB'] } })
    expect(screen.getAllByRole('textbox')).toHaveLength(4)
    expect(screen.getByRole('textbox', { name: 'Строка 1' })).toHaveFocus()
    await userEvent.type(screen.getByRole('textbox', { name: 'Строка 3' }), 'x')
    expect(onChange).toHaveBeenLastCalledWith({ opt: 'A', lines: ['AB', '', 'x', ''] })
    unmount()

    setup({ account: true, original: { opt: 'A', acc: '40702810', lines: ['OOO ROMASHKA'] }, value: { opt: 'A', acc: '40702810', lines: ['OOO ROMASHKA'] } })
    const acc = screen.getByRole('textbox', { name: 'Счёт' })
    expect(acc).toHaveFocus()
    expect(acc).toHaveValue('40702810')
    expect(screen.getAllByText('Счёт / IBAN')).toHaveLength(2)
    expect(screen.getAllByText('Наименование / адрес')).toHaveLength(2)
    await userEvent.type(acc, '9')
    expect(onChange).toHaveBeenLastCalledWith({ opt: 'A', acc: '407028109', lines: ['OOO ROMASHKA'] })
  })

  it('сторона без исходного счёта — «—» в «Как есть»', () => {
    setup({ account: true, original: { lines: ['X'] }, value: { lines: ['X'] } })
    expect(screen.getByText('—', { selector: 'pre' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Счёт' })).toHaveValue('')
  })

  it('ошибка: строка ошибки, «Сохранить» недоступна', () => {
    setup({ error: ERR })
    const line = screen.getByText(ERR)
    expect(line).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    const first = screen.getByRole('textbox', { name: 'Строка 1' })
    expect(first).toHaveAttribute('aria-invalid', 'true')
    expect(first).toHaveAccessibleDescription(ERR)
  })

  it('busy: обе кнопки недоступны, поля доступны; saveError показывается', async () => {
    setup({ busy: true, saveError: 'Документ изменили — откройте заново' })
    expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Строка 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Опция B' })).toBeEnabled()
    expect(screen.getByText('Документ изменили — откройте заново')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Строка 1' })).not.toHaveAttribute('aria-invalid')
    await userEvent.keyboard('{Escape}')
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('Esc на кнопке опции внутри редактора — onCancel; Enter в поле не сохраняет', async () => {
    setup()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    screen.getByRole('button', { name: 'Опция A' }).focus()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    screen.getByRole('textbox', { name: 'Строка 1' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onSave).not.toHaveBeenCalled()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
    document.removeEventListener('keydown', outer)
  })

  it('подвал: rule, «Отмена», «Сохранить»', async () => {
    setup()
    expect(screen.getByText('4 строк по 35 символов, набор SWIFT X')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('axe без нарушений', async () => {
    const { container } = setup({ account: true, error: ERR })
    expect(await axe(container)).toHaveNoViolations()
  })
})
