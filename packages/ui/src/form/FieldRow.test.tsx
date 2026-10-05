import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { useState } from 'react'
import { renderK } from '../test/renderK'
import { FieldRow } from './FieldRow'
import type { FieldDef, FieldEdit, FieldValue } from './types'

const party: FieldDef = { label: 'Приказодатель', kind: 'party', opts: ['A', 'F', 'K'] }
const text72: FieldDef = { label: 'Информация отправителя получателю', kind: 'text', lines: 6, width: 35, show: 4 }
const v50: FieldValue = { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH', 'ULITSA PROFSOYUZNAYA 83-1-214', 'RU/ MOSCOW, 117279'] }
const T72 = ['/INS/ NRDIRUMMXXX', '/ACC/ PLEASE CREDIT WITHOUT DELAY', '/REC/ REF FX2609220000417', '/BNF/ CONTRACT 12-45 DD 01.03.2026', '/INT/ MRDNGB2LXXX', '//CHARGES OUR']

function Toggle({ tag, def, value }: { tag: string; def: FieldDef; value: FieldValue | null }) {
  const [open, setOpen] = useState(false)
  return <FieldRow tag={tag} def={def} value={value} open={open} onToggle={() => setOpen((o) => !o)} optionLabels={{ F: 'Опция F — имя и адрес структурированно' }} />
}

describe('FieldRow (спека 2a §3.1)', () => {
  it('пустое поле — бледная строка с прочерком, доступный текст «не заполнено», без кнопки', () => {
    renderK(<FieldRow tag="55" def={{ label: 'Третье возмещающее учреждение', kind: 'bank' }} value={{ lines: [] }} />)
    const row = document.querySelector('[data-field="55"]')!
    expect(row).toHaveAttribute('data-empty')
    expect(row).toHaveTextContent('55')
    expect(row).toHaveTextContent('—')
    expect(screen.getByText('не заполнено')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('55')).toHaveAttribute('data-k-tip', '55 · Третье возмещающее учреждение')
    // название поля доступно не только тултипом: скрытым текстом рядом с тегом
    expect(screen.getByText('Третье возмещающее учреждение')).toHaveClass('sr')
  })

  it('null — тоже пустая строка', () => {
    renderK(<FieldRow tag="56" def={undefined} value={null} />)
    expect(document.querySelector('[data-field="56"]')).toHaveAttribute('data-empty')
  })

  it('заполненное: тег, буква опции с подсказкой, первая строка и счёт; клик раскрывает полный текст', async () => {
    renderK(<Toggle tag="50" def={party} value={v50} />)
    const btn = screen.getByRole('button', { name: /LAVRENTIEV/ })
    // клавиатура и скринридер слышат название поля, а не только номер тега
    expect(btn).toHaveAccessibleName(/Приказодатель/)
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(btn).toHaveTextContent('50')
    expect(btn).toHaveTextContent('40817840500010042371')
    expect(screen.getByText('F')).toHaveAttribute('data-k-tip', 'Опция F — имя и адрес структурированно')
    expect(screen.queryByText(/ULITSA PROFSOYUZNAYA/)).not.toBeVisible()
    await userEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/ULITSA PROFSOYUZNAYA/)).toBeVisible()
  })

  it('тег последовательности B показывается без префикса', () => {
    renderK(<FieldRow tag="B.50" def={party} value={v50} />)
    expect(document.querySelector('[data-field="B.50"]')).toHaveTextContent(/^50/)
  })

  it('многострочное текстовое: видно show строк и «ещё N стр.»; раскрытие показывает все', async () => {
    renderK(<Toggle tag="72" def={text72} value={{ lines: T72 }} />)
    const row = document.querySelector('[data-field="72"]')!
    expect(row).toHaveTextContent('/INS/ NRDIRUMMXXX')
    expect(row).not.toHaveTextContent('//CHARGES OUR')
    // кнопка с контекстом: какое поле раскрывается; видимый текст — начало доступного имени
    const more = screen.getByRole('button', { name: 'ещё 2 стр. — 72 · Информация отправителя получателю' })
    expect(more).toHaveTextContent(/^ещё 2 стр\.$/)
    await userEvent.click(more)
    expect(row).toHaveTextContent('//CHARGES OUR')
    expect(screen.getByRole('button', { name: 'свернуть — 72 · Информация отправителя получателю' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('пустое текстовое — «не заполнено»', () => {
    renderK(<FieldRow tag="70" def={{ label: 'Детали платежа', kind: 'text', lines: 4, width: 35 }} value={{ lines: [] }} />)
    expect(document.querySelector('[data-field="70"]')).toHaveAttribute('data-empty')
    expect(screen.getByText('не заполнено')).toBeInTheDocument()
  })

  it('без нарушений axe', async () => {
    const { container } = renderK(<><Toggle tag="50" def={party} value={v50} /><FieldRow tag="55" def={party} value={null} /><Toggle tag="72" def={text72} value={{ lines: T72 }} /></>)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('FieldRow — правка (спека 2c §2.1)', () => {
  const def57: FieldDef = { label: 'Банк получателя', kind: 'bank', opts: ['A', 'D'], editable: true }
  const def70: FieldDef = { label: 'Детали платежа', kind: 'text', lines: 4, width: 35, editable: true }
  const was57: FieldValue = { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK KHABAROVSK BR', 'VKRBRU8KXXX'] }
  const now57: FieldValue = { opt: 'A', lines: ['SBERBANK MOSCOW', 'SABRRUMMXXX'] }
  const tip = 'Изменено: Петрова А. С., 22.09.2026 10:42'
  const changed: FieldEdit = { changed: true, was: was57, tip, audit: <div data-testid="audit">2 изменения</div> }

  /** Хозяин раскрытия — как ConfigForm. */
  function Row(p: { tag?: string; def?: FieldDef; value: FieldValue | null; edit?: FieldEdit | null; onEdit?: () => void; editing?: boolean }) {
    const [open, setOpen] = useState(false)
    return <FieldRow tag={p.tag ?? '57'} def={p.def ?? def57} value={p.value} editable onEdit={p.onEdit ?? vi.fn()} edit={p.edit}
      editing={p.editing} open={open} onToggle={() => setOpen((o) => !o)} />
  }
  const cellOf = (tag: string) => document.querySelector(`[data-field="${tag}"]`) as HTMLElement

  it('editable: карандаш-сосед строки «Редактировать поле B.57», тултип «Редактировать»; есть и у пустой строки', async () => {
    const onEdit = vi.fn()
    renderK(<FieldRow tag="B.57" def={def57} value={null} editable onEdit={onEdit} />)
    const pen = screen.getByRole('button', { name: 'Редактировать поле B.57' })
    expect(pen).toHaveAttribute('data-k-tip', 'Редактировать')
    await userEvent.click(pen); expect(onEdit).toHaveBeenCalledTimes(1)
    // правимое пустое поле раскрытия не имеет — только карандаш
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(cellOf('B.57')).toHaveAttribute('data-empty')
  })

  it('карандаш — сосед строки-кнопки, не её потомок; без editable карандаша нет', () => {
    const { rerender } = renderK(<FieldRow tag="57" def={def57} value={was57} editable onEdit={vi.fn()} />)
    const pen = screen.getByRole('button', { name: 'Редактировать поле 57' })
    const row = screen.getByRole('button', { name: /VOSTOCHNY/ })
    expect(row).not.toContainElement(pen)
    expect(pen.parentElement).toBe(cellOf('57'))
    expect(row.parentElement).toBe(cellOf('57'))
    rerender(<FieldRow tag="57" def={def57} value={was57} />)
    expect(screen.queryByRole('button', { name: /Редактировать/ })).toBeNull()
  })

  it('edit.changed: ячейка data-edited, тултип, скрытый текст «изменено»; раскрытие — «Было:» / «Стало:», аудит, «✎ Изменить»', async () => {
    const onEdit = vi.fn()
    renderK(<Row value={now57} edit={changed} onEdit={onEdit} />)
    const cell = cellOf('57')
    expect(cell).toHaveAttribute('data-edited')
    expect(cell).toHaveAttribute('data-k-tip', tip)
    const row = screen.getByRole('button', { name: /SBERBANK MOSCOW/ })
    expect(row).toHaveAccessibleName(new RegExp(`изменено: ${tip}`))
    expect(screen.getByText(`изменено: ${tip}`)).toHaveClass('sr')
    expect(screen.queryByText(/Было:/)).not.toBeVisible()
    await userEvent.click(row)
    const full = screen.getByText(/Было:/)
    expect(full).toBeVisible()
    expect(full.textContent).toBe('Было:\nVOSTOCHNY KREDIT BANK KHABAROVSK BR\nVKRBRU8KXXX\nСтало:\nSBERBANK MOSCOW\nSABRRUMMXXX')
    expect(screen.getByTestId('audit')).toBeVisible()
    // порядок: «Было / Стало», аудит, кнопка
    const ed = screen.getByRole('button', { name: 'Изменить поле 57' })
    expect(ed).toHaveTextContent('✎ Изменить')
    expect(full.compareDocumentPosition(screen.getByTestId('audit')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByTestId('audit').compareDocumentPosition(ed) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await userEvent.click(ed)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('edit без changed (откат с историей): ни data-edited, ни «Было/Стало», аудит в раскрытии есть', async () => {
    renderK(<Row value={was57} edit={{ ...changed, changed: false }} />)
    const cell = cellOf('57')
    expect(cell).not.toHaveAttribute('data-edited')
    expect(cell).not.toHaveAttribute('data-k-tip')
    expect(screen.queryByText(/изменено:/)).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /VOSTOCHNY/ }))
    expect(screen.queryByText(/Было:/)).toBeNull()
    expect(screen.getByText('VOSTOCHNY KREDIT BANK KHABAROVSK BR VKRBRU8KXXX')).toBeVisible()
    expect(screen.getByTestId('audit')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Изменить поле 57' })).toBeVisible()
  })

  it('правка в пустое: строка остаётся раскрываемой — data-edited, «Стало:» с прочерком, аудит', async () => {
    renderK(<Row value={{ lines: [] }} edit={changed} />)
    const cell = cellOf('57')
    expect(cell).toHaveAttribute('data-edited')
    const row = screen.getByRole('button', { name: /не заполнено/ })
    await userEvent.click(row)
    expect(screen.getByText(/Было:/).textContent).toBe('Было:\nVOSTOCHNY KREDIT BANK KHABAROVSK BR\nVKRBRU8KXXX\nСтало:\n—')
    expect(screen.getByTestId('audit')).toBeVisible()
  })

  it('ячейка с открытым редактором — data-editing', () => {
    const { rerender } = renderK(<FieldRow tag="57" def={def57} value={was57} editable editing onEdit={vi.fn()} />)
    expect(cellOf('57')).toHaveAttribute('data-editing')
    rerender(<FieldRow tag="57" def={def57} value={was57} editable editing={false} onEdit={vi.fn()} />)
    expect(cellOf('57')).not.toHaveAttribute('data-editing')
  })

  it('закрытие редактора возвращает фокус на карандаш', () => {
    // редактор рисует хозяин (ConfigForm) соседом ячейки — здесь так же
    const view = (editing: boolean) => (
      <>
        <FieldRow tag="57" def={def57} value={was57} editable editing={editing} onEdit={vi.fn()} />
        {editing && <input aria-label="Строка 1" />}
      </>
    )
    const { rerender } = renderK(view(true))
    screen.getByRole('textbox', { name: 'Строка 1' }).focus()
    rerender(view(false))
    expect(screen.getByRole('button', { name: 'Редактировать поле 57' })).toHaveFocus()
  })

  it('закрытие редактора не уводит фокус, ушедший на другой элемент', () => {
    const view = (editing: boolean) => (
      <>
        <FieldRow tag="57" def={def57} value={was57} editable editing={editing} onEdit={vi.fn()} />
        <button type="button">Другое</button>
      </>
    )
    const { rerender } = renderK(view(true))
    screen.getByRole('button', { name: 'Другое' }).focus()
    rerender(view(false))
    expect(screen.getByRole('button', { name: 'Другое' })).toHaveFocus()
  })

  it('текстовое 70 изменённое (решение в4): карандаш, data-edited и панель под текстом — «Было / Стало», аудит, «✎ Изменить»', async () => {
    const onEdit = vi.fn()
    const was70: FieldValue = { lines: ['/INV/ 2026-0417 DD 15.09.2026'] }
    renderK(<FieldRow tag="70" def={def70} value={{ lines: ['/INV/ 2026-0418'] }} editable onEdit={onEdit}
      edit={{ changed: true, was: was70, tip, audit: <div data-testid="audit">1 изменение</div> }} />)
    const cell = cellOf('70')
    expect(cell).toHaveAttribute('data-edited')
    expect(cell).toHaveAttribute('data-k-tip', tip)
    expect(screen.getByText(`изменено: ${tip}`)).toHaveClass('sr')
    expect(screen.getByRole('button', { name: 'Редактировать поле 70' }).parentElement).toBe(cell)
    // раскрытия у 70 нет (show = lines = 4) — панель видна сразу
    expect(screen.getByText(/Было:/).textContent).toBe('Было:\n/INV/ 2026-0417 DD 15.09.2026\nСтало:\n/INV/ 2026-0418')
    expect(screen.getByText(/Было:/)).toBeVisible()
    expect(screen.getByTestId('audit')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Изменить поле 70' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('текстовое: откат с историей — только аудит; без правок — панели нет, только карандаш', () => {
    const { rerender } = renderK(<FieldRow tag="70" def={def70} value={{ lines: ['A'] }} editable onEdit={vi.fn()}
      edit={{ changed: false, was: { lines: ['A'] }, tip, audit: <div data-testid="audit">2 изменения</div> }} />)
    expect(cellOf('70')).not.toHaveAttribute('data-edited')
    expect(screen.queryByText(/Было:/)).toBeNull()
    expect(screen.getByTestId('audit')).toBeVisible()
    rerender(<FieldRow tag="70" def={def70} value={{ lines: ['A'] }} editable onEdit={vi.fn()} edit={null} />)
    expect(screen.queryByTestId('audit')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Изменить поле 70' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Редактировать поле 70' })).toBeInTheDocument()
  })

  it('без нарушений axe: правимые, изменённые, пустое, текстовое', async () => {
    const { container } = renderK(
      <>
        <Row value={now57} edit={changed} />
        <FieldRow tag="56" def={def57} value={null} editable onEdit={vi.fn()} />
        <FieldRow tag="70" def={def70} value={{ lines: ['/INV/ 2026-0418'] }} editable onEdit={vi.fn()} edit={{ ...changed, was: { lines: ['X'] } }} />
      </>,
    )
    await userEvent.click(screen.getByRole('button', { name: /SBERBANK/ }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
