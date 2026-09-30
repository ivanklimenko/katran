import type { Tx } from '../../posting/@x/rub-doc'
import type { AGENT_KEYS, BUDGET_ROWS, COLLECT_KEYS, ED107_KEYS, PURPOSE_EXTRA_ROWS, RUB_PARTY } from './profiles'
import type { RubDoc } from './rubDoc'

export type RubParty = Record<(typeof RUB_PARTY)[number], string>
export type RubAgent = Record<(typeof AGENT_KEYS)[number], string>
export type RubPurposeExtra = Record<(typeof PURPOSE_EXTRA_ROWS)[number], string>
export type RubBudget = Record<(typeof BUDGET_ROWS)[number], string>
export type RubCollect = Record<(typeof COLLECT_KEYS)[number], string>
/** Шапка ED107 и значения узлов по пути «узел/реквизит» (эталон ed107.v). */
export type RubEd107 = Record<(typeof ED107_KEYS)[number], string> & { v: Record<string, string> }

/** Рублёвый документ в деталке (спека 2a §4.2): строка реестра плюс реквизиты «Общих данных». Пустой реквизит — ''. */
export type RubDocDetail = RubDoc & {
  /** Дата документа (ISO). */
  numDate: string
  opCode: string
  opName: string
  /** Сценарий и системы S → R (эталон r.scen, r.from, r.to). */
  scenario: string
  sysFrom: string
  sysTo: string
  party: { s: RubParty; r: RubParty }
  purposeExtra: RubPurposeExtra
  agents: RubAgent[]
  budget: RubBudget
  ed107: RubEd107
  collect: RubCollect
  txAt: string
  txs: Tx[]
  /** Вкладки без данных (ключи RUB_TABS). */
  tabsOff: string[]
}
