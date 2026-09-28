import { act, fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { AccountValue } from './AccountValue'
import { CopyValue } from './CopyValue'
import { Counter } from './Counter'
import { FieldTag } from './FieldTag'
import { LinkValue } from './LinkValue'
import { StatusDot, type StatusTone } from './StatusDot'
import { SwiftField } from './SwiftField'
import { Tag } from './Tag'

const clip = () => { const writeText = vi.fn().mockResolvedValue(undefined); Object.assign(navigator, { clipboard: { writeText } }); return writeText }

describe('CopyValue', () => {
  it('кнопка, копирует значение, объявляет, тултип только при обрезке', async () => {
    const writeText = clip()
    renderK(<CopyValue value="HSTBDEHHXXX" />)
    const b = screen.getByRole('button', { name: 'HSTBDEHHXXX' })
    expect(b).toHaveAttribute('data-k-tip', 'HSTBDEHHXXX')
    expect(b).toHaveAttribute('data-k-tip-if', 'truncated')
    await userEvent.click(b)
    expect(writeText).toHaveBeenCalledWith('HSTBDEHHXXX')
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)) })
    expect(screen.getByRole('status')).toHaveTextContent('Скопировано')
  })
  it('short — тултип всегда; display показывается вместо value', () => {
    renderK(<CopyValue value="полное" display="кор…" short />)
    const b = screen.getByRole('button', { name: 'кор…' })
    expect(b).not.toHaveAttribute('data-k-tip-if')
    expect(b).toHaveAttribute('data-k-tip', 'полное')
  })
  it('копирование после размонтирования не пишет в стейт и не ругается в консоль', async () => {
    let release!: () => void
    Object.assign(navigator, { clipboard: { writeText: () => new Promise<void>((r) => { release = r }) } })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { unmount } = renderK(<CopyValue value="HSTBDEHHXXX" />)
    fireEvent.click(screen.getByRole('button', { name: 'HSTBDEHHXXX' }))
    unmount()
    await act(async () => { release() })
    expect(err).not.toHaveBeenCalled()
    err.mockRestore()
  })
  it('size="s" и tone="muted" — классы второго кегля и приглушённого тона', () => {
    renderK(<CopyValue value="x" size="s" tone="muted" />)
    const btn = screen.getByRole('button', { name: /x/ })
    expect(btn.className).toMatch(/small/)
    expect(btn.className).toMatch(/muted/)
  })
})

describe('Tag', () => {
  it('тоны mt/warn/ok — data-tone', () => {
    renderK(<><Tag tone="mt">MT103</Tag><Tag tone="warn">ЕРС</Tag><Tag tone="ok">VTO</Tag></>)
    expect(screen.getByText('MT103')).toHaveAttribute('data-tone', 'mt')
    expect(screen.getByText('ЕРС')).toHaveAttribute('data-tone', 'warn')
    expect(screen.getByText('VTO')).toHaveAttribute('data-tone', 'ok')
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
  it('8…4, код валюты выделен, копируется полный', async () => {
    const writeText = clip()
    renderK(<AccountValue value="40702840500000012345" />)
    const b = screen.getByRole('button')
    expect(b).toHaveTextContent('40702840…2345')
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

describe('SwiftField', () => {
  it('опция, главное значение, подпись прописными; пусто — «—»', () => {
    const { rerender } = renderK(<SwiftField opt="A" main="VKRBRU8KXXX" caption="АО «Прибой»" />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /VKRBRU8KXXX/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /АО «Прибой»/ })).toBeInTheDocument()
    rerender(<SwiftField main="" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<SwiftField opt="F" main="40702840000000000001" caption="ООО «Ромашка»" maxWidth={130} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('StatusDot / FieldTag / Counter', () => {
  it('точка с именем — role=img; без имени скрыта', () => {
    const { container } = renderK(<><StatusDot tone="ok" label="Обработан" /><StatusDot tone="bad" /></>)
    expect(screen.getByRole('img', { name: 'Обработан' })).toBeInTheDocument()
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1)
  })
  it('точка с подписью показывает её тултипом; без подписи — нет', () => {
    renderK(<><StatusDot tone="ok" label="Обработан" /><StatusDot tone="bad" /></>)
    expect(screen.getByRole('img', { name: 'Обработан' })).toHaveAttribute('data-k-tip', 'Обработан')
    expect(document.querySelector('[data-tone="bad"]')).not.toHaveAttribute('data-k-tip')
  })
  it('буква выводится и на светлом тоне', () => {
    renderK(<StatusDot tone="okl" letter="З" />)
    expect(screen.getByText('З')).toHaveAttribute('data-tone', 'okl')
  })
  it('точки с буквами на всех девяти тонах — без нарушений axe', async () => {
    const letters: Record<StatusTone, string> = { flow: 'О', flowl: 'К', flowd: 'П', bad: 'О', badd: 'Н', warn: 'В', ok: 'И', okl: 'Э', grey: 'О' }
    const { container } = renderK(<>{(Object.keys(letters) as StatusTone[]).map((t) => <StatusDot key={t} tone={t} letter={letters[t]} label={t} />)}</>)
    expect(screen.getAllByRole('img')).toHaveLength(9)
    expect(await axe(container)).toHaveNoViolations()
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
