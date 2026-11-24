import type { AnnulState } from '../../../shared/lib/detail'
import type { Tx } from '../../posting/@x/fx-doc'
import type { FxEdit } from './edit'
import type { FxDoc } from './fxDoc'
import type { FxMappingSources } from './mapping'

/** Значение SWIFT-поля: буква опции, счёт (50/59), строки. Та же форма, что FieldValue кита. */
export type SwiftValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] }

export type InternalPaymentParty = {
  name: string | null
  account: string | null
  bankName: string | null
  bankBic: string | null
}

export type InternalPayment = {
  reference: string | null
  initialReference: string | null
  valueDate: string
  payer: InternalPaymentParty
  payee: InternalPaymentParty
}

/** Реквизиты MT202 до формирования SWIFT. Подстановки используются только при отображении. */
export type Mt202Instruction = {
  reference: string | null
  outgoingReference: string | null
  initialReference: string | null
  valueDate: string
  fallbackFields: Record<string, SwiftValue>
}

/** Валютный документ в деталке (спека 2a §4.2): строка реестра плюс поля и блоки «Общих данных». Имена бека держит маппер. */
export type FxDocDetail = FxDoc & {
  /** Дата документа (ISO) — «№ 417 от 22.09.2026». */
  numDate: string
  /** Даты валютирования: вх, исх, по Дт, по Кт (ISO, пустая строка при отсутствии даты). */
  valueDates: [string, string, string, string]
  /** SWIFT-поля по тегу; теги «B.…» — последовательность B (MT202COV). */
  fields: Record<string, SwiftValue>
  internalPayment?: InternalPayment
  mt202Instruction?: Mt202Instruction
  mappingSources?: FxMappingSources
  /** Исходный ответ API для панели проверки маппинга. */
  mappingResponse?: Record<string, unknown>
  /** Входящее сообщение: отправитель → получатель; null — документ без входящего. */
  inSender: string | null
  inReceiver: string | null
  /** Счета Дт / Кт (20 знаков). */
  accDt: string
  accKt: string
  /** Маршрут: описание счёта и правило (тип, BIC, счёт — в строке реестра). */
  routeDesc: string
  routeText: string
  txId: string
  txAt: string
  txs: Tx[]
  /** Вкладки без данных (ключи FX_TABS) — вторая группа полосы. */
  tabsOff: string[]
  /** Можно ли аннулировать сейчас (спека 2e §3.1 п. 1); нет ключа в ответе — false. */
  canAnnul: boolean
  /** Аннулирование документа: null — не было (спека 2e §3.1 п. 2). */
  annul: AnnulState | null
  /** Правки по цели (план 2c §3.1): 'field:<tag>' (с 'B.'), 'refOut', 'accDt', 'accKt', 'valueDate', 'route'; без правок — {}. Значения выше — уже текущие. */
  edits: Record<string, FxEdit>
}
