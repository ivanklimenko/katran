import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { ConfigForm } from '@katran/ui'
import { renderK } from '../../../shared/lib/test'
import { FX_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseFxDocDetail } from '../api/detail.mapper'
import { INTERNAL_COMMISSION, INTERNAL_REFUND, MT103_INSTRUCTION, MT103_WITH_OUT_REF, MT202_TREASURY } from '../api/instruction.fixture'
import type { FxDocDetail } from '../model/detail'
import { fxDocDetailDomain as dom } from './detail'

const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
const renderMain = (doc: FxDocDetail = d) => renderK(
  <ConfigForm schema={dom.schemaOf(doc)} fields={dom.fields} value={(t) => dom.value(doc, t)} present={dom.present}
    fieldTip={dom.fieldTip ? (tag) => dom.fieldTip?.(doc, tag) : undefined}
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

describe('«Общие данные» на структурах из тестовой выгрузки', () => {
  it('MT103: виден исходящий получатель без отправителя, пустые даты не отмечаются совпавшими', () => {
    renderMain(parseFxDocDetail(MT103_WITH_OUT_REF, 'ответ'))
    const outbound = screen.getByText('Исходящее SWIFT').parentElement
    expect(outbound).toHaveTextContent('→DEMOAM2XBBB')
    expect(outbound).toHaveTextContent('TESTOUT103')
    expect(screen.getByText('Входящее SWIFT').parentElement).not.toHaveTextContent('TEST-DOC-REF')
    expect(screen.queryByRole('img', { name: 'Вх, Исх, по Дт и по Кт совпадают' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Маршрут' })).toBeNull()
  })

  it('MT103: полный вид сохраняет исходные коды строк 50F и клиринговый код 52D', async () => {
    renderMain(parseFxDocDetail(MT103_INSTRUCTION, 'ответ'))
    await userEvent.click(screen.getByRole('button', { name: 'Развернуть поля' }))
    const ordering = document.querySelector('[data-field="50"]')
    expect(ordering).toHaveTextContent('1/TEST PAYER')
    expect(ordering).toHaveTextContent('1/UNIT B')
    expect(ordering).not.toHaveTextContent('2/ 1/UNIT B')
    const bank = document.querySelector('[data-field="52"]')
    expect(bank).toHaveTextContent('//XX000123')
    expect(bank).not.toHaveTextContent('1/ //XX000123')
  })

  it('внутренняя комиссия показывает обычные реквизиты и проводки без SWIFT-сетки', async () => {
    const d = parseFxDocDetail(INTERNAL_COMMISSION, 'ответ')
    renderMain(d)
    expect(dom.rowSummary(d).kind).toBe('Внутренняя валютная инструкция · Комиссия')
    expect(hero()).toHaveTextContent('№ 880002')
    expect(hero()).toHaveTextContent('18.01.2026')
    expect(hero()).toHaveTextContent('12.30USD')
    expect(screen.getByText('TEST-FEE-REF')).toBeVisible()
    expect(screen.getByText('TEST BENEFICIARY')).toBeVisible()
    expect(screen.getByText('Тестовая комиссия')).toBeVisible()
    expect(screen.queryByText('Входящее SWIFT')).toBeNull()
    expect(document.querySelector('[data-field]')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Транзакции' }))
    expect(screen.getByText('TEST_CREDIT')).toBeVisible()
  })

  it('возврат показывает счёт получателя и исходный референс при отсутствующем имени и проводках', () => {
    renderMain(parseFxDocDetail(INTERNAL_REFUND, 'ответ'))
    expect(screen.getByText('TEST-ORIGINAL-REF')).toBeVisible()
    expect(screen.getByText('TEST REFUND BANK')).toBeVisible()
    expect(screen.getByText('40702000000000000022')).toBeVisible()
    expect(screen.queryByText('Назначение платежа')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Транзакции' })).toBeNull()
  })
})

it('MT202 без тела SWIFT показывает дату и референсы инструкции, банки и поле 72', () => {
  renderMain(parseFxDocDetail({
    ...MT202_TREASURY,
    documentSection: {
      ...MT202_TREASURY.documentSection,
      mainEntityInfo: { messageTypeOut: 'MT202', docReferenceOut: 'TEST-OUTGOING-INSTRUCTION' },
    },
  }, 'ответ'))
  const summary = within(hero())
  expect(summary.getByText('Референс инструкции · № / от')).toBeVisible()
  expect(summary.getByText('TEST-TREASURY')).toBeVisible()
  expect(summary.getByText('Исходный референс')).toBeVisible()
  expect(summary.getByText('TEST-ORIGINAL202')).toBeVisible()
  expect(summary.getByText('22.01.2026')).toBeVisible()
  expect(summary.queryByRole('img', { name: 'Вх, Исх, по Дт и по Кт совпадают' })).toBeNull()
  expect(document.querySelector('[data-field="58"]')).toHaveTextContent('SYNTHETIC BENEFICIARY BANK')
  expect(document.querySelector('[data-field="72"]')).toHaveTextContent('/BNF/ TEST TREASURY')
  expect(screen.getByText('Входящее SWIFT').parentElement).not.toHaveTextContent('TEST-TREASURY')
  const out = within(screen.getByText('Исходящее SWIFT').parentElement!)
  expect(out.getByText('Референс исходящей инструкции')).toBeVisible()
  expect(out.getByText('TEST-OUTGOING-INSTRUCTION')).toBeVisible()
  expect(out.queryByText('20 исх')).toBeNull()
})

describe('пути маппинга на «Общих данных»', () => {
  const url = window.location.href
  beforeEach(() => window.history.replaceState(null, '', '/?mapping=1#/fx-docs'))
  afterEach(() => window.history.replaceState(null, '', url))

  it('при наведении показывает путь к реально выбранному банку MT202 и к дате инструкции', async () => {
    renderMain(parseFxDocDetail(MT202_TREASURY, 'ответ'))
    await userEvent.hover(screen.getByText('SYNTHETIC BENEFICIARY BANK'))
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent('$.documentSection.transferTransactionInformation.beneficiaryPart.bankName')
    expect(tip).toHaveTextContent('$.documentSection.transferTransactionInformation.beneficiaryPart.swiftCode')
    expect(tip).toHaveTextContent('$.documentSection.transferTransactionInformation.beneficiaryPart.bankAccount')
    await userEvent.hover(within(hero()).getByText('22.01.2026'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('$.documentSection.valueDate')
  })

  it('различает сырой SWIFT, плоские поля и пустой банк', async () => {
    const { unmount } = renderMain(parseFxDocDetail(MT103_INSTRUCTION, 'ответ'))
    expect(document.querySelector('[data-field="52"]')).toHaveAttribute(
      'data-k-tip', expect.stringContaining('$.documentSection.swift.incomingSwiftMessage.field52A.account'),
    )
    expect(document.querySelector('[data-field="54"]')).toHaveAttribute('data-k-tip', 'Значение отсутствует в источнике')
    unmount()
    renderMain()
    expect(document.querySelector('[data-field="52"]')).toHaveAttribute('data-k-tip', '$.fields["52"]')
  })

  it('подсказывает путь к счёту стороны и к конкретной проводке', async () => {
    renderMain(parseFxDocDetail(INTERNAL_COMMISSION, 'ответ'))
    await userEvent.hover(screen.getByText('40702000000000000022'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('$.documentSection.transferTransactionInformation.payeePart.payee.accountNumber')
    await userEvent.click(screen.getByRole('button', { name: 'Транзакции' }))
    await userEvent.hover(screen.getByText('TEST_CREDIT'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent('$.paymentTransactionSections[0].transactionOperations[1].registerType')
  })
})
