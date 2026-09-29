import type { Status } from '../../entities/doc-status'
import { STATUS_LABEL } from '../../entities/doc-status'
import { CURRENCIES, FX_TYPES, type Direction, type FxDoc, type RouteType } from '../../entities/fx-doc'
import type { FilterMetaDto } from '../../shared/api'
import { field, inline } from './meta'

const labelsOf = (xs: readonly string[]) => Object.fromEntries(xs.map((x) => [x, x]))
/** То, что бек отдаст в GET /grids/fx-docs/filter-meta (девять полей режима simple). */
export const fxDocsMeta: FilterMetaDto = {
  gridId: 'fx-docs',
  fields: [
    field('docNumber', 'Номер документа', 'NUMBER'),
    field('status', 'Статус', 'ENUM', 'docStatus'),
    field('type', 'Тип сообщения', 'ENUM', 'fxType'),
    field('direction', 'Направление', 'ENUM', 'direction'),
    field('currency', 'Валюта', 'ENUM', 'currency'),
    field('amount', 'Сумма', 'NUMBER'),
    field('created', 'Дата документа', 'DATE'),
    field('f50name', 'Приказодатель', 'STRING'),
    field('f59name', 'Бенефициар', 'STRING'),
  ],
  // направление — код и в гриде, и в фильтре (план 4, F7): справочник кодами, не подписями DIRECTION_LABEL
  dictionaries: { docStatus: inline(STATUS_LABEL), fxType: inline(labelsOf(FX_TYPES)), direction: inline({ IN: 'IN', OUT: 'OUT', TRANSIT: 'TRANSIT', OTHER: 'OTHER' }), currency: inline(labelsOf(CURRENCIES)) },
}

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

export function makeFxDocs(n = 87): FxDoc[] {
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
