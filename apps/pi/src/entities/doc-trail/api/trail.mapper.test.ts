import { ApiError, type Obj } from '../../../shared/api'
import { TRAIL_EXAMPLES as ex } from './trail.example'
import {
  TRAIL_PARSERS, parseAudit, parseCompliance, parseLinked, parseMpu, parseNotifications, parseSourceTexts, parseStatuses, parseStream, parseTasks,
} from './trail.mapper'

const first = (tab: 'linked' | 'tasks' | 'mpu', key: string): Obj => ((ex[tab] as Obj)[key] as Obj[])[0]!

describe('мапперы doc-trail (примеры pi-api.md)', () => {
  it('statuses: события; пустые маршрут и причина — null', () => {
    const s = parseStatuses(ex.statuses, 'ответ')
    expect(s).toHaveLength(12)
    expect(s[0]).toEqual({ at: '2026-09-22T07:31:45.241', route: null, code: 'fx-dup-check.end', reason: null })
    expect(s[3]).toEqual({ at: '2026-09-22T07:31:48.141', route: 'RT_FX_IN', code: 'fx-in-routing.start', reason: 'Ожидание решения сотрудника' })
    expect(parseStatuses({ events: [{ at: 'x', route: '', statusCode: 'c', reason: '' }] }, 'ответ')).toEqual([{ at: 'x', route: null, code: 'c', reason: null }])
  })
  it('compliance: группы и история под доменными именами', () => {
    expect(parseCompliance(ex.compliance, 'ответ')).toEqual({
      record: { id: '3e854037-b84c-40ee-90e0-440734c1d5e3', start: '2026-09-22T07:31:48.126', end: '2026-09-22T07:31:52.601', nzr: false },
      negative: { decision: null, direction: null, comment: null },
      monitoring: { start: '2026-09-22T07:31:48.220', end: '2026-09-22T07:31:49.601', decision: 'ALLOW', txId: '97cae8c7162531f4093e1db5d7171bde', requestAt: '2026-09-22T07:31:49.354', clientId: 'CLT0000123456789' },
      department: { start: '2026-09-22T07:31:49.719', end: '2026-09-22T07:31:52.601', decision: 'ALLOW' },
      history: [{ at: '2026-09-22T07:31:51', system: '3308_CTRL', department: 'DEP 0417' }],
    })
  })
  it('linked: документ, проводки Дт/Кт, отправитель и получатель', () => {
    const l = parseLinked(ex.linked, 'ответ')
    expect(l).toHaveLength(2)
    expect(l[0]).toEqual({
      docId: 'a18d3c05-b393-4252-a3c1-c93791937ccc', date: '2026-09-23', type: 'InternalFXDOC', relation: 'CHILD',
      purpose: 'MT103 USD 1249965.00 23.09.2026 возврат (1.6.2.2.1.)', status: 'NEW', processed: '2026-09-23T09:02:11', posted: '2026-09-23', kind: 'SHA',
      debit: { account: '40817840100050017762', amount: '1249965.00', currency: 'USD', register: '00010_ClientCurrent' },
      credit: { account: '30110840700000001842', amount: '1249965.00', currency: 'USD', register: '00000_NostroUSD' },
      from: { name: 'SEMENOVA IRINA VLADIMIROVNA', account: '40817840100050017762', extra: null },
      to: { name: 'LAVRENTIEV DMITRY OLEGOVICH', account: '40817840500010042371', extra: 'RETURN OF FX2609220000417' },
    })
  })
  it('tasks: статус и важность бека → state и tone; история с закрытием', () => {
    const t = parseTasks(ex.tasks, 'ответ')
    expect(t.map((x) => [x.state, x.tone, x.who])).toEqual([['done', 'ok', 'Иванова М. П.'], ['open', 'info', null]])
    expect(t[0]!.history).toHaveLength(4)
    expect(t[0]!.history[0]).toEqual({ at: '2026-09-22T07:31:59', text: 'Создана: fx-in-routing' })
    expect(t[0]!.history[3]).toEqual({ at: '2026-09-22T07:33:20', text: 'Закрыта · Иванова М. П.' })
  })
  it('notif, stream, mpu: строки таблиц и сообщения', () => {
    expect(parseNotifications(ex.notif, 'ответ')).toEqual([
      { at: '2026-09-22T07:31:46.000', attempts: 3, status: 'TIMEOUT', code: 'accepted' },
      { at: '2026-09-22T07:33:25.000', attempts: 1, status: 'OK', code: 'confirmAck' },
      { at: '2026-09-22T07:35:02.000', attempts: 3, status: 'TIMEOUT', code: 'confirmCrd' },
    ])
    expect(parseStream(ex.stream, 'ответ')[2]).toEqual({ at: '2026-09-22T07:35:01.902', system: 'DWH', destination: 'Хранилище', event: 'fx_evt_finish', status: 'SENT', tries: 2 })
    const m = parseMpu(ex.mpu, 'ответ')
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ id: 'ee8bf4eb-5545-4f07-9617-8a5e7106302f', type: 'MT199', exportStatus: 'SENT', exported: '2026-09-22T07:35:47.308', receiver: 'NRDIRUMMXXX', docReference: 'VK2609220000417', docId: '03e8b84b-d1c5-4f07-aa49-8be3e9e4c8e8' })
    expect(m[0]!.swift).toMatch(/^\{1:F01VKRBRU8KXXXX/)
  })
  it('audit: секции как есть; source и ed244: null → пустая строка («нет»)', () => {
    const a = parseAudit(ex.audit, 'ответ')
    expect(Object.keys(a)).toHaveLength(10)
    expect(a.commonSection).toEqual({ creationDate: '2026-09-22T04:31:45.051765Z', paymentServiceProvider: 'SUBOUL', paymentFlow: null, paymentInitiatorSystem: 'ERS.ERS_1', sourceSystem: 'SRC1', resending: false })
    expect(Object.keys(parseSourceTexts(ex.source, 'ответ'))).toEqual(['swiftMessage', 'outgoingSwiftMessage'])
    expect(parseSourceTexts({ swiftMessage: null, outgoingSwiftMessage: 'X' }, 'ответ')).toEqual({ swiftMessage: '', outgoingSwiftMessage: 'X' })
    expect(parseSourceTexts(ex.ed244, 'ответ').ED244).toMatch(/^<\?xml/)
  })
  it('TRAIL_PARSERS: source и ed244 — один парсер; каждый пример разбирается своим парсером', () => {
    expect(TRAIL_PARSERS.source).toBe(TRAIL_PARSERS.ed244)
    for (const [tab, parse] of Object.entries(TRAIL_PARSERS)) expect(() => parse(ex[tab as keyof typeof ex], 'ответ'), tab).not.toThrow()
  })
  it('битая форма — contractError с путём', () => {
    expect(() => parseStatuses({}, 'ответ')).toThrow('ответ.events: ожидался массив')
    expect(() => parseStatuses({ events: [{ at: 1, statusCode: 'c' }] }, 'ответ')).toThrow('ответ.events[0].at: ожидалась строка')
    expect(() => parseCompliance({ ...(ex.compliance as Obj), record: { id: 'r', nzr: 'Нет' } }, 'ответ')).toThrow('ответ.record.nzr: ожидалось true, false или null')
    expect(() => parseCompliance({ ...(ex.compliance as Obj), monitoring: null }, 'ответ')).toThrow('ответ.monitoring: ожидался объект')
    expect(() => parseLinked({ documents: [{ ...first('linked', 'documents'), debit: 'x' }] }, 'ответ')).toThrow('ответ.documents[0].debit: ожидался объект')
    expect(() => parseTasks({ tasks: [{ ...first('tasks', 'tasks'), status: 'CLOSED' }] }, 'ответ')).toThrow('ответ.tasks[0].status: недопустимое значение «CLOSED»')
    expect(() => parseNotifications({ notifications: [{ sentAt: 'x', attempts: '3', status: 'OK', responseCode: 'c' }] }, 'ответ')).toThrow('ответ.notifications[0].attempts: ожидалось число')
    expect(() => parseMpu({ messages: [{ ...first('mpu', 'messages'), swiftText: null }] }, 'ответ')).toThrow('ответ.messages[0].swiftText: ожидалась строка')
    expect(() => parseAudit({ commonSection: 'x' }, 'ответ')).toThrow('ответ.commonSection: ожидался объект')
    expect(() => parseSourceTexts({ ED244: 42 }, 'ответ')).toThrow('ответ.ED244: ожидалась строка или null')
    expect(() => parseStream([], 'ответ')).toThrow(ApiError)
  })
})
