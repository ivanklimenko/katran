import { getDefaultNormalizer, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { formatAmount } from '@katran/ui'
import { TRAIL_EXAMPLES } from '../api/trail.example'
import { TRAIL_PARSERS } from '../api/trail.mapper'
import type { AuditSections, LinkedDoc, MpuMessage, SourceTexts, TrailTabId } from '../model/types'
import { AuditTab } from './AuditTab'
import { LinkedTab } from './LinkedTab'
import { MpuTab } from './MpuTab'
import { SourceTab } from './SourceTab'
import { renderTab, shown, toggles } from './testing'
import { TRAIL_VIEWS } from './views'

// Данные — со стенда (index.html:767–871, обезличен), в доменных типах Task 7
const ID1 = 'a18d3c05-b393-4252-a3c1-c93791937ccc'
const ID2 = '5e9b7255-c859-4786-b92a-5315c1b73227'
const LINKED: LinkedDoc[] = [
  {
    docId: ID1, date: '2026-09-23', type: 'InternalFXDOC', relation: 'CHILD', purpose: 'MT103 USD 1249965.00 23.09.2026 возврат (1.6.2.2.1.)',
    status: 'NEW', processed: '2026-09-23T09:02:11', posted: '2026-09-23', kind: 'SHA',
    debit: { account: '40817840100050017762', amount: '1249965.00', currency: 'USD', register: '00010_ClientCurrent' },
    credit: { account: '30110840700000001842', amount: '1249965.00', currency: 'USD', register: '00000_NostroUSD' },
    from: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', extra: null },
    to: { name: 'LAVRENTIEV DMITRY OLEGOVICH', account: '40817840500010042371', extra: 'RETURN OF FX2609220000417' },
  },
  {
    docId: ID2, date: '2026-09-22', type: 'InternalFXFEE', relation: 'CHILD', purpose: 'Комиссия за входящий перевод по тарифу OUR',
    status: 'DONE', processed: '2026-09-22T07:35:01', posted: '2026-09-22', kind: 'OUR',
    debit: { account: '40817840100050017762', amount: '35.00', currency: 'USD', register: '00010_ClientCurrent' },
    credit: { account: '70601840100000000519', amount: '35.00', currency: 'USD', register: '00020_CommissionIncome' },
    from: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', extra: null },
    to: { name: 'VOSTOCHNY KREDIT BANK', account: '70601840100000000519', extra: 'Тариф 4.2.1' },
  },
]
const SWIFT_199 = '{1:F01VKRBRU8KXXXX0000000000}{2:I199NRDIRUMMXXXXN}{3:{121:eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10}}{4:\n:20:VK2609220000417\n:21:FX2609220000417\n:79:YOUR MT103 FX2609220000417 DD 22.09.2026\n-}'
const MPU: MpuMessage[] = [
  {
    id: 'ee8bf4eb-5545-4f07-9617-8a5e7106302f', type: 'MT199', created: '2026-09-22T04:35:02.121', exportStatus: 'SENT',
    exported: '2026-09-22T04:35:47.308', receiver: 'NRDIRUMMXXX', docReference: 'VK2609220000417', docId: '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8', swift: SWIFT_199,
  },
  {
    id: 'f1c2a7d0-3b4e-4a51-9c86-2e7d5b9a0c14', type: 'MT199', created: '2026-09-22T04:36:10.004', exportStatus: 'NEW',
    exported: null, receiver: 'NRDIRUMMXXX', docReference: 'VK2609220000418', docId: '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8', swift: SWIFT_199,
  },
]
const AUDIT: AuditSections = {
  commonSection: { creationDate: '2026-09-22T04:31:45.051765Z', paymentServiceProvider: 'SUBOUL', paymentFlow: null, paymentInitiatorSystem: 'ERS.ERS_1', sourceSystem: 'SRC1', resending: false },
  documentSection: { docReferenceIn: 'FX2609220000417', messageType: 'MT103', amount: 1250000, currency: 'USD' },
  taskSections: { open: 1 },
}
const SOURCE: SourceTexts = {
  swiftMessage: '{1:F01VKRBRU8KXXXX0427047245}{4:\n:20:FX2609220000417\n:23B:CRED\n-}',
  outgoingSwiftMessage: '',
  ED244: '<?xml version="1.0" encoding="UTF-8"?><ED244 xmlns="urn:cbr-ru:ed:v2.0" EDNo="1" EDDate="2026-09-23"><Annotation>ОТВЕТ</Annotation></ED244>',
}
const HOSTILE = '<img src=x onerror=alert(1)>'

describe('LinkedTab (эталон linkedHtml)', () => {
  it('по умолчанию раскрыта первая запись: ID ссылкой-кнопкой и копированием, карточка, Дт/Кт, отправитель/получатель', () => {
    renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />)
    // имя переключателя — «Свернуть/Раскрыть» + rowLabel «дата · тип»
    expect(screen.getByRole('button', { name: 'Свернуть 2026-09-23 · InternalFXDOC' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Раскрыть 2026-09-22 · InternalFXFEE' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryAllByRole('columnheader', { name: '' })).toHaveLength(0)
    expect(screen.getByRole('button', { name: `Открыть InternalFXDOC ${ID1} в соседней панели` })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скопировать ID' })).toBeInTheDocument()
    expect(screen.getByText('23.09.2026')).toBeInTheDocument()
    const postings = screen.getByRole('table', { name: `Проводки ${ID1}` })
    expect(within(postings).getByRole('columnheader', { name: 'Дт' })).toBeInTheDocument()
    expect(within(postings).getByText('00000_NostroUSD')).toBeInTheDocument()
    // сумма бека — десятичная строка без группировки, показ — formatAmount кита (разряды — NBSP: без схлопывания пробелов,
    // иначе нормализатор testing-library превращает NBSP текста узла в пробел, а строку запроса — нет)
    expect(within(postings).getAllByText(formatAmount(1249965), { normalizer: getDefaultNormalizer({ collapseWhitespace: false }) })).toHaveLength(2)
    expect(within(postings).queryByText('1249965.00')).toBeNull()
    const parties = screen.getByRole('table', { name: `Отправитель и получатель ${ID1}` })
    expect(within(parties).getByText('RETURN OF FX2609220000417')).toBeInTheDocument()
    expect(within(parties).getByText('не заполнено')).toBeInTheDocument()
    expect(shown('00020_CommissionIncome')).toBe(false)
  })
  it('ID открывает документ в B и строку не сворачивает', async () => {
    const { spies } = renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: `Открыть InternalFXDOC ${ID1} в соседней панели` }))
    expect(spies.openDocument).toHaveBeenCalledWith(ID1)
    expect(spies.setExpanded).not.toHaveBeenCalled()
  })
  it('клик по второй строке — раскрыты обе; раскрытие [] из контекста — все свёрнуты', async () => {
    const { spies, unmount } = renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: 'Раскрыть 2026-09-22 · InternalFXFEE' }))
    expect(spies.setExpanded).toHaveBeenLastCalledWith([ID1, ID2])
    expect(shown('00020_CommissionIncome')).toBe(true)
    unmount()
    renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />, [])
    expect(toggles().map((b) => b.getAttribute('aria-expanded'))).toEqual(['false', 'false'])
  })
  it('пусто — «Связанных документов нет»; назначение из бека — текст, не разметка', () => {
    const { unmount } = renderTab((ctx) => <LinkedTab data={[]} ctx={ctx} />)
    expect(screen.getByText('Связанных документов нет')).toBeInTheDocument()
    unmount()
    const { container } = renderTab((ctx) => <LinkedTab data={[{ ...LINKED[0]!, purpose: HOSTILE }]} ctx={ctx} />)
    expect(screen.getAllByText(HOSTILE).length).toBeGreaterThan(0)
    expect(container.querySelector('img')).toBeNull()
  })
  it('без нарушений axe (первая запись раскрыта)', async () => {
    const { container } = renderTab((ctx) => <LinkedTab data={LINKED} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('MpuTab (эталон mpuHtml)', () => {
  it('карточка сообщения: ID с копированием, статус бейджем, тип, получатель, время, docReference, docId', () => {
    renderTab((ctx) => <MpuTab data={MPU} ctx={ctx} />)
    const card = screen.getByRole('region', { name: `Сообщение MPU MT199 ${MPU[0]!.id}` })
    expect(within(card).getByRole('button', { name: MPU[0]!.id })).toBeInTheDocument()
    expect(within(card).getByText('Статус на экспорте')).toBeInTheDocument()
    expect(within(card).getByText('SENT')).toBeInTheDocument()
    expect(within(card).getByText('VK2609220000417')).toBeInTheDocument()
    const second = screen.getByRole('region', { name: `Сообщение MPU MT199 ${MPU[1]!.id}` })
    expect(within(second).getByText('не заполнено')).toBeInTheDocument()
  })
  it('swiftText: у первого раскрыт по умолчанию, длина в заголовке; раскрытие второго — в контекст', async () => {
    const { spies } = renderTab((ctx) => <MpuTab data={MPU} ctx={ctx} />)
    const [first, second] = screen.getAllByRole('button', { name: 'swiftText' })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(second).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getAllByText(`${SWIFT_199.length} симв.`)).toHaveLength(2)
    expect(screen.getByRole('region', { name: `swiftText сообщения ${MPU[0]!.id}` })).toHaveTextContent(':20:VK2609220000417')
    await userEvent.click(second!)
    expect(spies.setExpanded).toHaveBeenLastCalledWith([MPU[0]!.id, MPU[1]!.id])
    expect(second).toHaveAttribute('aria-expanded', 'true')
  })
  it('пусто — «Сообщений MPU нет»', () => {
    renderTab((ctx) => <MpuTab data={[]} ctx={ctx} />)
    expect(screen.getByText('Сообщений MPU нет')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <MpuTab data={MPU} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('AuditTab (эталон auditHtml)', () => {
  it('секция — аккордеон с числом ключей; по умолчанию раскрыта commonSection с JSON', () => {
    renderTab((ctx) => <AuditTab data={AUDIT} ctx={ctx} />)
    expect(screen.getByRole('button', { name: 'commonSection' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'documentSection' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('6 ключей')).toBeInTheDocument()
    expect(screen.getByText('4 ключа')).toBeInTheDocument()
    expect(screen.getByText('1 ключ')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Секция аудита commonSection' })).toHaveTextContent('paymentServiceProvider')
    expect(screen.getByRole('region', { name: 'Секция аудита commonSection' })).toHaveTextContent('SUBOUL')
  })
  it('открыть и закрыть секцию — в контекст', async () => {
    const { spies } = renderTab((ctx) => <AuditTab data={AUDIT} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: 'documentSection' }))
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['commonSection', 'documentSection'])
    await userEvent.click(screen.getByRole('button', { name: 'commonSection' }))
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['documentSection'])
    expect(screen.getByRole('button', { name: 'commonSection' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('пусто — «Аудит пуст»', () => {
    renderTab((ctx) => <AuditTab data={{}} ctx={ctx} />)
    expect(screen.getByText('Аудит пуст')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <AuditTab data={AUDIT} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('SourceTab (эталон sourceHtml)', () => {
  it('по умолчанию раскрыты все непустые; длина в заголовке; пустой ключ не раскрывается', () => {
    renderTab((ctx) => <SourceTab data={SOURCE} ctx={ctx} />)
    expect(screen.getByRole('button', { name: 'swiftMessage' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'ED244' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(`${SOURCE.swiftMessage!.length} симв.`)).toBeInTheDocument()
    const empty = screen.getByRole('heading', { name: 'outgoingSwiftMessage' })
    expect(empty.parentElement).toHaveTextContent('нет')
    expect(empty.parentElement).not.toHaveTextContent('нет данных')
    expect(screen.queryByRole('button', { name: 'outgoingSwiftMessage' })).toBeNull()
    expect(screen.getByRole('region', { name: 'swiftMessage' })).toHaveTextContent(':20:FX2609220000417')
    expect(screen.getByRole('region', { name: 'ED244' })).toHaveTextContent('ОТВЕТ')
  })
  it('свернуть исходник — в контекст; раскрытие из контекста важнее умолчания', async () => {
    const { spies, unmount } = renderTab((ctx) => <SourceTab data={SOURCE} ctx={ctx} />)
    await userEvent.click(screen.getByRole('button', { name: 'swiftMessage' }))
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['ED244'])
    unmount()
    renderTab((ctx) => <SourceTab data={SOURCE} ctx={ctx} />, [])
    expect(screen.getByRole('button', { name: 'ED244' })).toHaveAttribute('aria-expanded', 'false')
  })
  it('пусто — «Исходного текста нет»; исходник из бека — текст, не разметка', () => {
    const { unmount } = renderTab((ctx) => <SourceTab data={{}} ctx={ctx} />)
    expect(screen.getByText('Исходного текста нет')).toBeInTheDocument()
    unmount()
    const { container } = renderTab((ctx) => <SourceTab data={{ ED244: HOSTILE, swiftMessage: `{4:\n:70:${HOSTILE}\n-}` }} ctx={ctx} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByRole('region', { name: 'swiftMessage' })).toHaveTextContent(HOSTILE)
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <SourceTab data={SOURCE} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('TRAIL_VIEWS — контракт с TRAIL_PARSERS', () => {
  const ids = Object.keys(TRAIL_PARSERS) as TrailTabId[]
  it('ключи видов и парсеров совпадают; все удалённые; скелетон «Задач» — 5 строк', () => {
    expect(Object.keys(TRAIL_VIEWS).sort()).toEqual([...ids].sort())
    for (const id of ids) expect(TRAIL_VIEWS[id].kind, id).toBe('remote')
    expect(TRAIL_VIEWS.tasks.skeletonRows).toBe(5)
  })
  it('каждый вид рисует пример своей вкладки после своего парсера — без нарушений axe', async () => {
    for (const id of ids) {
      const data = TRAIL_PARSERS[id](TRAIL_EXAMPLES[id], id)
      const { container, unmount } = renderTab((ctx) => TRAIL_VIEWS[id].render(data, ctx))
      expect(container.textContent, id).not.toBe('')
      expect(await axe(container), id).toHaveNoViolations()
      unmount()
    }
  })
})
