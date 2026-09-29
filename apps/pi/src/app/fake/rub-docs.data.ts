import type { Status } from '../../entities/doc-status'
import { STATUS_LABEL } from '../../entities/doc-status'
import { ED_BY_TYPE, TYPE_NAME, type RubDoc, type RubType } from '../../entities/rub-doc'
import type { FilterMetaDto } from '../../shared/api'
import { field, inline } from './meta'

/** То, что бек отдаст в GET /grids/rub-docs/filter-meta (десять полей режима simple, спека §8.2). */
export const rubDocsMeta: FilterMetaDto = {
  gridId: 'rub-docs',
  fields: [
    field('docNumber', 'Номер документа', 'STRING'),
    field('status', 'Статус', 'ENUM', 'docStatus'),
    field('type', 'Тип документа', 'ENUM', 'rubType'),
    field('direction', 'Группа направления', 'ENUM', 'direction'),
    field('amount', 'Сумма', 'NUMBER'),
    field('queue', 'Очерёдность', 'ENUM', 'queue'),
    field('created', 'Дата создания', 'DATE'),
    field('fromName', 'Наименование отправителя', 'STRING'),
    field('toName', 'Наименование получателя', 'STRING'),
    field('toInn', 'ИНН получателя', 'STRING'),
  ],
  dictionaries: {
    docStatus: inline(STATUS_LABEL), rubType: inline(TYPE_NAME),
    direction: inline({ IN: 'IN', OUT: 'OUT', TRANSIT: 'TRANSIT', OTHER: 'OTHER' }),
    queue: inline({ 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' }),
  },
}

// Словари — дословно из эталона `pi-constructor/rub-grid.tpl.html` (строки 250–265, коммит e065bfb/0da1f48,
// STATE §10), обезличенный стенд. RNAMES: [наименование, счёт, ИНН, КПП]; RBANKS: [наименование, БИК, корсчёт]
// (порядок деструктуризации проверен на стенде — Task 1).
const RNAMES: [string, string, string, string][] = [
  ['ООО «ЛЕЗЯФОТЫ ВЕФО»', '40702810999377318571', '5790280657', '899351656'],
  ['ИП ЗОСЕДЕОВА ФОДЕС МЫРЯОВИЧ', '40802810411821524886', '242032929187', ''],
  ['ФЯБЕРИОВА ПИРАС ГИЗАОВНА', '40817810516762861162', '256169407365', '0'],
  ['АО «МЕФЯ ФОТЕ»', '40702810547442693048', '1265428092', '409490573'],
  ['АО «ЗАГЕЛУ МЯТА»', '40702810296328313510', '8298199680', '464601040'],
  ['ИП ПОТОВЯОВА ПОСЯС БЕПЯОВИЧ', '40802810904985101300', '409237987347', ''],
  ['УФК ПО ТАПУСИСКОЙ ОБЛАСТИ (ОСП ПО ВЕЗОГАСКОМУ РАЙОНУ, Л/С 61607971986)', '03212005856973513359', '4512765492', '571932912'],
  ['АО «ФОЛО ЛЯГИ»', '40702810738902691171', '4907238712', '281270852'],
]
const RBANKS: [string, string, string][] = [
  ['АО «МУЛАПЯ БАНК»', '049757384', '30101810926712740298'],
  ['ФИЛИАЛ № 8771 БАНКА «ТЯПЯ» (ПАО)', '042242532', '30101810238199212863'],
  ['ГЕВАХИСКОЕ ГУ БАНКА РОССИИ // УФК ПО ДИЗАДОСКОЙ ОБЛАСТИ', '015920113', '40102810460045043926'],
  ['ФИЛИАЛ № 9292 БАНКА «ХЕВЯ» (ПАО)', '045542573', '30101810601804259605'],
  ['АО «ВЫТУЗЫ БАНК»', '044730199', '30101810919943546358'],
  ['БАНК «ПАПА» (АО)', '043235386', '30101810547929061477'],
]
const RPURP = [
  'Оплата по счёту № 2923-2915 от 07.03.2026 за работы по договору 14-56 от 02.08.2026. В том числе НДС 20% — 13 148.08 руб.',
  'Взыскание по исп. пост. 708283995/9219 от 25.05.2026. СПИ ТЯХУБАОВА А. П. по и/п № 551122/26/86378-ИП от 08.06.2026',
  'Предоплата по договору поставки № 54-62 от 14.07.2026 за оборудование. НДС не облагается',
  'Заработная плата за сентябрь 2026 по реестру № 20 от 22.07.2026. НДС не облагается',
  'Налог на прибыль организаций за 9 месяцев 2026 г. Уведомление № 2 от 04.05.2026',
  'Возврат ошибочно перечисленных средств по п/п № 0386 от 06.08.2026. Без НДС',
]
const RTYPES: RubType[] = ['PAYDOCRU', 'PAYDOCRU', 'REQDOCRU', 'PAYDOCRU', 'PAYORDRU', 'PAYDOCRU', 'PAYDOCRU', 'REQDOCRU', 'PAYDOCRU', 'PAYDOCRU', 'PAYORDRU', 'PAYDOCRU']
const STS: Status[] = ['DONE', 'IN_PROGRESS', 'DONE', 'ERROR', 'DONE', 'TO_EXPORT', 'PROCESSING', 'DEFERRED', 'EXPORTED', 'REJECTED', 'DONE', 'IN_PROGRESS']
const REASONS = ['Отправлен запрос в СУБО Контроль(2700)', 'Документ отправлен в ЦБ', 'Документ на контроле ДККФМ', 'Ожидание решения сотрудника', 'Документ с будущей датой исполнения', 'Ожидание обработки основного документа', 'В очереди ожидания средств (картотека 2)', 'Счёт плательщика закрыт. Поиск исходящего документа', 'Ожидание ответа от PRM']
// причина статуса бывает только у Отложенный / Ошибка / Отказ
const REASON_BY_ST: Partial<Record<Status, number[]>> = { DEFERRED: [4, 5, 6, 3, 8, 0, 2, 1], ERROR: [7], REJECTED: [7, 3] }
// направление — группа (IN/OUT/TRANSIT/OTHER) и название направления
const DIRS: [RubDoc['direction'], string][] = [
  ['IN', 'входящий от ЦБ на клиента'], ['OUT', 'исходящий на ЦБ'], ['OUT', 'исходящий на ЦБ · взыскание'], ['IN', 'входящий от ЦБ на клиента'],
  ['OTHER', 'внутрибанковский перевод'], ['OUT', 'исходящий на ЦБ · бюджетный'], ['IN', 'входящий от ЦБ на клиента'], ['OUT', 'исходящий на ЦБ'],
  ['TRANSIT', 'транзит через корсчёт филиала'], ['OUT', 'исходящий на ЦБ'], ['OTHER', 'внутрибанковский ордер'], ['IN', 'входящий от ЦБ на клиента'],
]
// системы: инициатор / источник / назначение — короткие коды ИС
const SYS: [string, string, string][] = [
  ['NCB.NCB_IN', 'UFX', 'RTL'], ['DBS.DBS_PKD', 'SBO', 'UFX'], ['CLT.CLT_DCR', 'CLX', 'PRM'],
  ['NCB.NCB_IN', 'UFX', 'CRP'], ['ERX.ERX_1', 'OPX', 'RTL'], ['TXS.TXS_ENP', 'SBO', 'UFX'],
]
// заблокировавшие / причины неактивности — тот же словарь, что у валютного реестра (fx-docs.data.ts)
const LOCK_WHO = ['Иванова М. П.', 'Кузнецов Д. А.', 'Смирнова Е. В.']
const INACTIVE_WHY = ['Документ в архиве', 'Запись отозвана инициатором', 'Снят с обработки администратором']

const pad = (n: number, w: number) => String(n).padStart(w, '0')

/** 87 рублёвых документов по схеме генератора стенда (rub-grid.tpl.html): индексы словарей — те же, данные вымышленные. */
export function makeRubDocs(n = 87): RubDoc[] {
  return Array.from({ length: n }, (_, i) => {
    const [fromName, fromAcc, fromInn, fromKpp] = RNAMES[i % 8]!
    const [toName, toAcc, toInn, toKpp] = RNAMES[(i + 3) % 8]!
    const [fromBank, fromBic] = RBANKS[i % 6]!
    const [toBank, toBic] = RBANKS[(i + 1) % 6]!
    const k = i % 12
    const type = RTYPES[k]!
    const status: Status = i % 29 === 5 ? 'INVALID' : STS[k]!
    const rs = REASON_BY_ST[status]
    const [direction, dirTxt] = DIRS[k]!
    const [initiator, source, destination] = SYS[i % 6]!
    const day = 22 + (k > 7 ? 1 : 0)
    const hh = 7 + (i * 3) % 11
    // Р13: у части входящих документов docRef пуст (эталон, стенд `rub-grid.tpl.html`) — покрывает состояние
    // «нет значения» линк-кнопки docRef.
    const docRef = direction === 'IN' && i % 4 === 1 ? '' : `${ED_BY_TYPE[type]}-26092${day % 10}000${pad(1800 + i * 7, 4)}`
    return {
      id: `rub-${pad(i, 4)}`, docNumber: String(2900 + i * 3), uuid: `${pad(i, 2)}e0c7a2-5b1d-4c8e-9f0a-${pad(i * 7919, 12)}`,
      txId: `TX${pad(i * 131, 8)}`, docRef,
      created: `2026-09-${day}T${pad(hh, 2)}:${pad((i * 17) % 60, 2)}:${pad((i * 7) % 60, 2)}`,
      changed: `2026-09-${day + (i % 9 === 4 ? 1 : 0)}T${pad(Math.min(23, hh + (i % 3)), 2)}:${pad((i * 29) % 60, 2)}:00`,
      type, edCode: ED_BY_TYPE[type], direction, dirTxt,
      amount: Math.round(((i * 7919) % 250_000_000) + 5405) / 100, queue: 1 + (i * 5) % 5, prio: i % 7 === 3 ? 1 : 0,
      fromName, fromAcc, fromInn, fromKpp, fromBic, fromBank, toName, toAcc, toInn, toKpp, toBic, toBank,
      initiator, source, destination, purpose: RPURP[i % RPURP.length]!,
      status, reason: rs ? REASONS[rs[i % rs.length]!]! : null,
      // состояния записи — та же механика, что у валютного реестра (спека 5a §6, B1; решение В-Р2)
      lock: i % 11 === 2 ? { who: LOCK_WHO[i % 3]!, since: `2026-09-23T${pad(9 + i % 8, 2)}:${pad((i * 13) % 60, 2)}:00` } : null,
      inactive: i % 13 === 7 ? { why: INACTIVE_WHY[i % 3]! } : null,
    }
  })
}
