import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { renderK } from '../test/renderK'
import { ConfigForm } from './ConfigForm'
import type { FieldDef, FieldValue, FormEdit, FormSchema } from './types'

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

describe('ConfigForm — управляемое раскрытие (спека 2b §3.3, техдолг M-g)', () => {
  const btn = (tag: string) => within(row(tag) as HTMLElement).getByRole('button')
  const form = (p: { expanded?: string[] | undefined; onExpandedChange?: ((keys: string[]) => void) | undefined; schema?: FormSchema | undefined }) => (
    <ConfigForm schema={p.schema ?? schema} fields={fields} value={(t) => values[t] ?? null} renderSection={section}
      expanded={p.expanded} onExpandedChange={p.onExpandedChange} />
  )

  // хозяин держит набор вне формы — как модель деталки держит $expanded по документу
  function Host({ controlled }: { controlled: boolean }) {
    const [keys, setKeys] = useState<string[] | null>(null)
    const [shown, setShown] = useState(true)
    return (
      <>
        <button type="button" onClick={() => setShown((v) => !v)}>Вкладка</button>
        {shown && (controlled ? form({ expanded: keys ?? undefined, onExpandedChange: setKeys }) : form({}))}
      </>
    )
  }

  it('expanded задаёт раскрытые поля и секции', () => {
    renderK(form({ expanded: ['50', 'budget'] }))
    expect(btn('50')).toHaveAttribute('aria-expanded', 'true')
    expect(btn('52')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Бюджетные реквизиты' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Свернуть все' })).toBeInTheDocument()
  })

  it('управляемый режим: действие отдаёт полный новый набор, а показ меняет только хозяин', async () => {
    const onExpandedChange = vi.fn()
    renderK(form({ expanded: ['50', 'budget'], onExpandedChange }))
    await userEvent.click(btn('52'))
    expect(onExpandedChange).toHaveBeenLastCalledWith(['50', 'budget', '52', '57'])
    expect(btn('52')).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Бюджетные реквизиты' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(['50'])
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть поля' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(['budget', '50', '52', '57', '59', '70', '72', 'B.50'])
    await userEvent.click(screen.getByRole('button', { name: 'Свернуть все' }))
    expect(onExpandedChange).toHaveBeenLastCalledWith(['50'])
  })

  it('без expanded форма раскрывает сама, onExpandedChange получает набор с умолчаниями секций', async () => {
    const onExpandedChange = vi.fn()
    const open: FormSchema = { ...schema, sections: [{ id: 'budget', title: 'Бюджетные реквизиты', collapsed: false }] }
    renderK(form({ schema: open, onExpandedChange }))
    expect(screen.getByRole('button', { name: 'Бюджетные реквизиты' })).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(btn('52'))
    expect(btn('52')).toHaveAttribute('aria-expanded', 'true')
    expect(onExpandedChange).toHaveBeenLastCalledWith(['budget', '52', '57'])
  })

  it('раскрытое, хранимое снаружи, переживает размонтирование формы', async () => {
    renderK(<Host controlled />)
    await userEvent.click(btn('52'))
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть все' }))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    expect(row('52')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    expect(btn('52')).toHaveAttribute('aria-expanded', 'true')
    expect(btn('57')).toHaveAttribute('aria-expanded', 'true')
    expect(btn('50')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Бюджетные реквизиты' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('без хозяина раскрытое теряется при размонтировании — поведение 2a, ради которого и нужен управляемый режим', async () => {
    renderK(<Host controlled={false} />)
    await userEvent.click(btn('52'))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    await userEvent.click(screen.getByRole('button', { name: 'Вкладка' }))
    expect(btn('52')).toHaveAttribute('aria-expanded', 'false')
  })

  it('без нарушений axe в управляемом режиме', async () => {
    const { container } = renderK(form({ expanded: ['50', '59', 'budget'] }))
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ConfigForm — правка (спека 2c §2.1)', () => {
  // MT103-подобная схема: сетка 50|55, 52|56, 53|57, 54|59, текст 70, 72
  const mt: FormSchema = { grid: [['50', '55'], ['52', '56'], ['53', '57'], ['54', '59']], text: ['70', '72'] }
  const defs: Record<string, FieldDef> = {
    ...fields,
    '53': { label: 'Корреспондент отправителя', kind: 'bank' },
    '54': { label: 'Корреспондент получателя', kind: 'bank' },
  }
  const editable = ['57', '59', '70', '72']
  const edit: FormEdit = {
    can: (tag) => editable.includes(tag),
    editing: null,
    onEdit: vi.fn(),
    renderEditor: (tag) => <div data-testid={`editor-${tag}`} />,
    state: () => null,
  }
  const base = { schema: mt, fields: defs, value: (t: string) => values[t] ?? null }
  const order = (container: HTMLElement) => [...container.querySelectorAll('[data-field], [data-part="editor"]')].map((el) => el.getAttribute('data-field') ?? 'editor')

  it('редактор поля сетки — после обеих ячеек его строки, на всю ширину', () => {
    const { container } = renderK(<ConfigForm {...base} edit={{ ...edit, editing: '57' }} />)
    const o = order(container)
    expect(o.slice(o.indexOf('53'), o.indexOf('59') + 1)).toEqual(['53', '57', 'editor', '54', '59'])
    expect(screen.getByTestId('editor-57').parentElement).toHaveAttribute('data-part', 'editor')
    expect(screen.getByTestId('editor-57').parentElement).toHaveClass('editor')
    expect(screen.getAllByTestId(/^editor-/)).toHaveLength(1)
  })

  it('редактор поля левой колонки — тоже после обеих ячеек строки', () => {
    const { container } = renderK(<ConfigForm {...base} edit={{ ...edit, can: () => true, editing: '52' }} />)
    const o = order(container)
    expect(o.slice(o.indexOf('52'), o.indexOf('53') + 1)).toEqual(['52', '56', 'editor', '53'])
  })

  it('редактор текстового поля — сразу после поля', () => {
    const { container } = renderK(<ConfigForm {...base} edit={{ ...edit, editing: '70' }} />)
    const o = order(container)
    expect(o.slice(o.indexOf('59'))).toEqual(['59', '70', 'editor', '72'])
    expect(screen.getByTestId('editor-70')).toBeInTheDocument()
  })

  it('can(tag) false — карандаша нет; один редактор: editing одно значение', async () => {
    const onEdit = vi.fn()
    renderK(<ConfigForm {...base} edit={{ ...edit, onEdit }} />)
    expect(screen.queryByRole('button', { name: 'Редактировать поле 52' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Редактировать поле 53' })).toBeNull()
    for (const tag of editable) expect(screen.getByRole('button', { name: `Редактировать поле ${tag}` })).toBeInTheDocument()
    expect(document.querySelector('[data-part="editor"]')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Редактировать поле 59' }))
    expect(onEdit).toHaveBeenCalledWith('59')
  })

  it('ячейка с открытым редактором — data-editing, у других нет', () => {
    renderK(<ConfigForm {...base} edit={{ ...edit, editing: '57' }} />)
    expect(row('57')).toHaveAttribute('data-editing')
    expect(document.querySelectorAll('[data-editing]')).toHaveLength(1)
  })

  it('state(tag) доходит до строки: изменённое поле помечено', () => {
    const state = (tag: string) => (tag === '57' ? { changed: true, was: { lines: ['OLD BANK'] }, tip: 'Изменено: Петрова А. С., 22.09.2026 10:42' } : null)
    renderK(<ConfigForm {...base} edit={{ ...edit, state }} />)
    expect(row('57')).toHaveAttribute('data-edited')
    expect(row('59')).not.toHaveAttribute('data-edited')
  })

  it('без edit — ни карандашей, ни редактора (вид 2a/2b)', () => {
    renderK(<ConfigForm {...base} />)
    expect(screen.queryByRole('button', { name: /Редактировать/ })).toBeNull()
    expect(document.querySelector('[data-part="editor"]')).toBeNull()
  })

  it('без нарушений axe с открытым редактором', async () => {
    const { container } = renderK(<ConfigForm {...base} edit={{ ...edit, editing: '57', renderEditor: () => <section data-k-edit="" aria-label="Поле 57 — правка"><input aria-label="Строка 1" /></section> }} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
