import { allSettled, fork } from 'effector'
import { requestFx, type HttpRequest } from '../../../shared/api'
import { fxEditableTargets } from '../model/rules'
import { FX_DETAIL_EXAMPLE } from './detail.example'
import { parseFxDocDetail } from './detail.mapper'
import { parseFxDoc } from './fxDoc.mapper'
import { INTERNAL_COMMISSION, INTERNAL_REFUND, MT103_INSTRUCTION, MT103_WITH_OUT_REF, MT202_REFUND, MT202_TREASURY } from './instruction.fixture'
import { fxDocPorts } from './ports'

describe('деталь из documentSection валютной инструкции', () => {
  it('MT103: переводит суммы и SWIFT-реквизиты, сохраняет строки и независимые даты', () => {
    const d = parseFxDocDetail(MT103_INSTRUCTION, 'ответ')
    expect(d).toMatchObject({
      id: 'fixture-mt103-in', docNumber: 880001, numDate: '2026-01-15', amount: 1250.5, currency: 'BYN', status: 'PENDING',
      reason: null, refIn: 'TESTIN103', refOut: null, f52: '', f52name: 'TEST CLEARING BANK', f57: 'DEMOAM2XBBB',
      vdDt: '2026-01-17', vdKt: '', routeType: null, inSender: 'TESTBY2XAAA', inReceiver: 'DEMOAM2XBBB',
      valueDates: ['2026-01-16', '', '2026-01-17', ''],
      txId: 'fixture-tx-in', txAt: '2026-01-16T09:20:00Z',
      txs: [{ dir: 'DEBIT', st: 'EXECUTED', acc: '30100000000000000011', reg: 'TEST_DEBIT', time: null, amount: 1250.5, currency: 'BYN' }],
    })
    expect(d.fields).toMatchObject({
      '20': { lines: ['TESTIN103'] },
      '33B': { lines: ['BYN 1262,50'] },
      '50': { opt: 'F', acc: '40702000000000000011', lines: ['1/TEST PAYER', '1/UNIT B', '2/TEST STREET', '3/BY/TEST CITY'] },
      '52': { opt: 'D', lines: ['//XX000123', 'TEST CLEARING BANK'] },
      '53': { opt: 'B', acc: '30100000000000000033', lines: [] },
      '57': { opt: 'A', lines: ['DEMOAM2XBBB'] },
      '59': { acc: '40702000000000000022', lines: ['TEST BENEFICIARY', 'TEST CITY'] },
      '70': { lines: ['TEST INVOICE 01', 'SYNTHETIC DATA'] },
      '71F': { lines: ['BYN 10,00', 'BYN 2,00'] },
    })
    expect(d.fields['59']?.opt).toBeUndefined()
    expect(d.fields['56']).toBeUndefined()
  })

  it('разделяет 20 вх, 20 исх и внутренний референс документа', () => {
    const d = parseFxDocDetail(MT103_WITH_OUT_REF, 'ответ')
    expect(d).toMatchObject({ refIn: null, refOut: 'TESTOUT103', outReceiver: 'DEMOAM2XBBB', direction: 'OTHER', currency: 'AMD' })
    expect(d.fields['20']).toBeUndefined()
    expect(d.fields['72']).toBeUndefined()
    expect(d.fields['50']?.opt).toBe('F')
  })

  it('берёт структурированные теги из исходящего сообщения, если входящего блока нет', () => {
    const { documentSection } = MT103_INSTRUCTION
    const raw = {
      ...MT103_INSTRUCTION,
      documentSection: {
        ...documentSection,
        swift: { incomingSwiftMessage: null, outgoingSwiftMessage: { ...documentSection.swift.incomingSwiftMessage, field20: 'OUTBODY103' } },
      },
    }
    const d = parseFxDocDetail(raw, 'ответ')
    expect(d).toMatchObject({ refIn: null, refOut: 'OUTBODY103', f50opt: 'F', inSender: null, valueDates: ['', '2026-01-16', '2026-01-17', ''] })
    expect(d.fields['20']).toBeUndefined()
    expect(d.fields['57']).toEqual({ opt: 'A', lines: ['DEMOAM2XBBB'] })
    expect(d.fields['70']?.lines).toEqual(['TEST INVOICE 01', 'SYNTHETIC DATA'])
  })

  it('парные ответы search и detail используют одно направление при конфликте с incoming', async () => {
    const raw = {
      ...MT103_WITH_OUT_REF,
      lastRouteDirection: { group: 'OUTGOING', name: 'Тестовый исходящий' },
      documentSection: { ...MT103_WITH_OUT_REF.documentSection, incoming: true },
    }
    const scope = fork({ handlers: [[requestFx, ({ method }: HttpRequest) => Promise.resolve(method === 'POST'
      ? { content: [raw], page: { number: 0, size: 10, totalElements: 1, totalPages: 1, hasNext: false } }
      : raw)]] })
    const search = await allSettled(fxDocPorts.searchFx, { scope, params: { filter: [], sort: [], page: 0, size: 10 } })
    const detail = await allSettled(fxDocPorts.detailFx, { scope, params: raw.id })
    expect(search).toMatchObject({ status: 'done', value: { rows: [{ direction: 'OUT', dirTxt: 'Тестовый исходящий' }] } })
    expect(detail).toMatchObject({ status: 'done', value: { direction: 'OUT', dirTxt: 'Тестовый исходящий' } })
  })

  it('доверяет direction/dirTxt и правкам нормализованного DTO, даже если есть сырая секция', () => {
    const hybrid = { ...MT103_INSTRUCTION, ...FX_DETAIL_EXAMPLE, direction: 'TRANSIT', dirTxt: 'Тестовый транзит' }
    expect(parseFxDoc(hybrid, 'строка')).toMatchObject({ direction: 'TRANSIT', dirTxt: 'Тестовый транзит' })
    const d = parseFxDocDetail(hybrid, 'ответ')
    expect(d).toMatchObject({ direction: 'TRANSIT', dirTxt: 'Тестовый транзит', currency: 'USD', refOut: null })
    expect(d.fields['57']).toEqual(FX_DETAIL_EXAMPLE.fields['57'])
    expect(d.edits['field:57']?.now).toEqual(FX_DETAIL_EXAMPLE.fields['57'])
  })

  it('добавляет отсутствующие реквизиты из секции при частичном нормализованном ответе', () => {
    const raw = {
      ...MT103_INSTRUCTION,
      docNumber: 811111, f50name: 'NORMALIZED PAYER', direction: 'TRANSIT', dirTxt: 'Тестовый транзит',
      valueDates: ['2026-01-17', '', '', ''],
      fields: { '70': { lines: ['NORMALIZED PURPOSE'] } },
    }
    const row = parseFxDoc(raw, 'строка')
    const detail = parseFxDocDetail(raw, 'ответ')
    expect(row).toMatchObject({
      docNumber: 811111, f50name: 'NORMALIZED PAYER', direction: 'TRANSIT',
      dirTxt: 'Тестовый транзит', amount: 1250.5, created: '2026-01-15T09:00:00Z',
    })
    expect(detail).toMatchObject({
      docNumber: 811111, f50name: 'NORMALIZED PAYER', direction: 'TRANSIT', dirTxt: 'Тестовый транзит',
      numDate: '2026-01-15', tabsOff: [], valueDates: ['2026-01-17', '', '', ''],
      fields: { '70': { lines: ['NORMALIZED PURPOSE'] } },
    })
    expect(detail.fields['50']).toBeUndefined()
  })

  it('сохраняет плоский DTO с дополнительной секцией аудита', () => {
    const dto = { ...FX_DETAIL_EXAMPLE, documentSection: { messageType: 'MT103' } }
    expect(parseFxDoc(dto, 'строка')).toMatchObject({ type: 'MT103', direction: 'IN' })
    expect(parseFxDocDetail(dto, 'ответ').fields).toEqual(parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ').fields)
  })

  it('не угадывает направление по incoming при неизвестной группе', () => {
    const raw = { ...MT103_INSTRUCTION, lastRouteDirection: { group: 'NEW', name: 'Тест' } }
    expect(() => parseFxDoc(raw, 'строка')).toThrow('строка.lastRouteDirection.group')
    expect(() => parseFxDocDetail(raw, 'ответ')).toThrow('ответ.lastRouteDirection.group')
  })

  it('комиссия: внутренние реквизиты, счета сторон и неизвестный статус проводки', () => {
    const d = parseFxDocDetail(INTERNAL_COMMISSION, 'ответ')
    expect(d).toMatchObject({
      type: 'InternalPAYDOCVAL', direction: 'OTHER', dirTxt: 'Комиссия', fields: {}, accDt: '', accKt: '',
      internalPayment: {
        reference: 'TEST-FEE-REF', initialReference: null, valueDate: '2026-01-18',
        payer: { name: 'TEST PAYER', account: '40702000000000000011' },
        payee: { name: 'TEST BENEFICIARY', account: '40702000000000000022' },
      },
    })
    expect(d.txs.map((tx) => tx.st)).toEqual(['EXECUTED', null])
    expect(d.tabsOff).toEqual(expect.arrayContaining(['extra', 'source']))
    expect(fxEditableTargets(d)).toEqual([])
  })

  it('возврат: сохраняет отдельно исходный референс и счёт получателя без имени', () => {
    const d = parseFxDocDetail(INTERNAL_REFUND, 'ответ')
    expect(d).toMatchObject({
      direction: 'OTHER', dirTxt: 'Возврат с СНС (без экспорта)', purpose: null, txs: [],
      internalPayment: {
        reference: 'TEST-RETURN-REF', initialReference: 'TEST-ORIGINAL-REF',
        payer: { bankName: 'TEST REFUND BANK', bankBic: 'DEMOAM2XBBB' },
        payee: { name: null, account: '40702000000000000022' },
      },
    })
  })
})

describe('MT202 из documentSection', () => {
  it('общий маппер строки даёт направление OUT при incoming=true, деталь сохраняет реквизиты инструкции', async () => {
    const raw = MT202_TREASURY
    const scope = fork({ handlers: [[requestFx, ({ method }: HttpRequest) => Promise.resolve(method === 'POST'
      ? { content: [raw], page: { number: 0, size: 10, totalElements: 1, totalPages: 1, hasNext: false } }
      : raw)]] })
    const search = await allSettled(fxDocPorts.searchFx, { scope, params: { filter: [], sort: [], page: 0, size: 10 } })
    const detail = await allSettled(fxDocPorts.detailFx, { scope, params: raw.id })
    const row = {
      direction: 'OUT', dirTxt: 'Исходящий на тестовый счёт Ностро', refIn: null, refOut: null, uetr: '',
      type: 'MT202', docNumber: 880202, amount: 92000.1, currency: 'KZT',
      f57: 'DEMOAM2XBBB', f58: 'TESTKZ22XXX', f58name: 'SYNTHETIC BENEFICIARY BANK',
    }
    expect(search).toMatchObject({ status: 'done', value: { rows: [row] } })
    expect(detail).toMatchObject({
      status: 'done',
      value: {
        ...row, inSender: null, inReceiver: null, outSender: '', outReceiver: 'DEMOAM2XBBB',
        fields: {}, valueDates: ['', '', '', ''],
        accDt: '30100000000000000201', accKt: '30100000000000000202', routeType: null,
        txId: 'fixture-tx-mt202', txs: [{ dir: 'DEBIT' }, { dir: 'CREDIT' }],
        mt202Instruction: {
          reference: 'TEST-TREASURY', initialReference: 'TEST-ORIGINAL202', valueDate: '2026-01-22',
          fallbackFields: {
            '53': { acc: '30100000000000000233', lines: [] },
            '57': { lines: ['SYNTHETIC RECEIVING BANK', 'DEMOAM2XBBB'] },
            '58': { acc: '30100000000000000222', lines: ['SYNTHETIC BENEFICIARY BANK', 'TESTKZ22XXX'] },
            '72': { lines: ['/BNF/ TEST TREASURY', 'SECOND LINE'] },
          },
        },
      },
    })
  })

  it('возврат без блока SWIFT использует исходные данные инструкции и направление грида', () => {
    const d = parseFxDocDetail(MT202_REFUND, 'ответ')
    expect(d).toMatchObject({
      direction: 'IN', dirTxt: 'Возврат с тестового счёта', currency: 'AMD', refIn: null, refOut: null,
      f52: 'TESTBY2XAAA', f58: 'DEMOAM2XCCC', accDt: '30100000000000000203', accKt: '',
    })
    expect(d.fields).toEqual({})
    expect(d.mt202Instruction?.fallbackFields['52']).toEqual({ lines: ['SYNTHETIC ORDERING BANK', 'TESTBY2XAAA'] })
    expect(d.mt202Instruction?.fallbackFields['57']).toBeUndefined()
    expect(fxEditableTargets(d)).not.toContain('field:52')
    expect(fxEditableTargets(d)).not.toContain('field:72')
    expect(fxEditableTargets(d)).not.toContain('valueDate')
  })

  it('принимает плоский MT202 с секцией аудита другого типа', () => {
    const dto = {
      ...FX_DETAIL_EXAMPLE,
      type: 'MT202',
      documentSection: { swiftHeader: { messageType: 'MT202COV' }, remittanceInformation: {} },
    }
    expect(parseFxDoc(dto, 'строка').type).toBe('MT202')
    expect(parseFxDocDetail(dto, 'ответ').fields['20']).toEqual(dto.fields['20'])
  })

  it('явные теги и готовые поля DTO имеют приоритет, референсы инструкции раздельны с тегами 20/21', () => {
    const source = MT202_TREASURY.documentSection
    const raw = {
      ...MT202_TREASURY,
      direction: 'TRANSIT', dirTxt: 'Тестовая подпись из API',
      documentSection: {
        ...source,
        mainEntityInfo: { messageTypeOut: 'MT202', docReferenceOut: 'TEST-EXPORTED202' },
        swift: {
          ...source.swift,
          incomingSwiftMessage: { field57A: { fieldOption: '57A', swiftCode: null } },
          outgoingSwiftMessage: {
            ...source.swift.outgoingSwiftMessage, field20: 'TEST-WIRE202', field21: 'TEST-LINKED202',
            field32A: { valueDate: '2026-01-24', currency: 'KZT', amount: '92000.10' },
            field57A: { fieldOption: '57A', swiftCode: 'DEMOAM2XDDD' },
            field58A: { fieldOption: '58A', swiftCode: 'TESTKZ22YYY' },
            field72: '/REC/ TEST WIRE',
          },
        },
      },
    }
    const d = parseFxDocDetail(raw, 'ответ')
    expect(d).toMatchObject({
      direction: 'TRANSIT', dirTxt: 'Тестовая подпись из API', refIn: null, refOut: 'TEST-WIRE202',
      f57: 'DEMOAM2XDDD', f58: 'TESTKZ22YYY', valueDates: ['', '2026-01-24', '', ''],
      fields: {
        '21': { lines: ['TEST-LINKED202'] },
        '57': { opt: 'A', lines: ['DEMOAM2XDDD'] },
        '58': { opt: 'A', lines: ['TESTKZ22YYY'] },
        '72': { lines: ['/REC/ TEST WIRE'] },
      },
    })
    expect(d.fields['20']).toBeUndefined()
    expect(fxEditableTargets(d)).toContain('field:57')
    expect(fxEditableTargets(d)).toContain('field:72')

    const withExportRef = {
      ...raw,
      documentSection: { ...source, mainEntityInfo: raw.documentSection.mainEntityInfo },
    }
    expect(parseFxDoc(withExportRef, 'строка').refOut).toBeNull()
    const exported = parseFxDocDetail(withExportRef, 'ответ')
    expect(exported.refOut).toBeNull()
    expect(exported.mt202Instruction?.outgoingReference).toBe('TEST-EXPORTED202')
    expect(fxEditableTargets(exported)).not.toContain('refOut')
    const normalized = parseFxDocDetail({ ...withExportRef, refOut: 'TEST-NORMALIZED202' }, 'ответ')
    expect(normalized.refOut).toBe('TEST-NORMALIZED202')
    expect(fxEditableTargets(normalized)).toContain('refOut')
    expect(parseFxDocDetail({
      ...withExportRef,
      documentSection: {
        ...withExportRef.documentSection,
        mainEntityInfo: { messageTypeOut: 'MT199', docReferenceOut: 'TEST-NOTICE202' },
      },
    }, 'ответ').mt202Instruction?.outgoingReference).toBeNull()
  })
})
