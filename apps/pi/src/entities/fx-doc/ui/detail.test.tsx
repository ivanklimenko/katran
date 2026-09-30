import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { ConfigForm } from '@katran/ui'
import { renderK } from '../../../shared/lib/test'
import { FX_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseFxDocDetail } from '../api/detail.mapper'
import type { FxDocDetail } from '../model/detail'
import { fxDocDetailDomain as dom } from './detail'

const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
const renderMain = (doc: FxDocDetail = d) => renderK(
  <ConfigForm schema={dom.schemaOf(doc)} fields={dom.fields} value={(t) => dom.value(doc, t)} present={dom.present}
    optionLabels={dom.optionLabels} renderHero={(id) => dom.renderHero(doc, id)} renderBlock={(id) => dom.renderBlock(doc, id)} />,
)
const hero = () => document.querySelector('[data-part="hero"]') as HTMLElement

describe('«Общие данные» валюты (PROFILES стенда)', () => {
  it('сводка MT103: 20 · № / от, 71A, валютирование с ✓, сумма справа', () => {
    renderMain()
    expect(hero()).toHaveTextContent('FX2609220000417')
    expect(hero()).toHaveTextContent('№ 812345 от 23.09.2026')
    expect(hero()).toHaveTextContent('OUR')
    expect(within(hero()).getByRole('img', { name: 'Вх, Исх, по Дт и по Кт совпадают' })).toBeInTheDocument()
    expect(hero()).toHaveTextContent(/1\s500\.50USD/)
  })

  it('сообщения: S → R входящего и исходящего, 20 исх — «не заполнено», счета группами', () => {
    renderMain()
    expect(screen.getByText('Входящее SWIFT').parentElement).toHaveTextContent('NRDIRUMMXXX→VKRBRU8KXXX')
    expect(screen.getByText('Исходящее SWIFT').parentElement).toHaveTextContent('не заполнено')
    expect(screen.getByText('30110 840 7 0000 0001842')).toBeInTheDocument()
  })

  it('маршрут раскрыт, транзакции свёрнуты со сводкой', async () => {
    renderMain()
    expect(screen.getByRole('button', { name: 'Маршрут' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Маршрут через Baltic Clearing по правилу для USD от контрагентов ЕС')).toBeVisible()
    const tx = screen.getByRole('button', { name: 'Транзакции' })
    expect(tx).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('img', { name: 'PENDING' })).toBeInTheDocument()
    await userEvent.click(tx)
    expect(screen.getByText('00030_FxConversion')).toBeVisible()
  })

  it('поля: сторона со счётом, банк с BIC, пустое 55 скрыто, пары 53–57', () => {
    renderMain()
    const f50 = document.querySelector('[data-field="50"]') as HTMLElement
    expect(f50).toHaveTextContent('LAVRENTIEV DMITRY OLEGOVICH')
    expect(f50).toHaveTextContent('40817840500010042371')
    expect(document.querySelector('[data-field="57"]')).toHaveTextContent('VKRBRU8KXXX')
    expect(document.querySelector('[data-field="55"]')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Поля MT103' })).toBeInTheDocument()
    expect(screen.getByText('77B').parentElement).toHaveTextContent('не заполнено')
  })

  it('MT202COV — последовательность B; MT199 — только 79, без «Развернуть поля»', () => {
    const cov: FxDocDetail = { ...d, type: 'MT202COV', fields: { ...d.fields, 'B.50': d.fields['50']! } }
    const { unmount } = renderMain(cov)
    expect(screen.getByRole('heading', { name: 'Покрываемый клиентский платёж · последовательность B' })).toBeInTheDocument()
    expect(document.querySelector('[data-field="B.50"]')).toHaveTextContent('LAVRENTIEV')
    unmount()
    renderMain({ ...d, type: 'MT199', fields: { ...d.fields, '79': { lines: ['RE YOUR MT103 FX2609220000417'] } } })
    expect(document.querySelector('[data-field="79"]')).toHaveTextContent('RE YOUR MT103')
    expect(screen.queryByRole('button', { name: 'Развернуть поля' })).toBeNull()
  })

  it('шапка и лейн: из детали и из строки реестра; заголовок — как на эталоне (В-Д1)', () => {
    expect(dom.title).toBe('Платёжная инструкция ВАЛЮТА')
    expect(dom.summary(d)).toEqual({
      label: 'Платёжная инструкция ВАЛЮТА № 812345', uuid: 'u1', created: '23.09.2026 10:52:11', type: 'MT103',
      status: { tone: 'bad', label: 'Ошибка' }, kind: 'Клиентский перевод · Входящий от ЦБ', tabsOff: ['mpu'],
    })
    expect(dom.rowSummary(d).tabsOff).toEqual([])
  })

  it('без нарушений axe', async () => {
    const { container } = renderMain()
    expect(await axe(container)).toHaveNoViolations()
  })
})
