import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { ConfigForm } from './ConfigForm'
import type { FieldDef, FieldValue, FormSchema } from './types'

// Упрощённый MT103/MT202COV стенда (PROFILES, index.html:625): пары 50–54 | 55–59, текст 70/72, extra, последовательность B, секции
const fields: Record<string, FieldDef> = {
  '20': { label: 'Референс отправителя', kind: 'ref' },
  '33B': { label: 'Валюта и сумма инструкции', kind: 'short' },
  '36': { label: 'Курс', kind: 'short' },
  '50': { label: 'Приказодатель', kind: 'party', opts: ['A', 'F', 'K'] },
  '52': { label: 'Банк приказодателя', kind: 'bank', opts: ['A', 'D'] },
  '55': { label: 'Третье возмещающее учреждение', kind: 'bank' },
  '56': { label: 'Банк-посредник', kind: 'bank' },
  '57': { label: 'Банк получателя', kind: 'bank' },
  '59': { label: 'Бенефициар', kind: 'party' },
  '70': { label: 'Детали платежа', kind: 'text', lines: 4, width: 35 },
  '72': { label: 'Информация отправителя получателю', kind: 'text', lines: 6, width: 35, show: 4 },
}
const values: Record<string, FieldValue> = {
  '50': { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH'] },
  '52': { opt: 'A', lines: ['NORDINVEST BANK MOSCOW', 'NRDIRUMMXXX'] },
  '57': { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK KHABAROVSK BR', 'VKRBRU8KXXX'] },
  '59': { opt: 'F', acc: '40817840100050017762', lines: ['SEMENOVA IRINA VLADIMIROVNA'] },
  '70': { lines: ['/INV/ 2026-0417 DD 15.09.2026'] },
  '72': { lines: ['/INS/ NRDIRUMMXXX'] },
  '33B': { lines: ['EUR 1148300,00'] },
  'B.50': { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH'] },
}
const schema: FormSchema = {
  hero: ['20', 'sum'],
  blocks: ['msgs', 'tx'],
  fieldsTitle: 'Поля MT103',
  fieldsHint: '50–54 слева · 55–59 справа',
  grid: [['50', { tag: '55', hideIfEmpty: true }], ['52', '57'], [{ tag: '55', hideIfEmpty: true }, { tag: '56', hideIfEmpty: true }], [null, '59']],
  text: ['70', '72'],
  extra: ['33B', '36'],
  seqB: { title: 'Покрываемый клиентский платёж · последовательность B', grid: [['B.50', null]] },
  sections: [{ id: 'budget', title: 'Бюджетные реквизиты' }, { id: 'agents', title: 'Посредник' }],
}
const hero = (id: string) => (id === 'sum' ? { label: '32A · сумма', value: '1 250 000.00 USD', align: 'right' as const } : { label: '20 · № / от', value: 'FX2609220000417', tip: '20 · Референс отправителя' })
const section = (id: string) => (id === 'budget' ? { body: <p>Код статуса плательщика 51</p> } : null)

const renderForm = () => renderK(
  <ConfigForm schema={schema} fields={fields} value={(t) => values[t] ?? null} renderHero={hero} renderBlock={(id) => <div>Блок {id}</div>} renderSection={section} />,
)
const row = (tag: string) => document.querySelector(`[data-field="${tag}"]`)

describe('ConfigForm (спека 2a §3.1)', () => {
  it('сводка: ячейки по схеме, последняя справа, подсказка подписи', () => {
    renderForm()
    const heroEl = document.querySelector('[data-part="hero"]')!
    expect(heroEl).toHaveTextContent('20 · № / от')
    expect(heroEl).toHaveTextContent('1 250 000.00 USD')
    expect(within(heroEl as HTMLElement).getByText('20 · № / от')).toHaveAttribute('data-k-tip', '20 · Референс отправителя')
    expect(within(heroEl as HTMLElement).getByText('1 250 000.00 USD').closest('[data-align]')).toHaveAttribute('data-align', 'right')
  })

  it('блоки — слотами приложения, в порядке схемы, до полей', () => {
    renderForm()
    const text = document.body.textContent ?? ''
    expect(text.indexOf('Блок msgs')).toBeLessThan(text.indexOf('Блок tx'))
    expect(text.indexOf('Блок tx')).toBeLessThan(text.indexOf('Поля MT103'))
  })

  it('сетка: пары, null и скрытое пустое — промежуток, строка из двух скрытых пропадает', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: 'Поля MT103' })).toBeInTheDocument()
    expect(screen.getByText('50–54 слева · 55–59 справа')).toBeInTheDocument()
    expect(row('50')).not.toBeNull()
    expect(row('55')).toBeNull()
    expect(row('56')).toBeNull()
    // промежутки: скрытое 55 в первой строке, null перед 59, null в строке последовательности B
    expect(document.querySelectorAll('[data-part="gap"]')).toHaveLength(3)
    expect(row('59')).not.toBeNull()
  })

  it('поле раскрывается вместе с соседом по строке', async () => {
    renderForm()
    await userEvent.click(within(row('52') as HTMLElement).getByRole('button'))
    expect(within(row('52') as HTMLElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(within(row('57') as HTMLElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(within(row('50') as HTMLElement).getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('«Развернуть поля» раскрывает все заполненные, подпись меняется', async () => {
    renderForm()
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть поля' }))
    for (const t of ['50', '52', '57', '59', 'B.50']) expect(within(row(t) as HTMLElement).getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Свернуть поля' })).toBeInTheDocument()
  })

  it('extra: значение одной строкой, пустое — «не заполнено»', () => {
    renderForm()
    expect(screen.getByText('EUR 1148300,00')).toBeInTheDocument()
    expect(screen.getByText('36').parentElement).toHaveTextContent('не заполнено')
  })

  it('последовательность B — заголовок и поля с префиксом', () => {
    renderForm()
    expect(screen.getByRole('heading', { name: 'Покрываемый клиентский платёж · последовательность B' })).toBeInTheDocument()
    expect(row('B.50')).toHaveTextContent('LAVRENTIEV')
  })

  it('секции: свёрнуты по умолчанию, пустая — «нет данных», «Развернуть все»', async () => {
    renderForm()
    expect(screen.getByRole('button', { name: 'Бюджетные реквизиты' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('heading', { name: 'Посредник' }).parentElement).toHaveTextContent('нет данных')
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть все' }))
    expect(screen.getByText('Код статуса плательщика 51')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Свернуть все' })).toBeInTheDocument()
  })

  it('без полей в схеме — нет заголовка полей и ссылки «Развернуть поля»', () => {
    renderK(<ConfigForm schema={{ hero: ['20'], blocks: ['party'] }} fields={{}} value={() => null} renderHero={hero} renderBlock={() => <div>Стороны</div>} />)
    expect(screen.queryByRole('button', { name: 'Развернуть поля' })).toBeNull()
    expect(screen.getByText('Стороны')).toBeInTheDocument()
  })

  it('без нарушений axe', async () => {
    const { container } = renderForm()
    expect(await axe(container)).toHaveNoViolations()
  })
})
