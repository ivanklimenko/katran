import { RUB_OPERATION, TYPE_NAME, type RubDoc } from '../../entities/rub-doc'
import { corrOf } from './rub-docs.data'
import { RUB_TRAIL_TABS, rubCorrAcc, rubDocTrail, rubScenario } from './rub-docs.trail'
import { pad, tabsOffOf } from './trail.data'

// Словари — со стенда pi-constructor (первый и второй рублёвые документы, index.html:895–921), обезличен; данные вымышленные.
const ADDR = ['740828, Г. ЛЫСУЛА, УЛ. НИФЕМЯ, Д. 133, ПОМ. 520', '057617, Г. СОЛОКЫ, УЛ. МЕСОБО, Д. 83, КВ. 143']
const PURPOSE_EXTRA = { instr: 'Гяналу тыпепо вуза факе пысему вя ни лидефе фотохо ва мезе мокефо', reserve: 'Зувивофе дыто симу', f20: 'Руди фибеку собыве сясе' }
const AGENTS = [
  { name: 'ФИЛИАЛ № 3826 БАНКА «НУВОСЕ» (ПАО)', bic: '041550162', bankAcc: '30101810951233369033', acc: '30110810217115096554' },
  { name: 'БАНК «ВЯХИЛЯ» (АО)', bic: '041916658', bankAcc: '30101810196704420940', acc: '30110810928566570883' },
  { name: 'АО «ФАДОФЯ БАНК»', bic: '047917152', bankAcc: '30101810671568607430', acc: '30110810450582275781' },
]
const BUDGET = { b101: '51', b104: '96939832480279714550', b105: '92564093', b106: 'ТП', b107: 'МС.02.2026', b108: '200', b109: '26.02.2026', b110: '649' }
const NO_BUDGET = { b101: '', b104: '', b105: '', b106: '', b107: '', b108: '', b109: '', b110: '' }
const ED107_FULL: Record<string, string> = {
  'OrderingBank/BIC': '045131779', 'OrderingBank/ed:Name': 'БАНК «ВУХИДО» (АО)', 'OrderingBank/BankAccount': '30101810105950215060', 'OrderingBank/SWBIC': 'DUZFRUY9',
  'AcctWithInst/BIC': '045027178', 'AcctWithInst/ed:Name': 'БАНК «ВЫНАФА» (АО)', 'AcctWithInst/BankAccount': '30101810168267985543', 'AcctWithInst/SWBIC': 'KDHCRU2F',
  'Beneficiary/BIC': '049719713', 'Beneficiary/ed:Name': 'ФИЛИАЛ № 6857 БАНКА «ВАХАСЫ» (ПАО)', 'Beneficiary/BankAccount': '30101810424324905006', 'Beneficiary/SWBIC': 'REFNRUAM',
  'PrevInstrAgent/BIC': '049125896', 'PrevInstrAgent/ed:Name': 'БАНК «ВЯЗУРЕ» (АО)', 'PrevInstrAgent/BankAccount': '30101810347900853104', 'PrevInstrAgent/SWBIC': 'TEMGRU4U',
  'InstructingAgent/BIC': '047485823', 'InstructingAgent/CorrespAcc': '30101810372488940093', 'InstructingAgent/SWBIC': 'XEANRURA',
  'InstructedAgent/BIC': '040266426', 'InstructedAgent/CorrespAcc': '30101810122840500735', 'InstructedAgent/SWBIC': 'HDNZRU99',
}
const ED107_SHORT: Record<string, string> = {
  'OrderingBank/BIC': '048768792', 'OrderingBank/ed:Name': 'БАНК «МУДЫТЫ» (АО)', 'OrderingBank/BankAccount': '30101810766322191206', 'OrderingBank/SWBIC': 'FPNTRU2T',
  'InstructingAgent/BIC': '042878504', 'InstructingAgent/CorrespAcc': '30101810317932318025', 'InstructingAgent/SWBIC': 'ZZULRUAZ',
  'InstructedAgent/BIC': '047521494', 'InstructedAgent/CorrespAcc': '30101810721171571828', 'InstructedAgent/SWBIC': 'DVHURU8C',
}
// даты реквизитов документа — текстом, как в платёжном документе (эталон collect)
const COLLECT = { c48: '23.09.2026', cLimit: '93997231', c70: 'Вабудя ферави тефе сы саси', c38: '85', c39: '54', c40: '350658401', c41: '06.09.2026' }
const NO_COLLECT = { c48: '', cLimit: '', c70: '', c38: '', c39: '', c40: '', c41: '' }

/**
 * Деталь рублёвого документа (спека 2a §4.4): строка реестра как есть (номер, сумма, статус — из реестра),
 * стороны из реквизитов строки, секции и проводки — детерминированно по номеру строки i;
 * tabsOff — по данным вкладок того же документа (спека 2b §3.5), rows — для «Связанных».
 */
export function makeRubDocDetail(row: RubDoc, i: number, rows: readonly RubDoc[]): Record<string, unknown> {
  const inbound = row.direction === 'IN'
  const pending = row.status === 'IN_PROGRESS' || row.status === 'ERROR' || row.status === 'DEFERRED'
  const base = Date.parse(`${row.created}Z`)
  const at = (sec: number) => new Date(base + sec * 1000 + ((i * 41) % 1000)).toISOString()
  const corr = rubCorrAcc(i)
  const client = inbound ? row.toAcc : row.fromAcc
  return {
    ...row,
    numDate: row.created.slice(0, 10),
    opCode: RUB_OPERATION[row.type],
    opName: TYPE_NAME[row.type],
    scenario: rubScenario(row),
    sysFrom: inbound ? 'DB01' : 'DB02',
    sysTo: inbound ? 'DB02' : 'DB01',
    party: {
      s: { name: row.fromName, opt: '', acc: row.fromAcc, inn: row.fromInn, kpp: row.fromKpp, info: '', addr: i % 3 === 0 ? ADDR[0]! : '', bank: row.fromBank, bic: row.fromBic, bankAcc: corrOf(row.fromBic), bankInfo: '' },
      r: { name: row.toName, opt: '', acc: row.toAcc, inn: row.toInn, kpp: row.toKpp, info: '', addr: i % 3 === 0 ? ADDR[1]! : '', bank: row.toBank, bic: row.toBic, bankAcc: corrOf(row.toBic), bankInfo: i % 4 === 1 ? 'Филиал в г. Хупево' : '' },
    },
    purposeExtra: i % 3 === 0 ? { ...PURPOSE_EXTRA, uip: pad((i * 104729) % 1e20, 20) } : { instr: '', uip: i % 2 ? pad((i * 104729) % 1e20, 20) : '', reserve: '', f20: '' },
    agents: i % 4 === 0 ? AGENTS.slice(0, 1 + (i % 3)) : [],
    // бюджетные реквизиты — у платежей в казначейство (счёт получателя 03…)
    budget: row.toAcc.startsWith('03') ? BUDGET : NO_BUDGET,
    ed107: { relId: String(5000 + i), initId: String(46000 + i * 7), relDate: row.created.slice(0, 10), execDate: row.created.slice(0, 10), v: i % 2 === 0 ? ED107_FULL : ED107_SHORT },
    collect: row.type === 'REQDOCRU' || i % 5 === 0 ? COLLECT : NO_COLLECT,
    txAt: row.created,
    txs: [
      { dir: 'DEBIT', st: 'EXECUTED', acc: inbound ? corr : client, reg: inbound ? '00000_CorrCBR' : '00010_ClientCurrent', time: at(6), amount: row.amount, currency: 'RUB' },
      { dir: 'CREDIT', st: pending ? 'PENDING' : 'EXECUTED', acc: inbound ? client : corr, reg: inbound ? '00010_ClientCurrent' : '00000_CorrCBR', time: pending ? null : at(6), amount: row.amount, currency: 'RUB' },
    ],
    tabsOff: tabsOffOf(RUB_TRAIL_TABS, rubDocTrail(row, i, rows)),
  }
}
