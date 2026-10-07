import type { FieldDef, FieldView, FormSchema } from '@katran/ui'
import type { DetailAction, DetailTab } from '../../../shared/lib/detail'
import type { SwiftValue } from './detail'
import type { FxDoc } from './fxDoc'

/** Заголовок деталки — как на эталоне (`dhHtml(d,'Платёжная инструкция ВАЛЮТА')`, index.html:1369): решение В-Д1 от 30.09, detail-drift.md Д7. */
export const FX_DETAIL_TITLE = 'Платёжная инструкция ВАЛЮТА'

/** Реестр SWIFT-полей — FIELDS стенда (index.html:597) дословно: name → label; признак правки (editable) — editable:true FIELDS эталона, index.html:597–620. */
export const FX_FIELDS: Record<string, FieldDef> = {
  '20': { label: 'Референс отправителя', kind: 'ref' },
  '21': { label: 'Связанный референс', kind: 'ref' },
  '32A': { label: 'Дата валютирования, валюта, сумма', kind: 'amount' },
  '33B': { label: 'Валюта и сумма инструкции', kind: 'short' },
  '36': { label: 'Курс', kind: 'short' },
  '50': { label: 'Приказодатель', kind: 'party', opts: ['A', 'F', 'K'], editable: true },
  '52': { label: 'Банк приказодателя', kind: 'bank', opts: ['A', 'D'], editable: true },
  '53': { label: 'Корреспондент отправителя', kind: 'bank', opts: ['A', 'B', 'D'] },
  '54': { label: 'Корреспондент получателя', kind: 'bank', opts: ['A', 'B', 'D'] },
  '55': { label: 'Третье возмещающее учреждение', kind: 'bank', opts: ['A', 'B', 'D'] },
  '56': { label: 'Банк-посредник', kind: 'bank', opts: ['A', 'C', 'D'], editable: true },
  '57': { label: 'Банк получателя', kind: 'bank', opts: ['A', 'B', 'C', 'D'], editable: true },
  '58': { label: 'Учреждение-бенефициар', kind: 'bank', opts: ['A', 'D'] },
  '59': { label: 'Бенефициар', kind: 'party', opts: ['', 'A', 'F'], editable: true },
  '70': { label: 'Детали платежа', kind: 'text', lines: 4, width: 35, editable: true },
  '71A': { label: 'Детали расходов', kind: 'short' },
  '71B': { label: 'Расходы, взимаемые получателем', kind: 'short' },
  '71F': { label: 'Расходы отправителя', kind: 'short' },
  '71G': { label: 'Расходы получателя', kind: 'short' },
  '121': { label: 'UETR — уникальный сквозной референс', kind: 'ref' },
  '72': { label: 'Информация отправителя получателю', kind: 'text', lines: 6, width: 35, show: 4, editable: true },
  '77B': { label: 'Регуляторная отчётность', kind: 'short' },
  '79': { label: 'Текст сообщения', kind: 'text', lines: 35, width: 50, show: 6 },
}

/** Подсказки букв опции — OPTS стенда (index.html:937). */
export const FX_OPTION_LABELS: Record<string, string> = {
  A: 'Опция A — BIC', B: 'Опция B — код местоположения', C: 'Опция C — счёт',
  D: 'Опция D — наименование и адрес', F: 'Опция F — имя и адрес структурированно', K: 'Опция K — имя и адрес',
}

const HINT = '50–54 слева · 55–59 справа'
/** Профили типов сообщений — PROFILES стенда (index.html:625) в форме FormSchema кита; ключи сводки: 20, 21, 71A, vd, 32A; блоки: msgs, route, tx. */
export const FX_PROFILES: Record<FxDoc['type'], { title: string; schema: FormSchema }> = {
  MT103: {
    title: 'Клиентский перевод',
    schema: {
      hero: ['20', '71A', 'vd', '32A'], blocks: ['msgs', 'route', 'tx'], fieldsTitle: 'Поля MT103', fieldsHint: HINT,
      grid: [['50', { tag: '55', hideIfEmpty: true }], ['52', { tag: '56', hideIfEmpty: true }], ['53', '57'], ['54', '59']],
      text: ['70', '72'], extra: ['33B', '36', '77B'],
    },
  },
  MT202: {
    title: 'Межбанковский перевод',
    schema: {
      hero: ['20', '21', 'vd', '32A'], blocks: ['msgs', 'route', 'tx'], fieldsTitle: 'Поля MT202', fieldsHint: HINT,
      grid: [['52', '56'], ['53', '57'], ['54', '58']], text: ['72'],
    },
  },
  MT202COV: {
    title: 'Межбанковский перевод с покрытием',
    schema: {
      hero: ['20', '21', 'vd', '32A'], blocks: ['msgs', 'route', 'tx'], fieldsTitle: 'Поля MT202COV', fieldsHint: HINT,
      grid: [['52', '56'], ['53', '57'], ['54', '58']], text: ['72'],
      seqB: {
        title: 'Покрываемый клиентский платёж · последовательность B',
        grid: [['B.50', { tag: 'B.56', hideIfEmpty: true }], ['B.52', 'B.57'], [null, 'B.59']], text: ['B.70', 'B.72'], extra: ['B.33B'],
      },
    },
  },
  MT199: {
    title: 'Свободный формат',
    schema: { hero: ['20', '21'], blocks: ['msgs'], fieldsTitle: 'Поля MT199', grid: [], text: ['79'] },
  },
}

export const fxSchemaOf = (d: { type: FxDoc['type'] }): FormSchema => FX_PROFILES[d.type].schema

/** Вкладки — TABS/TAB_KEY стенда (index.html:647–648), фиксированный порядок. */
export const FX_TABS: DetailTab[] = [
  { id: 'main', label: 'Общие данные' }, { id: 'extra', label: 'Доп. поля' }, { id: 'statuses', label: 'Статусы' },
  { id: 'compliance', label: 'Комплаенс' }, { id: 'linked', label: 'Связанные документы' }, { id: 'tasks', label: 'Задачи' },
  { id: 'notif', label: 'Нотификации' }, { id: 'source', label: 'Исходный текст' }, { id: 'stream', label: 'Стриминг' },
  { id: 'mpu', label: 'MPU' }, { id: 'audit', label: 'Аудит' },
]

/**
 * Действия лейна — ACTIONS стенда (index.html:729) без «Редактировать» (спека 2d §4 п. 8: правка — карандашами у целей);
 * пункты печати — подпись и код формы (план 2d, «Коды печатных форм»).
 */
export const FX_ACTIONS: DetailAction[] = [
  { id: 'refresh', label: 'Обновить', icon: 'refresh', hotkey: 'F5' },
  { id: 'esid', label: 'Создать служебный документ', icon: 'doc' },
  { id: 'down', label: 'Скачать SWIFT-сообщение', icon: 'download' },
  { id: 'print', label: 'Печать', icon: 'print', menu: [
    { label: 'Платёжное поручение', form: 'payment-order' }, { label: 'Мемориальный ордер', form: 'memorial-order' },
    { label: 'Форма SWIFT', form: 'swift-form' },
  ] },
  { id: 'link', label: 'Скопировать ссылку на документ', icon: 'link' },
  { id: 'ban', label: 'Аннулировать', icon: 'ban', danger: true },
]

const BIC = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/
/**
 * Вид SWIFT-поля в строке (эталон cell() и full(), index.html:936, 941): главное — первая строка; справа — счёт или BIC
 * последней строкой; одиночный BIC — только справа; полный текст — «/счёт» и строки с номерами «1/ …».
 */
export function swiftPresent(_tag: string, v: SwiftValue): FieldView {
  const lines = v.lines
  const last = lines[lines.length - 1] ?? ''
  let main = lines[0] ?? ''
  let second = v.acc ?? (lines.length > 1 && BIC.test(last) ? last : '')
  if (!v.acc && lines.length === 1 && BIC.test(main)) { second = main; main = '' }
  const full = [...(v.acc ? [`/${v.acc}`] : []), ...lines.map((l, i) => `${i + 1}/ ${l}`)]
  return { main, second, full }
}
