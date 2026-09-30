import type { FxDoc } from '../../entities/fx-doc'

// Словари — со стенда pi-constructor (index.html:742–757, grid.html:1747–1783), обезличен; данные вымышленные.
const ROUTE_BY_TYPE: Record<FxDoc['routeType'], { desc: string; text: string }> = {
  NOSTRO: { desc: 'Счёт ностро в Baltic Clearing Bank (Рига), USD', text: 'Маршрут через Baltic Clearing по правилу для USD от контрагентов ЕС' },
  LORO: { desc: 'Счёт лоро Meridian Intermediary Bank, USD', text: 'Зачисление через лоро-счёт посредника, правило LORO_USD_V2' },
  INTERNAL: { desc: 'Внутрибанковский конверсионный счёт', text: 'Внутренний маршрут: счёт Кт открыт в нашем банке, внешний перевод не требуется' },
}
const ADDR50 = ['ULITSA PROFSOYUZNAYA 83-1-214', 'RU/ MOSCOW, 117279']
const ADDR59 = ['PROSPEKT MIRA 101-2-45', 'RU/ MOSCOW, 129085']
const B53 = { opt: 'A', lines: ['BALTIC CLEARING BANK RIGA', 'BCLHLV22XXX'] }
const B54 = { opt: 'A', lines: ['HANSEATIC TRADE BANK HAMBURG', 'HSTBDEHHXXX'] }
const B55 = { opt: 'A', lines: ['CENTRAL EURO SETTLEMENT AG FRANKFURT', 'CESEDEFFXXX'] }
const B56 = { opt: 'A', lines: ['MERIDIAN INTERMEDIARY BANK LONDON', 'MRDNGB2LXXX'] }
const T72 = ['/INS/ NRDIRUMMXXX', '/ACC/ PLEASE CREDIT WITHOUT DELAY', '/REC/ REF FX2609220000417', '/BNF/ CONTRACT 12-45 DD 01.03.2026', '/INT/ MRDNGB2LXXX', '//CHARGES OUR']
const T79 = ['RE YOUR MT103 FX2609220000417 DD 22.09.2026', 'AMOUNT USD 1250000,00', 'PLS BE ADVISED THAT BENEFICIARY ACCOUNT', '40817840100050017762 IS CLOSED.', 'KINDLY AUTHORIZE US TO RETURN THE FUNDS', 'LESS OUR CHARGES USD 35,00', 'OR PROVIDE AMENDED BENEFICIARY DETAILS.', 'BEST REGARDS', 'PAYMENTS DEPT, VOSTOCHNY KREDIT BANK']
const CHARGES = ['OUR', 'SHA', 'BEN']
const EMPTY = { lines: [] as string[] }
const pad = (n: number, w: number) => String(n).padStart(w, '0')
/** Строки по 35 знаков по границе слова — формат поля 70 (эталон grid.html:1783). */
const by35 = (s: string) => (s.match(/.{1,35}(?=\s|$)|.{1,35}/g) ?? []).map((x) => x.trim()).filter(Boolean)
const swiftAmount = (n: number) => n.toFixed(2).replace('.', ',')

/**
 * Деталь валютного документа (спека 2a §4.4): строка реестра как есть (номер, сумма, статус совпадают с реестром)
 * плюс поля по профилю, сообщения, маршрут и проводки — детерминированно по номеру строки i.
 */
export function makeFxDocDetail(row: FxDoc, i: number): Record<string, unknown> {
  const inbound = row.direction === 'IN' || row.direction === 'TRANSIT'
  const accDt = inbound ? row.routeAcc : row.f50acc
  const accKt = inbound ? row.f59acc : row.routeAcc
  const party50 = { opt: row.f50opt, acc: row.f50acc, lines: [row.f50name, ...ADDR50] }
  const party59 = { opt: row.f59opt, acc: row.f59acc, lines: [row.f59name, ...ADDR59] }
  const bank52 = { opt: 'A', lines: [row.f52name, row.f52] }
  const bank57 = { opt: 'A', lines: [row.f57name, row.f57] }
  const f70 = { lines: row.purpose ? by35(row.purpose) : [] }
  const cover = { lines: [`${row.currency} ${swiftAmount(row.amount)}`] }
  const fields: Record<string, unknown> = {
    '20': { lines: row.refIn ? [row.refIn] : [] },
    '21': { lines: ['NONREF'] },
    '71A': { lines: [CHARGES[i % 3]!] },
    '71F': i % 3 === 0 ? { lines: [`${row.currency} 35,00`] } : EMPTY,
    '33B': i % 4 === 0 ? cover : EMPTY,
    '36': i % 4 === 0 ? { lines: ['1,0886'] } : EMPTY,
    '77B': i % 5 === 0 ? { lines: ['/ORDERRES/RU//CONTRACT 12-45 DD 01.03.2026'] } : EMPTY,
    '50': party50, '52': bank52, '53': i % 2 === 0 ? B53 : EMPTY, '54': i % 3 !== 1 ? B54 : EMPTY,
    '55': i % 4 === 0 ? B55 : EMPTY, '56': i % 3 === 0 ? B56 : EMPTY, '57': bank57,
    '58': row.f58 ? { opt: 'A', lines: [row.f58name ?? '', row.f58] } : EMPTY,
    '59': party59, '70': f70, '72': i % 2 === 0 ? { lines: T72 } : EMPTY,
    '79': row.type === 'MT199' ? { lines: T79 } : EMPTY,
  }
  if (row.type === 'MT202COV') {
    Object.assign(fields, {
      'B.50': party50, 'B.52': bank52, 'B.56': i % 3 === 0 ? B56 : EMPTY, 'B.57': bank57, 'B.59': party59, 'B.70': f70,
      'B.72': { lines: ['/INS/ NRDIRUMMXXX', `/BNF/ COVER FOR ${row.refIn ?? 'NONREF'}`] }, 'B.33B': cover,
    })
  }
  const pending = row.status === 'IN_PROGRESS' || row.status === 'ERROR' || row.status === 'DEFERRED'
  const base = Date.parse(`${row.created}Z`)
  const at = (sec: number) => new Date(base + sec * 1000 + ((i * 37) % 1000)).toISOString()
  const tx = (dir: 'DEBIT' | 'CREDIT', st: 'EXECUTED' | 'PENDING' | 'CANCELED', acc: string, reg: string, sec: number, amount = row.amount) =>
    ({ dir, st, acc, reg, time: st === 'PENDING' ? null : at(sec), amount, currency: row.currency })
  const txs = [
    tx('DEBIT', 'EXECUTED', accDt, `00000_Nostro${row.currency}`, 1),
    tx('CREDIT', pending ? 'PENDING' : 'EXECUTED', accKt, '00010_ClientCurrent', 2),
    ...(row.status === 'REJECTED' ? [tx('CREDIT', 'CANCELED', accKt, '00010_ClientCurrent', 2)] : []),
    ...(i % 3 === 0 ? [tx('DEBIT', 'EXECUTED', accKt, '00010_ClientCurrent', 3, 35), tx('CREDIT', 'EXECUTED', '70601840100000000519', '00020_CommissionIncome', 3, 35)] : []),
  ]
  return {
    ...row,
    numDate: row.created.slice(0, 10),
    valueDates: [row.vdDt, row.vdDt, row.vdDt, row.vdKt],
    fields,
    inSender: inbound ? row.sender : null,
    inReceiver: inbound ? row.receiver : null,
    accDt, accKt,
    routeDesc: ROUTE_BY_TYPE[row.routeType].desc,
    routeText: ROUTE_BY_TYPE[row.routeType].text,
    txId: `ba5ac4${pad(i % 100, 2)}-d0a4-40ea-b639-${pad((i * 7919) % 1e12, 12)}`,
    txAt: row.created,
    txs,
    tabsOff: i % 2 ? ['notif', 'stream', 'mpu'] : ['mpu'],
  }
}
