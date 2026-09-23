import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { AccountValue } from './AccountValue'
import { CopyValue } from './CopyValue'
import { Counter } from './Counter'
import { FieldTag } from './FieldTag'
import { LinkValue } from './LinkValue'
import { StatusDot } from './StatusDot'

const clip = () => { const writeText = vi.fn().mockResolvedValue(undefined); Object.assign(navigator, { clipboard: { writeText } }); return writeText }

describe('CopyValue', () => {
  it('кнопка, копирует значение, объявляет, тултип только при обрезке', async () => {
    const writeText = clip()
    renderK(<CopyValue value="DEUTDEFFXXX" />)
    const b = screen.getByRole('button', { name: 'DEUTDEFFXXX' })
    expect(b).toHaveAttribute('data-k-tip', 'DEUTDEFFXXX')
    expect(b).toHaveAttribute('data-k-tip-if', 'truncated')
    await userEvent.click(b)
    expect(writeText).toHaveBeenCalledWith('DEUTDEFFXXX')
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)) })
    expect(screen.getByRole('status')).toHaveTextContent('Скопировано')
  })
  it('short — тултип всегда; display показывается вместо value', () => {
    renderK(<CopyValue value="полное" display="кор…" short />)
    const b = screen.getByRole('button', { name: 'кор…' })
    expect(b).not.toHaveAttribute('data-k-tip-if')
    expect(b).toHaveAttribute('data-k-tip', 'полное')
  })
})

describe('LinkValue', () => {
  it('с значением — копирует значение, имя как текст', async () => {
    const writeText = clip()
    renderK(<LinkValue name="uuid" value="0f3c-…" />)
    await userEvent.click(screen.getByRole('button', { name: 'uuid' }))
    expect(writeText).toHaveBeenCalledWith('0f3c-…')
  })
  it('без значения — недоступна, тултип объясняет', () => {
    renderK(<LinkValue name="refOut" />)
    const b = screen.getByRole('button', { name: 'refOut' })
    expect(b).toBeDisabled()
    expect(b).toHaveAttribute('data-k-tip', 'refOut: нет значения')
  })
})

describe('AccountValue', () => {
  it('8…3, код валюты выделен, копируется полный', async () => {
    const writeText = clip()
    renderK(<AccountValue value="40702840500000012345" />)
    const b = screen.getByRole('button')
    expect(b).toHaveTextContent('40702840…345')
    expect(b.querySelector('b')).toHaveTextContent('840')
    await userEvent.click(b)
    expect(writeText).toHaveBeenCalledWith('40702840500000012345')
  })
  it('full — счёт целиком, код валюты выделен, без сокращения', () => {
    renderK(<AccountValue value="40702840500000012345" full />)
    const b = screen.getByRole('button')
    expect(b).toHaveTextContent('40702840500000012345')
    expect(b.querySelector('b')).toHaveTextContent('840')
    expect(b).toHaveAttribute('data-k-tip-if', 'truncated')
  })
})

describe('StatusDot / FieldTag / Counter', () => {
  it('точка с именем — role=img; без имени скрыта', () => {
    const { container } = renderK(<><StatusDot tone="ok" label="Обработан" /><StatusDot tone="bad" /></>)
    expect(screen.getByRole('img', { name: 'Обработан' })).toBeInTheDocument()
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
  })
  it('тег поля несёт подсказку', () => {
    renderK(<FieldTag tag="70" title="70 · Детали платежа" />)
    expect(screen.getByText('70')).toHaveAttribute('data-k-tip', '70 · Детали платежа')
  })
  it('счётчик ноль помечен', () => {
    renderK(<Counter value={0} />)
    expect(screen.getByText('0')).toHaveAttribute('data-zero', 'true')
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<>
      <CopyValue value="a" /><LinkValue name="n" value="v" /><AccountValue value="40702840500000012345" />
      <FieldTag tag="70" /><StatusDot tone="ok" label="Ок" /><Counter value={3} />
    </>)
    expect(await axe(container)).toHaveNoViolations()
  })
})
