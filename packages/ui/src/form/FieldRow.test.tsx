import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { useState } from 'react'
import { renderK } from '../test/renderK'
import { FieldRow } from './FieldRow'
import type { FieldDef, FieldValue } from './types'

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
