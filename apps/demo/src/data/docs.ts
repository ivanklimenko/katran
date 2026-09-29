import type { FilterMeta } from '@katran/ui'

export type Status = 'IN_PROGRESS' | 'TO_EXPORT' | 'PROCESSING' | 'ERROR' | 'DEFERRED' | 'EXPORTED' | 'INVALID' | 'REJECTED' | 'DONE'
export type Direction = 'IN' | 'OUT' | 'TRANSIT' | 'OTHER'
export type RouteType = 'LORO' | 'NOSTRO' | 'INTERNAL'
export type Doc = {
  id: string; docNumber: number; refIn: string | null; refOut: string | null; uetr: string
  created: string; vdDt: string; vdKt: string
  type: 'MT103' | 'MT202' | 'MT202COV' | 'MT199'
  direction: Direction; dirTxt: string
  amount: number; currency: 'USD' | 'EUR' | 'CNY' | 'RUB'
  f50name: string; f50acc: string; purpose: string | null
  f52: string; f57: string; f59name: string; f59acc: string
  status: Status; reason: string | null
  sender: string; receiver: string; provS: string; provR: string
  /** Заблокирована другим пользователем (спека 5a §6, B1). */
  lock: { who: string; since: string } | null
  /** Неактивна — не участвует в массовом выделении (спека 5a §6, B1). */
  inactive: { why: string } | null
  /** Буква опции полей 50/59 (эталон `base.f['50']` в `grid.tpl.html`) — спека 5b §3. */
  f50opt: string; f59opt: string
  /** Наименования банков 52/57 — к уже имеющимся BIC f52/f57 (словарь эталона, обезличен). */
  f52name: string; f57name: string
  /** Поле 58 — только у MT202/MT202COV, иначе пусто (эталон `base.f['58']`). */
  f58: string | null; f58name: string | null
  /** S / R out (эталон `base.outS`/`base.outR`). */
  outSender: string; outReceiver: string
  /** Маршрут — тип, BIC получателя, счёт (эталон `RT`/`ACC_PFX`). */
  routeType: RouteType; routeRecv: string; routeAcc: string
}

export const STATUS_LABEL: Record<Status, string> = {
  IN_PROGRESS: 'В работе', TO_EXPORT: 'К экспорту', PROCESSING: 'В обработке', ERROR: 'Ошибка', DEFERRED: 'Отложенный',
  EXPORTED: 'Экспортирован', INVALID: 'INVALID', REJECTED: 'Отказ', DONE: 'Обработан',
}
/** Тон статусной точки — 4 семейства (спека 4.2). */
export const STATUS_TONE: Record<Status, 'flow' | 'flowl' | 'flowd' | 'bad' | 'badd' | 'warn' | 'ok' | 'okl' | 'grey'> = {
  IN_PROGRESS: 'flow', TO_EXPORT: 'flowl', PROCESSING: 'flowd', ERROR: 'bad', INVALID: 'badd', DEFERRED: 'warn',
  DONE: 'ok', EXPORTED: 'okl', REJECTED: 'grey',
}
const enumValues = <K extends string>(labels: Record<K, string>) => (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value] }))
/** Каталог полей панели фильтров — то, что бек отдаст в GET /grids/documents/filter-meta. */
export const docsFilterMeta: FilterMeta = { fields: [
  { id: 'docNumber', label: 'Номер документа', type: 'NUMBER', ops: [] },
  { id: 'status', label: 'Статус', type: 'ENUM', ops: [], values: enumValues(STATUS_LABEL) },
  { id: 'type', label: 'Тип сообщения', type: 'ENUM', ops: [], values: ['MT103', 'MT202', 'MT202COV', 'MT199'].map((v) => ({ value: v, label: v })) },
  { id: 'direction', label: 'Направление', type: 'ENUM', ops: [], values: (['IN', 'OUT', 'TRANSIT', 'OTHER'] as const).map((v) => ({ value: v, label: v })) },
  { id: 'currency', label: 'Валюта', type: 'ENUM', ops: [], values: ['USD', 'EUR', 'CNY', 'RUB'].map((v) => ({ value: v, label: v })) },
  { id: 'amount', label: 'Сумма', type: 'NUMBER', ops: [] },
  { id: 'created', label: 'Дата документа', type: 'DATE', ops: [] },
  { id: 'f50name', label: 'Приказодатель', type: 'STRING', ops: [] },
  { id: 'f59name', label: 'Бенефициар', type: 'STRING', ops: [] },
] }
const REASONS = ['Не найден счёт получателя', 'Превышен лимит', 'Санкционный стоп-лист', 'Ошибка формата 59', 'Нет покрытия', 'Дубликат 20', 'Отказ комплаенса', 'Просрочена дата валютирования', 'Неизвестный BIC']
// Код валюты в знаках 6–8 счёта: рубль в счёте — 810 (не ISO 4217 643), правило владельца.
const CCY = { USD: '840', EUR: '978', CNY: '156', RUB: '810' } as const
const NAMES = ['ООО «Северный ветер»', 'АО «Прибой»', 'ЗАО «Василёк»', 'ООО «Ромашка»', 'ПАО «Титан»', 'ООО «Меридиан»', 'АО «Глобус»', 'ООО «Кедр»', 'ИП Иванов А. А.', 'ООО «Лотос»']
const BICS = ['VKRBRU8KXXX', 'NRDIRUMMXXX', 'MRDNGB2LXXX', 'HSTBDEHHXXX', 'BCLHLV22XXX', 'CESEDEFFXXX', 'QWRTUS3NXXX', 'PLKZHKHHXXX']
const PROV = ['ЕРС', 'LORO', 'NOSTRO', 'SUBOUL', 'VTO']
// Наименования банков по BIC (словарь эталона `BANKS` в grid.tpl.html, обезличен; два BIC сверх словаря эталона — вымышлены по тому же образцу).
const BANK_NAME: Record<string, string> = {
  VKRBRU8KXXX: 'VOSTOCHNY KREDIT BANK KHABAROVSK BR', NRDIRUMMXXX: 'NORDINVEST BANK MOSCOW',
  MRDNGB2LXXX: 'MERIDIAN INTERMEDIARY BANK LONDON', HSTBDEHHXXX: 'HANSEATIC TRADE BANK HAMBURG',
  BCLHLV22XXX: 'BALTIC CLEARING BANK RIGA', CESEDEFFXXX: 'CENTRAL EURO SETTLEMENT AG FRANKFURT',
  QWRTUS3NXXX: 'QUORUM TRADE BANK SINGAPORE', PLKZHKHHXXX: 'POLARIS KREDIT BANK HELSINKI',
}
// Маршрут: тип + BIC получателя (эталон `RT`), префикс балансового счёта (эталон `ACC_PFX`).
const RT: [RouteType, string][] = [['NOSTRO', 'BCLHLV22XXX'], ['NOSTRO', 'HSTBDEHHXXX'], ['LORO', 'MRDNGB2LXXX'], ['INTERNAL', 'VKRBRU8KXXX'], ['NOSTRO', 'NRDIRUMMXXX']]
const ACC_PFX = ['30114', '30110', '30109', '47422', '30111']

/** Детерминированный ГПСЧ (mulberry32): одни и те же данные при каждом запуске. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)]!
const pad = (n: number, w: number) => String(n).padStart(w, '0')
const acc = (r: () => number, ccy: keyof typeof CCY) => `40702${CCY[ccy]}${pad(Math.floor(r() * 1e11), 11)}`

export function makeDocs(n = 87): Doc[] {
  const r = rng(20260923)
  const statuses: Status[] = ['IN_PROGRESS', 'TO_EXPORT', 'TO_EXPORT', 'PROCESSING', 'ERROR', 'DEFERRED', 'EXPORTED', 'EXPORTED', 'INVALID', 'REJECTED', 'DONE', 'DONE', 'DONE']
  const dirs: [Direction, string][] = [['IN', 'Входящий от ЦБ'], ['OUT', 'Исходящий на ЦБ'], ['OUT', 'Исходящий на Лоро'], ['TRANSIT', 'Транзит'], ['OTHER', 'Прочее']]
  return Array.from({ length: n }, (_, i) => {
    const status = pick(r, statuses)
    const currency = pick(r, ['USD', 'EUR', 'CNY', 'RUB'] as const)
    const [direction, dirTxt] = pick(r, dirs)
    const minute = 10 * 60 + 52 - i * 3
    const created = `2026-09-23T${pad(Math.floor(minute / 60), 2)}:${pad(minute % 60, 2)}:${pad(Math.floor(r() * 60), 2)}`
    const hasIn = r() > 0.3, hasOut = r() > 0.4
    // Порядок вызовов ГПСЧ ниже — как до плана 5b (записи 0..86 не сдвигаются); поля плана 5b — после core, без новых r().
    const core = {
      id: `0f3c${pad(i, 4)}-7b1d-4c8e-9f0a-${pad(Math.floor(r() * 1e12), 12)}`,
      docNumber: 800 + Math.floor(r() * 900000),
      refIn: hasIn ? `REF2026092${pad(i, 4)}` : null,
      refOut: hasOut ? `OUT${pad(Math.floor(r() * 1e7), 7)}` : null,
      uetr: `${pad(Math.floor(r() * 1e8), 8)}-1c2d-4e5f-8a9b-${pad(Math.floor(r() * 1e12), 12)}`,
      created, vdDt: '2026-09-23',
      type: pick(r, ['MT103', 'MT103', 'MT202', 'MT202COV', 'MT199'] as const),
      direction, dirTxt,
      amount: Math.round(r() * 5_000_000 * 100) / 100, currency,
      f50name: pick(r, NAMES), f50acc: acc(r, currency),
      purpose: r() > 0.15 ? `Оплата по договору № ${Math.floor(r() * 9000) + 100} от 0${Math.floor(r() * 9) + 1}.09.2026, ${pick(r, ['без НДС', 'в т.ч. НДС 20 %', 'НДС не облагается'])}` : null,
      f52: pick(r, BICS), f57: pick(r, BICS), f59name: pick(r, NAMES), f59acc: acc(r, currency),
      status, reason: status === 'ERROR' || status === 'DEFERRED' || status === 'REJECTED' ? pick(r, REASONS) : null,
      sender: pick(r, BICS), receiver: pick(r, BICS), provS: pick(r, PROV), provR: pick(r, PROV),
      vdKt: r() > 0.85 ? '2026-09-24' : '2026-09-23',
      lock: i % 11 === 2 ? { who: ['Иванова М. П.', 'Кузнецов Д. А.', 'Смирнова Е. В.'][i % 3]!, since: `2026-09-23T${pad(9 + (i % 8), 2)}:${pad((i * 13) % 60, 2)}:00` } : null,
      inactive: i % 13 === 7 ? { why: ['Документ в архиве', 'Запись отозвана инициатором', 'Снят с обработки администратором'][i % 3]! } : null,
    }
    // Поля плана 5b (эталон grid.tpl.html): без новых вызовов ГПСЧ — только из уже вычисленных полей core.
    return {
      ...core,
      f50opt: 'F', f59opt: 'F',
      f52name: BANK_NAME[core.f52] ?? core.f52, f57name: BANK_NAME[core.f57] ?? core.f57,
      f58: core.type.indexOf('MT202') === 0 ? core.f57 : null, f58name: core.type.indexOf('MT202') === 0 ? (BANK_NAME[core.f57] ?? core.f57) : null,
      outSender: core.f57, outReceiver: core.f52,
      routeType: RT[i % 5]![0], routeRecv: RT[i % 5]![1],
      routeAcc: ACC_PFX[i % 5] + CCY[core.currency] + pad((i * 3) % 10, 1) + pad(1000 + (i * 37 + 261) % 9000, 4) + pad(1000000 + (i * 7919 + 430157) % 9000000, 7),
    }
  })
}
