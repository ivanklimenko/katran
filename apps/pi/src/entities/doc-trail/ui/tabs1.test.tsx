import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { axe } from 'jest-axe'
import { formatDuration } from '@katran/ui'
import type { TabContext } from '../../../shared/lib/detail'
import { HOST_LINK_MISSING, configureHostLinks } from '../../../shared/lib/host-links'
import { renderK } from '../../../shared/lib/test'
import type { Compliance, DocNotification, DocTask, StatusEvent, StreamEvent } from '../model/types'
import { ComplianceTab } from './ComplianceTab'
import { STUB, codeLanguage, keysLabel, toggleKey } from './lib'
import { NotificationsTab } from './NotificationsTab'
import { StatusesTab } from './StatusesTab'
import { StreamTab } from './StreamTab'
import { TasksTab } from './TasksTab'
import { TEST_DOC_ID, renderTab, shown, toggles } from './testing'

// Данные — со стенда (index.html:767–871, обезличен), в доменных типах Task 7
const STATUSES: StatusEvent[] = [
  { at: '2026-09-22T07:31:45.241', route: null, code: 'fx-dup-check.end', reason: null },
  { at: '2026-09-22T07:31:45.642', route: 'RT_FX_IN', code: 'fx-in-checks.start', reason: null },
  { at: '2026-09-22T07:31:48.141', route: 'RT_FX_IN', code: 'fx-in-routing.start', reason: 'Ожидание решения сотрудника' },
  { at: '2026-09-22T07:33:20.383', route: 'RT_FX_IN', code: 'fx-in-routing.end', reason: null },
  { at: '2026-09-22T07:35:01.915', route: 'RT_FX_CREDIT', code: 'fx.finish', reason: null },
]
const COMPLIANCE: Compliance = {
  record: { id: '3e854037-b84c-40ee-90e0-440734c1d5e3', start: '2026-09-22T07:31:48.126', end: '2026-09-22T07:31:52.601', nzr: false },
  negative: { decision: null, direction: null, comment: null },
  monitoring: {
    start: '2026-09-22T07:31:48.220', end: '2026-09-22T07:31:49.601', decision: 'ALLOW',
    txId: '97cae8c7162531f4093e1db5d7171bde', requestAt: '2026-09-22T07:31:49.354', clientId: 'CLT0000123456789',
  },
  department: { start: '2026-09-22T07:31:49.719', end: null, decision: 'REVIEW' },
  history: [{ at: '2026-09-22T07:31:51', system: '3308_CTRL', department: 'DEP 0417' }],
}
const TASKS: DocTask[] = [
  {
    id: 't1', state: 'done', tone: 'ok', type: 'PAYMENT_INSTRUCTION', at: '2026-09-22T07:31:59',
    text: 'Требуется подтвердить маршрут; требуется утвердить зачисление по клиентскому счёту 40817840100050017762', who: 'Иванова М. П.',
    history: [
      { at: '2026-09-22T07:31:59', text: 'Создана: fx-in-routing' },
      { at: '2026-09-22T07:32:40', text: 'Взята в работу: Иванова М. П.' },
      { at: '2026-09-22T07:33:20', text: 'Решение: маршрут подтверждён, зачисление утверждено' },
      { at: '2026-09-22T07:33:20', text: 'Закрыта · Иванова М. П.' },
    ],
  },
  {
    id: 't2', state: 'open', tone: 'info', type: 'PAYMENT_INSTRUCTION', at: '2026-09-22T07:35:02',
    text: 'Комиссия USD 35,00 удержана по тарифу OUR; проверить корректность тарифного плана клиента', who: null,
    history: [{ at: '2026-09-22T07:35:02', text: 'Создана: fx-accounting' }],
  },
]
const NOTIF: DocNotification[] = [
  { id: 'n1', at: '2026-09-22T07:31:46.000', attempts: 3, status: 'TIMEOUT', code: 'accepted' },
  { id: 'n2', at: '2026-09-22T07:33:25.000', attempts: 1, status: 'OK', code: 'confirmAck' },
  { id: 'n3', at: '2026-09-22T07:35:02.000', attempts: 3, status: 'TIMEOUT', code: 'confirmCrd' },
]
const STREAM: StreamEvent[] = [
  { at: '2026-09-22T07:33:24.795', system: 'MSB', destination: 'Шина сообщений', event: 'fx_evt_credit_end', status: 'SENT', tries: 1 },
  { at: '2026-09-22T07:35:01.866', system: 'MSB', destination: 'Шина сообщений', event: 'fx_evt_account_end', status: 'SENT', tries: 1 },
  { at: '2026-09-22T07:35:01.902', system: 'DWH', destination: 'Хранилище', event: 'fx_evt_finish', status: 'SENT', tries: 2 },
]
const HOSTILE = '<img src=x onerror=alert(1)>'

describe('помощники вкладок (ui/lib.ts)', () => {
  it('toggleKey: добавляет в конец без дублей, убирает', () => {
    expect(toggleKey(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleKey(['a', 'b'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleKey(['a', 'b'], 'a', false)).toEqual(['b'])
  })
  it('keysLabel: 1 ключ, 2–4 ключа, 5–20 ключей, 21 ключ, 111–114 ключей', () => {
    expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111, 112].map(keysLabel)).toEqual([
      '1 ключ', '2 ключа', '4 ключа', '5 ключей', '11 ключей', '12 ключей', '14 ключей', '21 ключ', '22 ключа', '25 ключей', '101 ключ', '111 ключей', '112 ключей',
    ])
  })
  it('codeLanguage: начинается с «<» (после пробелов) — XML, иначе SWIFT', () => {
    expect(codeLanguage('<?xml version="1.0"?><ED244/>')).toBe('xml')
    expect(codeLanguage('  \n<ED244/>')).toBe('xml')
    expect(codeLanguage('{1:F01VKRBRU8KXXXX0427047245}')).toBe('swift')
  })
})

describe('StatusesTab (эталон statusesHtml)', () => {
  it('нумерация, маршрут тегом или «—», код с суффиксом, финальный шаг, причина с тултипом', () => {
    renderTab((ctx) => <StatusesTab data={STATUSES} ctx={ctx} />)
    const table = screen.getByRole('table', { name: 'Статусы' })
    expect(within(table).getAllByRole('row')).toHaveLength(STATUSES.length + 1)
    expect(within(table).getByRole('columnheader', { name: 'Причина' })).toBeInTheDocument()
    expect(within(table).getAllByText('RT_FX_IN')).toHaveLength(3)
    expect(within(table).getByText('не заполнено')).toBeInTheDocument()
    expect(within(table).getAllByText('.start')).toHaveLength(2)
    expect(within(table).getAllByText('.start')[0]).toHaveAttribute('data-suf', 'start')
    expect(within(table).getAllByText('.end')).toHaveLength(2)
    expect(within(table).getAllByText('.end')[0]).toHaveAttribute('data-suf', 'end')
    expect(within(table).getByText('fx.finish')).toHaveAttribute('data-fin')
    const reason = within(table).getByText('Ожидание решения сотрудника')
    expect(reason).toHaveAttribute('data-k-tip', 'Ожидание решения сотрудника')
    expect(reason).toHaveAttribute('data-k-tip-if', 'truncated')
  })
  it('Δ — от предыдущей строки; больше 30 с — «медленно»; у первой строки Δ нет', () => {
    renderTab((ctx) => <StatusesTab data={STATUSES} ctx={ctx} />)
    expect(screen.getByText(formatDuration(401))).not.toHaveAttribute('data-slow')
    expect(screen.getByText(formatDuration(2499))).not.toHaveAttribute('data-slow')
    expect(screen.getByText(formatDuration(92242))).toHaveAttribute('data-slow')
    expect(screen.getByText(formatDuration(101532))).toHaveAttribute('data-slow')
    expect(document.querySelectorAll('[data-part="dur"]')).toHaveLength(STATUSES.length - 1)
  })
  it('пусто — «Статусов нет»; разметка из данных бека не исполняется', () => {
    const { unmount } = renderTab((ctx) => <StatusesTab data={[]} ctx={ctx} />)
    expect(screen.getByText('Статусов нет')).toBeInTheDocument()
    unmount()
    const { container } = renderTab((ctx) => <StatusesTab data={[{ ...STATUSES[0]!, reason: HOSTILE }]} ctx={ctx} />)
    expect(screen.getByText(HOSTILE)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <StatusesTab data={STATUSES} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('ComplianceTab (эталон complianceHtml)', () => {
  it('четыре группы, решения бейджами, пустое — «не заполнено», НЗР «Нет»', () => {
    renderTab((ctx) => <ComplianceTab data={COMPLIANCE} ctx={ctx} />)
    for (const t of ['Отрицательная нотификация в источник', 'Контроль в системе мониторинга (ИС4021)', 'Контроль подразделения комплаенс (ОПС3308)']) {
      expect(screen.getByText(t)).toBeInTheDocument()
    }
    expect(screen.getByText('ID записи')).toBeInTheDocument()
    expect(screen.getByText('3e854037-b84c-40ee-90e0-440734c1d5e3')).toBeInTheDocument()
    expect(screen.getByText('ID платёжной инструкции')).toBeInTheDocument()
    expect(screen.getByText(TEST_DOC_ID)).toBeInTheDocument()
    expect(screen.getByText('ALLOW')).toBeInTheDocument()
    expect(screen.getByText('REVIEW')).toBeInTheDocument()
    expect(screen.getByText('Нет')).toBeInTheDocument()
    // отрицательная нотификация — три пустых, окончание контроля подразделения — одно
    expect(screen.getAllByText('не заполнено')).toHaveLength(4)
  })
  it('вложенная история: время, система, подразделение', () => {
    renderTab((ctx) => <ComplianceTab data={COMPLIANCE} ctx={ctx} />)
    const hist = screen.getByRole('table', { name: 'История попадания в подразделение комплаенс' })
    expect(within(hist).getByRole('columnheader', { name: 'Система контроля' })).toBeInTheDocument()
    expect(within(hist).getByText('3308_CTRL')).toBeInTheDocument()
    expect(within(hist).getByText('DEP 0417')).toBeInTheDocument()
  })
  it('истории нет — таблицы нет; проверок нет — «Комплаенс-проверок нет»', () => {
    const { unmount } = renderTab((ctx) => <ComplianceTab data={{ ...COMPLIANCE, history: [] }} ctx={ctx} />)
    expect(screen.queryByRole('table', { name: 'История попадания в подразделение комплаенс' })).toBeNull()
    unmount()
    renderTab((ctx) => <ComplianceTab data={null} ctx={ctx} />)
    expect(screen.getByText('Комплаенс-проверок нет')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <ComplianceTab data={COMPLIANCE} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('TasksTab (эталон tasksHtml)', () => {
  it('счётчик «N задач, открытых M»', () => {
    renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
    expect(screen.getByText('2 задач, открытых 1')).toBeInTheDocument()
  })
  describe('переход в «Ручные отклонения»', () => {
    afterEach(() => { configureHostLinks({}) })
    it('хост настроил ссылку — ссылка-кнопка в новой вкладке с адресом на документ', () => {
      configureHostLinks({ manualDeviations: (id) => `/md?doc=${id}` })
      renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
      const a = screen.getByRole('link', { name: 'Перейти в блок «Ручные отклонения»' })
      expect(a).toHaveAttribute('href', `/md?doc=${TEST_DOC_ID}`)
      expect(a).toHaveAttribute('target', '_blank')
      expect(a).toHaveAttribute('rel', 'noopener')
      expect(screen.queryByRole('button', { name: 'Перейти в блок «Ручные отклонения»' })).toBeNull()
    })
    it('ссылки нет — кнопка aria-disabled с подсказкой, клик ничего не объявляет', async () => {
      const { spies } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
      const b = screen.getByRole('button', { name: 'Перейти в блок «Ручные отклонения»' })
      expect(b).toHaveAttribute('aria-disabled', 'true')
      expect(b).toHaveAttribute('data-k-tip', HOST_LINK_MISSING)
      expect(screen.queryByRole('link', { name: 'Перейти в блок «Ручные отклонения»' })).toBeNull()
      await userEvent.click(b)
      expect(spies.announce).not.toHaveBeenCalled()
    })
  })
  it('по умолчанию свёрнуты; точка — состояние; клик по шеврону раскрывает историю и «Закрыта · кто»', async () => {
    const { spies } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
    expect(screen.getByRole('img', { name: 'Выполнена' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Открыта' })).toBeInTheDocument()
    expect(toggles()).toHaveLength(2)
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'false')
    expect(shown('Взята в работу: Иванова М. П.')).toBe(false)
    await userEvent.click(toggles()[0]!)
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['t1'])
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'true')
    expect(toggles()[0]).toHaveAccessibleName(`Свернуть ${TASKS[0]!.text}`)
    expect(toggles()[1]).toHaveAccessibleName(`Раскрыть ${TASKS[1]!.text}`)
    expect(shown('Взята в работу: Иванова М. П.')).toBe(true)
    expect(shown('Закрыта · Иванова М. П.')).toBe(true)
  })
  it('клик по свободному месту строки (тег типа) тоже раскрывает, новый ключ — в конец', async () => {
    const { spies } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />, ['t1'])
    await userEvent.click(screen.getAllByText('PAYMENT_INSTRUCTION')[1]!)
    expect(spies.setExpanded).toHaveBeenLastCalledWith(['t1', 't2'])
    expect(toggles()[1]).toHaveAttribute('aria-expanded', 'true')
  })
  it('«История» — заглушка 2d и строку не раскрывает', async () => {
    const { spies } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'История' })[0]!)
    expect(spies.announce).toHaveBeenCalledWith(STUB)
    expect(spies.setExpanded).not.toHaveBeenCalled()
    expect(toggles()[0]).toHaveAttribute('aria-expanded', 'false')
  })
  it('раскрытое из контекста переживает перемонтирование; у открытой задачи нет «Закрыта»', () => {
    renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />, ['t2'])
    expect(shown('Создана: fx-accounting')).toBe(true)
    expect(shown(/^Закрыта/)).toBe(false)
  })
  it('пусто — счётчик и кнопка остаются, «Задач нет»', () => {
    renderTab((ctx) => <TasksTab data={[]} ctx={ctx} />)
    expect(screen.getByText('0 задач')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Перейти в блок «Ручные отклонения»' })).toBeInTheDocument()
    expect(screen.getByText('Задач нет')).toBeInTheDocument()
  })
  it('все заголовки пустые — шапки нет (как на эталоне .tk)', () => {
    renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />)
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0)
  })
  it('без нарушений axe (строка раскрыта)', async () => {
    const { container } = renderTab((ctx) => <TasksTab data={TASKS} ctx={ctx} />, ['t1'])
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('NotificationsTab (эталон notifHtml)', () => {
  it('счётчик «N отправок, с ошибкой M», статус бейджем, код ответа тегом', () => {
    renderTab((ctx) => <NotificationsTab data={NOTIF} ctx={ctx} />)
    expect(screen.getByText('3 отправок, с ошибкой 2')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Нотификации' })
    expect(within(table).getAllByRole('row')).toHaveLength(NOTIF.length + 1)
    expect(within(table).getAllByText('TIMEOUT')).toHaveLength(2)
    expect(within(table).getByText('confirmAck')).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Код ответа' })).toBeInTheDocument()
  })
  it('без ctx.resend/ctx.openMessage — в панели прежняя «Переотправить», в строке ссылки «Переотправить» нет; обе — объявление STUB', async () => {
    const { spies } = renderTab((ctx) => <NotificationsTab data={NOTIF} ctx={ctx} />)
    expect(screen.queryByRole('button', { name: 'Переотправить все' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Переотправить, отправка/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Переотправить' }))
    await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
    expect(spies.announce).toHaveBeenCalledTimes(2)
    expect(spies.announce).toHaveBeenLastCalledWith(STUB)
  })
  describe('переотправка и исходное сообщение (спека 2e §4 п. 10–11)', () => {
    const wired = (over: Partial<TabContext> = {}) => {
      const resend = vi.fn<(nid?: string, n?: number) => void>()
      const openMessage = vi.fn<(nid: string, n: number) => void>()
      const r = renderTab((ctx) => <NotificationsTab data={NOTIF} ctx={{ ...ctx, resend, resendBusy: false, openMessage, ...over }} />)
      return { ...r, resend, openMessage }
    }
    it('«Переотправить все» в панели → resend() без nid', async () => {
      const t = wired()
      await userEvent.click(screen.getByRole('button', { name: 'Переотправить все' }))
      expect(t.resend).toHaveBeenCalledTimes(1)
      expect(t.resend.mock.calls[0]).toEqual([])
      expect(t.spies.announce).not.toHaveBeenCalled()
    })
    it('«Переотправить» строки 2 (имя «Переотправить, отправка 2») → resend(nid строки, 2)', async () => {
      const t = wired()
      expect(screen.getAllByRole('button', { name: /^Переотправить, отправка \d$/ })).toHaveLength(NOTIF.length)
      const link = screen.getByRole('button', { name: 'Переотправить, отправка 2' })
      expect(link).toHaveTextContent(/^Переотправить$/)
      await userEvent.click(link)
      expect(t.resend).toHaveBeenCalledWith('n2', 2)
    })
    it('«Исходное сообщение» строки 2 → openMessage(nid строки, 2), без объявления', async () => {
      const t = wired()
      await userEvent.click(screen.getByRole('button', { name: 'Исходное сообщение, отправка 2' }))
      expect(t.openMessage).toHaveBeenCalledWith('n2', 2)
      expect(t.spies.announce).not.toHaveBeenCalled()
    })
    it('resendBusy — все кнопки переотправки aria-disabled="true", клик не вызывает resend; «Исходное сообщение» доступно', async () => {
      const t = wired({ resendBusy: true })
      const buttons = screen.getAllByRole('button', { name: /^Переотправить/ })
      expect(buttons).toHaveLength(NOTIF.length + 1)
      for (const b of buttons) {
        expect(b).toHaveAttribute('aria-disabled', 'true')
        await userEvent.click(b)
      }
      expect(t.resend).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Исходное сообщение, отправка 1' })).not.toHaveAttribute('aria-disabled')
    })
    it('нажатая кнопка в полёте — aria-busy, остальные — без', async () => {
      const resend = vi.fn<(nid?: string, n?: number) => void>()
      // как страница: resend переводит документ в полёт (resendBusy), вкладка перерисовывается
      function Live() {
        const [busy, setBusy] = useState(false)
        const ctx: TabContext = {
          docId: TEST_DOC_ID, openDocument: vi.fn(), announce: vi.fn(), expanded: null, setExpanded: vi.fn(),
          resend: (nid, n) => { resend(nid, n); setBusy(true) }, resendBusy: busy, openMessage: vi.fn(),
        }
        return <NotificationsTab data={NOTIF} ctx={ctx} />
      }
      renderK(<Live />)
      await userEvent.click(screen.getByRole('button', { name: 'Переотправить, отправка 3' }))
      expect(resend).toHaveBeenCalledWith('n3', 3)
      expect(screen.getByRole('button', { name: 'Переотправить, отправка 3' })).toHaveAttribute('aria-busy', 'true')
      expect(screen.getByRole('button', { name: 'Переотправить все' })).not.toHaveAttribute('aria-busy')
      expect(screen.getByRole('button', { name: 'Переотправить, отправка 1' })).not.toHaveAttribute('aria-busy')
    })
    it('без нарушений axe (в полёте)', async () => {
      const { container } = wired({ resendBusy: true })
      expect(await axe(container)).toHaveNoViolations()
    })
  })
  it('пусто — счётчик и «Переотправить» остаются, «Нотификаций нет»', () => {
    renderTab((ctx) => <NotificationsTab data={[]} ctx={ctx} />)
    expect(screen.getByText('0 отправок')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Переотправить' })).toBeInTheDocument()
    expect(screen.getByText('Нотификаций нет')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <NotificationsTab data={NOTIF} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('StreamTab (эталон streamHtml)', () => {
  it('код ИС тегом, ИС куда, событие, статус бейджем, попытки', () => {
    renderTab((ctx) => <StreamTab data={STREAM} ctx={ctx} />)
    const table = screen.getByRole('table', { name: 'Стриминг' })
    expect(within(table).getAllByRole('row')).toHaveLength(STREAM.length + 1)
    expect(within(table).getAllByText('MSB')).toHaveLength(2)
    expect(within(table).getByText('Хранилище')).toBeInTheDocument()
    expect(within(table).getByText('fx_evt_finish')).toBeInTheDocument()
    expect(within(table).getAllByText('SENT')).toHaveLength(3)
    expect(within(table).getByRole('columnheader', { name: 'ИС куда' })).toBeInTheDocument()
  })
  it('пусто — «Событий стриминга нет»', () => {
    renderTab((ctx) => <StreamTab data={[]} ctx={ctx} />)
    expect(screen.getByText('Событий стриминга нет')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderTab((ctx) => <StreamTab data={STREAM} ctx={ctx} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
