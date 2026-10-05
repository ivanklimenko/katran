import { useState } from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { Button } from '../button'
import { renderK } from '../test/renderK'
import type { Option } from './options'
import { SuggestInput, type SuggestInputProps } from './SuggestInput'

// Счета карточки клиента в USD — как CLIENT_ACCOUNTS эталона (вымышленные), седьмой дописан для «ещё 2»
const OPTIONS: Option[] = [
  ['40817840100050017762', 'Текущий'],
  ['40817840400050017763', 'Текущий'],
  ['40820840700050017764', 'Текущий (нерез.)'],
  ['42301840200050017765', 'Депозит'],
  ['40817840500050017766', 'Транзитный'],
  ['47422840800050017767', 'Конверсионный'],
  ['40817840900050017768', 'Текущий'],
].map(([acc, kind]) => ({ value: acc!, label: acc!, tag: 'USD', hint: kind! }))

const match = (o: Option, q: string) => String(o.value).includes(q)
const sanitize = (t: string) => t.replace(/\D/g, '')

const onChange = vi.fn()
const onCommit = vi.fn()
const onCancel = vi.fn()
const parentKeydown = vi.fn()

function Host({ value: initial, ...p }: Partial<SuggestInputProps> & { value: string }) {
  const [value, setValue] = useState(initial)
  return (
    <div role="presentation" onKeyDown={parentKeydown}>
      <SuggestInput
        options={OPTIONS}
        aria-label="Счёт Кт"
        emptyText={(q) => `В карточке нет счетов USD, содержащих «${q}»`}
        notInListText="Счёт не из карточки клиента — выберите из списка"
        match={match}
        sanitize={sanitize}
        placeholder="20 цифр"
        onCommit={onCommit}
        onCancel={onCancel}
        {...p}
        value={value}
        onChange={(t) => { setValue(t); onChange(t) }}
      />
      <button type="button">Снаружи</button>
    </div>
  )
}

const setup = (p: Partial<SuggestInputProps> & { value: string }) => renderK(<Host {...p} />)
const field = () => screen.getByRole('combobox', { name: 'Счёт Кт' })
const activeText = () => document.getElementById(field().getAttribute('aria-activedescendant') ?? '')?.querySelector('span')?.textContent

beforeEach(() => { onChange.mockReset(); onCommit.mockReset(); onCancel.mockReset(); parentKeydown.mockReset() })

describe('SuggestInput (спека 2c §2.1, эталон accSuggest)', () => {
  it('до max строк и хвост «ещё N — уточните номер» вне listbox', () => {
    setup({ value: '' })
    expect(screen.getAllByRole('option')).toHaveLength(5)
    expect(screen.getByText('ещё 2 — уточните номер').closest('[role="listbox"]')).toBeNull()
    expect(field()).toHaveAttribute('aria-expanded', 'true')
    expect(field()).toHaveAttribute('aria-controls', screen.getByRole('listbox', { name: 'Счёт Кт' }).id)
  })

  it('фильтр match, совпадение жирным; sanitize до onChange', () => {
    setup({ value: '' })
    fireEvent.change(field(), { target: { value: 'a1 7' } })
    expect(onChange).toHaveBeenLastCalledWith('17')
    expect(field()).toHaveValue('17')
    const first = screen.getAllByRole('option')[0]!
    expect(first.querySelector('b')).toHaveTextContent('17')
    expect(first).toHaveTextContent('40817840100050017762')
    fireEvent.change(field(), { target: { value: '7764' } })
    expect(screen.getAllByRole('option').map((o) => o.querySelector('span')?.textContent)).toEqual(['40820840700050017764'])
    expect(screen.queryByText(/^ещё/)).toBeNull()
  })

  it('нет совпадений — строка emptyText(query)', () => {
    setup({ value: '999' })
    expect(screen.getByRole('listbox')).toHaveTextContent('В карточке нет счетов USD, содержащих «999»')
  })

  it('↑↓ по кругу, Enter — активный', async () => {
    const u = userEvent.setup()
    setup({ value: '' })
    expect(field()).toHaveFocus()
    expect(field()).not.toHaveAttribute('aria-activedescendant')
    await u.keyboard('{ArrowUp}')
    expect(activeText()).toBe('40817840500050017766')
    await u.keyboard('{ArrowDown}')
    expect(activeText()).toBe('40817840100050017762')
    await u.keyboard('{ArrowUp}{ArrowUp}')
    expect(activeText()).toBe('42301840200050017765')
    await u.keyboard('{ArrowDown}{Enter}')
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(OPTIONS[4])
  })

  it('↓ с пустой позиции — первый; ввод сбрасывает активный', async () => {
    const u = userEvent.setup()
    setup({ value: '' })
    await u.keyboard('{ArrowDown}')
    expect(activeText()).toBe('40817840100050017762')
    await u.keyboard('7')
    expect(field()).not.toHaveAttribute('aria-activedescendant')
  })

  it('Enter: единственный в выдаче; иначе точное совпадение введённого', async () => {
    const u = userEvent.setup()
    const { unmount } = setup({ value: '17762' })
    await u.keyboard('{Enter}')
    expect(onCommit).toHaveBeenLastCalledWith(OPTIONS[0])
    unmount()
    // своё правило match показывает все — точное совпадение решает среди нескольких
    setup({ value: '40820840700050017764', match: () => true })
    expect(screen.getAllByRole('option')).toHaveLength(5)
    await u.keyboard('{Enter}')
    expect(onCommit).toHaveBeenLastCalledWith(OPTIONS[2])
    expect(onCommit).toHaveBeenCalledTimes(2)
  })

  it('Enter без совпадения — notInListText, aria-invalid, onCommit не зовётся', async () => {
    setup({ value: '4081' }); await userEvent.keyboard('{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Счёт не из карточки клиента — выберите из списка')).toBeInTheDocument()
    expect(field()).toHaveAccessibleDescription('Счёт не из карточки клиента — выберите из списка')
  })

  it('ошибка уходит при вводе: снова видна подсказка', async () => {
    const u = userEvent.setup()
    setup({ value: '4081', hint: 'Только из карточки клиента · USD · 7 сч.' })
    await u.keyboard('{Enter}')
    expect(screen.queryByText('Только из карточки клиента · USD · 7 сч.')).toBeNull()
    await u.keyboard('7')
    expect(field()).not.toHaveAttribute('aria-invalid')
    expect(screen.getByText('Только из карточки клиента · USD · 7 сч.')).toBeInTheDocument()
  })

  it('Esc при открытом списке — onCancel; родитель keydown не получает (деталка не закроется)', async () => {
    setup({ value: '' }); await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1); expect(parentKeydown).not.toHaveBeenCalled()
  })

  it('pointerdown вне поля и списка — onCancel; клик по пункту — onCommit', async () => {
    const u = userEvent.setup()
    setup({ value: '' })
    await u.click(screen.getAllByRole('option')[3]!)
    expect(onCommit).toHaveBeenCalledWith(OPTIONS[3])
    expect(onCancel).not.toHaveBeenCalled()
    await u.click(field())
    expect(onCancel).not.toHaveBeenCalled()
    await u.click(screen.getByRole('button', { name: 'Снаружи' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Tab — onCancel', async () => {
    const u = userEvent.setup()
    setup({ value: '17' })
    await u.tab()
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('status вместо списка; hint и keysHint под полем; tag рисуется', () => {
    const { rerender } = renderK(<Host value="" status="Загрузка счетов…" hint="Только из карточки клиента · USD · 7 сч." keysHint="↑↓ Enter · Esc" />)
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.getByText('Загрузка счетов…')).toBeInTheDocument()
    expect(field()).toHaveAttribute('aria-expanded', 'false')
    expect(field()).not.toHaveAttribute('aria-controls')
    expect(field()).toHaveAccessibleDescription('Только из карточки клиента · USD · 7 сч. ↑↓ Enter · Esc Загрузка счетов…')
    rerender(<Host value="" hint="Только из карточки клиента · USD · 7 сч." keysHint="↑↓ Enter · Esc" />)
    const row = screen.getAllByRole('option')[0]!
    expect(row).toHaveTextContent('40817840100050017762USDТекущий')
    expect(screen.getAllByText('USD')).toHaveLength(5)
  })

  it('хвост «ещё N» — в описании поля; активный пункт — aria-selected', async () => {
    const u = userEvent.setup()
    setup({ value: '', keysHint: '↑↓ Enter · Esc' })
    expect(field()).toHaveAccessibleDescription('↑↓ Enter · Esc ещё 2 — уточните номер')
    expect(screen.getAllByRole('option').filter((o) => o.getAttribute('aria-selected') === 'true')).toHaveLength(0)
    await u.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getAllByRole('option').map((o) => o.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false', 'false'])
  })

  it('Enter при status — ни выбора, ни ошибки', async () => {
    const u = userEvent.setup()
    setup({ value: '17762', status: 'Загрузка счетов…' })
    await u.keyboard('{Enter}')
    expect(onCommit).not.toHaveBeenCalled()
    expect(field()).not.toHaveAttribute('aria-invalid')
  })

  it('status с кнопкой: Tab — на кнопку, Shift+Tab — в поле, Tab с последней — onCancel', async () => {
    const u = userEvent.setup()
    const retry = vi.fn()
    setup({ value: '', status: <>Не удалось загрузить счета <Button onClick={retry}>Повторить</Button></> })
    const btn = screen.getByRole('button', { name: 'Повторить' })
    await u.tab()
    expect(btn).toHaveFocus()
    expect(onCancel).not.toHaveBeenCalled()
    await u.keyboard('{Enter}')
    expect(retry).toHaveBeenCalledTimes(1)
    await u.tab({ shift: true })
    expect(field()).toHaveFocus()
    expect(onCancel).not.toHaveBeenCalled()
    await u.tab()
    await u.tab()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Esc на кнопке в status — onCancel; ни родитель, ни слушатель document (DrawerStack) его не получают', async () => {
    const u = userEvent.setup()
    const drawerEsc = vi.fn()
    const onDoc = (e: KeyboardEvent) => { if (e.key === 'Escape') drawerEsc() }
    document.addEventListener('keydown', onDoc, true)
    try {
      setup({ value: '', status: <Button onClick={vi.fn()}>Повторить</Button> })
      await u.tab()
      expect(screen.getByRole('button', { name: 'Повторить' })).toHaveFocus()
      parentKeydown.mockClear() // Tab из поля родитель видит — проверяем только Esc
      await u.keyboard('{Escape}')
      expect(onCancel).toHaveBeenCalledTimes(1)
      expect(drawerEsc).not.toHaveBeenCalled()
      expect(parentKeydown).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', onDoc, true)
    }
  })

  it('status без фокусируемого — Tab, как и без status, onCancel', async () => {
    const u = userEvent.setup()
    setup({ value: '', status: 'Загрузка счетов…' })
    await u.tab()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('по умолчанию: вхождение без регистра, тождественный ввод, хвост своим текстом', () => {
    renderK(
      <SuggestInput
        options={OPTIONS}
        value="депоз"
        onChange={onChange}
        onCommit={onCommit}
        onCancel={onCancel}
        aria-label="Счёт Дт"
        emptyText={() => 'нет'}
        notInListText="не из списка"
      />,
    )
    expect(screen.getAllByRole('option').map((o) => o.querySelector('span')?.textContent)).toEqual(['42301840200050017765'])
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Абв 1' } })
    expect(onChange).toHaveBeenLastCalledWith('Абв 1')
  })

  it('max и moreText', () => {
    setup({ value: '', max: 3, moreText: (n) => `и ещё ${n}` })
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByText('и ещё 4')).toBeInTheDocument()
  })

  it('фокус в поле при монтировании; axe без нарушений', async () => {
    const { container } = setup({ value: '17', hint: 'Только из карточки клиента · USD · 7 сч.', keysHint: '↑↓ Enter · Esc' })
    expect(field()).toHaveFocus()
    expect(container).toContainElement(screen.getByRole('listbox'))
    expect(await axe(container)).toHaveNoViolations()
    await userEvent.keyboard('{ArrowDown}')
    expect(await axe(container)).toHaveNoViolations()
  })

  it('autoFocus={false} — фокус не трогается; axe со status', async () => {
    const { container } = setup({ value: '', autoFocus: false, status: 'Загрузка счетов…' })
    expect(field()).not.toHaveFocus()
    expect(await axe(container)).toHaveNoViolations()
  })
})
