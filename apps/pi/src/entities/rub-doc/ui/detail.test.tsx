import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { ConfigForm } from '@katran/ui'
import { renderK } from '../../../shared/lib/test'
import { RUB_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseRubDocDetail } from '../api/detail.mapper'
import type { RubDocDetail } from '../model/detail'
import { rubDocDetailDomain as dom } from './detail'

const d = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')
const renderMain = (doc: RubDocDetail = d) => {
  const renderSection = dom.renderSection!
  return renderK(
    <ConfigForm schema={dom.schemaOf(doc)} fields={dom.fields} value={(t) => dom.value(doc, t)}
      renderHero={(id) => dom.renderHero(doc, id)} renderBlock={(id) => dom.renderBlock(doc, id)} renderSection={(id) => renderSection(doc, id)} />,
  )
}
const hero = () => document.querySelector('[data-part="hero"]') as HTMLElement

describe('«Общие данные» рубля (rubHtml стенда, index.html:1149)', () => {
  it('сводка: номер · от, операция, очерёдность «неприоритетный», сумма RUB справа', () => {
    renderMain()
    expect(hero()).toHaveTextContent('№ 3741 от 24.09.2026')
    expect(hero()).toHaveTextContent('01 Платёжное поручение')
    expect(hero()).toHaveTextContent('5неприоритетный')
    expect(hero()).toHaveTextContent(/76\s394\.81RUB/)
  })
  it('срочный — тег «СРОЧНО»', () => {
    renderMain({ ...d, prio: 1 })
    expect(within(hero()).getByText('СРОЧНО')).toBeInTheDocument()
  })
  it('платёжный ордер без кода операции (В-Д3) — «не заполнено» и название', () => {
    renderMain({ ...d, type: 'PAYORDRU', opCode: '', opName: 'Платёжный ордер' })
    expect(hero()).toHaveTextContent('не заполнено Платёжный ордер')
  })
  it('сценарий, системы, ссылки линк-кнопками', () => {
    renderMain()
    expect(screen.getByText('SC_NCB_IN_CREDIT')).toBeInTheDocument()
    expect(screen.getByText('Системы').parentElement).toHaveTextContent('NCB.NCB_IN')
    expect(screen.getByRole('button', { name: 'docRef' })).toHaveAttribute('data-k-tip', 'ED101-5210472026066 — копировать')
    expect(screen.getByRole('button', { name: 'УИП' })).toBeEnabled()
  })
  it('стороны: строки по порядку, пустые с обеих сторон — бледные, моноширинные значения', () => {
    renderMain()
    const table = screen.getByRole('table', { name: 'Отправитель и получатель' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['Наименование', 'Опция', 'Номер счёта', 'ИНН', 'КПП', 'Доп. информация', 'Адрес', 'Наименование банка', 'БИК', 'Счёт банка', 'Доп. информация'])
    expect(rows[1]).toHaveAttribute('data-empty')
    expect(rows[10]).not.toHaveAttribute('data-empty')
    expect(table.querySelector('tr[data-part="party-row"]')).toBe(rows[0])
  })
  it('назначение платежа — строкой под сторонами', () => {
    renderMain()
    expect(screen.getByText(/Оплата по счёту № 6945-2101/)).toBeInTheDocument()
  })
  it('секции: свёрнуты; без данных — «нет данных»; посредники — таблица со счётчиком; ED107 — подгруппы', async () => {
    renderMain()
    expect(screen.getByRole('heading', { name: 'Бюджетные реквизиты' }).parentElement).toHaveTextContent('нет данных')
    expect(screen.getByRole('heading', { name: 'Параметры инкассового поручения' }).parentElement).toHaveTextContent('нет данных')
    await userEvent.click(screen.getByRole('button', { name: 'Посредник' }))
    expect(screen.getByText('ФИЛИАЛ № 3826 БАНКА «НУВОСЕ» (ПАО)')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Параметры ED107' }))
    const payer = screen.getByRole('button', { name: 'Информация о банке-плательщике' })
    expect(payer).toHaveAttribute('aria-expanded', 'true')
    expect(payer.closest('div')?.parentElement).toHaveTextContent('4 / 4')
    expect(screen.getByRole('button', { name: 'Информация об агенте банка-получателя' }).closest('div')?.parentElement).toHaveTextContent('0 / 4')
    expect(screen.getByText('DUZFRUY9')).toBeVisible()
  })
  it('шапка и лейн', () => {
    expect(dom.summary(d)).toMatchObject({ label: 'Платёжная инструкция № 3741', uuid: '72aa73fb-dae6-4672-8d09-e15afc0a523d', type: 'PAYDOCRU', kind: 'Платёжное поручение · входящий от ЦБ на клиента', tabsOff: ['stream', 'mpu'] })
  })
  it('без нарушений axe', async () => {
    const { container } = renderMain()
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть все' }))
    expect(await axe(container)).toHaveNoViolations()
  })
})
