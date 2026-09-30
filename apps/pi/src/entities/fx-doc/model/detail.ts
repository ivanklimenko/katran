import type { Tx } from '../../posting/@x/fx-doc'
import type { FxDoc } from './fxDoc'

/** Значение SWIFT-поля: буква опции, счёт (50/59), строки. Та же форма, что FieldValue кита. */
export type SwiftValue = { opt?: string | undefined; acc?: string | undefined; lines: string[] }

/** Валютный документ в деталке (спека 2a §4.2): строка реестра плюс поля и блоки «Общих данных». Имена бека держит маппер. */
export type FxDocDetail = FxDoc & {
  /** Дата документа (ISO) — «№ 417 от 22.09.2026». */
  numDate: string
  /** Даты валютирования: вх, исх, по Дт, по Кт (ISO; эталон vd[0..3]). */
  valueDates: [string, string, string, string]
  /** SWIFT-поля по тегу; теги «B.…» — последовательность B (MT202COV). */
  fields: Record<string, SwiftValue>
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
}
