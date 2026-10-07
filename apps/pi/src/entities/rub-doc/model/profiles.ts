import type { FormSchema } from '@katran/ui'
import type { DetailAction, DetailTab } from '../../../shared/lib/detail'
import type { RubType } from './rubDoc'

/** Заголовок деталки (спека 2a §1.1; эталон рубля — «Платёжная инструкция», rubHtml, index.html:1150). */
export const RUB_DETAIL_TITLE = 'Платёжная инструкция'

/** Реквизит рубля: подпись, номер поля платёжного документа (тег), моноширинное значение — RFIELDS стенда (index.html:689). */
export type RubFieldMeta = { label: string; no?: string | undefined; mono?: boolean | undefined }
export const RFIELDS: Record<string, RubFieldMeta> = {
  name: { label: 'Наименование' }, opt: { label: 'Опция' }, acc: { label: 'Номер счёта', mono: true }, inn: { label: 'ИНН', mono: true },
  kpp: { label: 'КПП', mono: true }, info: { label: 'Доп. информация' }, addr: { label: 'Адрес' }, bank: { label: 'Наименование банка' },
  bic: { label: 'БИК', mono: true }, bankAcc: { label: 'Счёт банка', mono: true }, bankInfo: { label: 'Доп. информация' },
  purpose: { label: 'Назначение платежа' },
  instr: { label: 'Инструкция получателю' }, uip: { label: 'УИП', mono: true }, reserve: { label: 'Резервное поле' }, f20: { label: 'Назначение платежа. Поле 20' },
  b101: { no: '101', label: 'Код статуса плательщика', mono: true }, b104: { no: '104', label: 'Код бюджетной классификации', mono: true },
  b105: { no: '105', label: 'ОКТМО', mono: true }, b106: { no: '106', label: 'Основание налогового платежа' },
  b107: { no: '107', label: 'Налоговый период' }, b108: { no: '108', label: 'Номер документа' },
  b109: { no: '109', label: 'Дата налогового документа' }, b110: { no: '110', label: 'Код вида налогового платежа', mono: true },
  c48: { no: '48', label: 'Дата поступления документов' }, cLimit: { label: 'Идентификатор ограничения', mono: true },
  c70: { no: '70', label: 'Содержание операции' }, c38: { no: '38', label: 'Номер частичного платежа' },
  c39: { no: '39', label: 'Шифр частичного платежа' }, c40: { no: '40', label: 'Исходное распоряжение. Номер документа' },
  c41: { no: '41', label: 'Исходное распоряжение. Дата выписки' },
}

/** Строки таблицы «отправитель | получатель» — RUB_PARTY стенда (index.html:718). */
export const RUB_PARTY = ['name', 'opt', 'acc', 'inn', 'kpp', 'info', 'addr', 'bank', 'bic', 'bankAcc', 'bankInfo'] as const
export const PURPOSE_EXTRA_ROWS = ['instr', 'uip', 'reserve', 'f20'] as const
export const BUDGET_ROWS = ['b101', 'b104', 'b105', 'b106', 'b107', 'b108', 'b109', 'b110'] as const
/** «|» — разделитель групп строк секции (эталон RSECTIONS.collect). */
export const COLLECT_ROWS = ['c48', 'cLimit', 'c70', '|', 'c38', 'c39', 'c40', 'c41'] as const
export const COLLECT_KEYS = ['c48', 'cLimit', 'c70', 'c38', 'c39', 'c40', 'c41'] as const
export const AGENT_COLS = [['Наименование', 'name'], ['БИК', 'bic'], ['Счёт банка', 'bankAcc'], ['Счёт получателя', 'acc']] as const
export const AGENT_KEYS = ['name', 'bic', 'bankAcc', 'acc'] as const
export const ED107_HEAD = [['relId', 'ID связанного документа'], ['initId', 'ID инициирующего документа'], ['relDate', 'Дата связанного документа'], ['execDate', 'Запрошенная дата исполнения']] as const
export const ED107_KEYS = ['relId', 'initId', 'relDate', 'execDate'] as const
/** Подгруппы ED107 — узлы ЭС и реквизиты (эталон RSECTIONS.ed107.groups, index.html:707–713; вопрос В-Д3). */
export const ED107_GROUPS = [
  { id: 'payer', title: 'Информация о банке-плательщике', node: 'OrderingBank', rows: ['BIC', 'ed:Name', 'BankAccount', 'SWBIC'] },
  { id: 'acctWith', title: 'Информация об агенте банка-получателя', node: 'AcctWithInst', rows: ['BIC', 'ed:Name', 'BankAccount', 'SWBIC'] },
  { id: 'benef', title: 'Информация о банке-получателе', node: 'Beneficiary', rows: ['BIC', 'ed:Name', 'BankAccount', 'SWBIC'] },
  { id: 'prev', title: 'Информация о предыдущем инструктирующем банке', node: 'PrevInstrAgent', rows: ['BIC', 'ed:Name', 'BankAccount', 'SWBIC'] },
  { id: 'instg', title: 'Информация о банке-отправителе', node: 'InstructingAgent', rows: ['BIC', 'CorrespAcc', 'SWBIC'] },
  { id: 'instd', title: 'Информация о банке-исполнителе', node: 'InstructedAgent', rows: ['BIC', 'CorrespAcc', 'SWBIC'] },
] as const

/** Сворачиваемые секции — RUB_SECTIONS/RSECTIONS стенда (index.html:700–717), по порядку. */
export const RUB_SECTIONS = ['purposeExtra', 'agents', 'budget', 'ed107', 'collect'] as const
export type RubSectionId = (typeof RUB_SECTIONS)[number]
export const RSECTION_TITLE: Record<RubSectionId, string> = {
  purposeExtra: 'Назначение платежа. Дополнительная информация', agents: 'Посредник', budget: 'Бюджетные реквизиты',
  ed107: 'Параметры ED107', collect: 'Параметры инкассового поручения',
}

/**
 * Код операции по типу (эталон r.opCode: 01 — платёжное, 06 — инкассовое, index.html:892/909).
 * У платёжного ордера образца на стенде нет — кода нет, '' (решение В-Д3 от 30.09: как на эталоне).
 */
export const RUB_OPERATION: Record<RubType, string> = { PAYDOCRU: '01', REQDOCRU: '06', PAYORDRU: '' }

const SCHEMA: FormSchema = {
  hero: ['num', 'op', 'queue', 'sum'],
  blocks: ['scen', 'tx', 'party', 'purpose'],
  sections: RUB_SECTIONS.map((id) => ({ id, title: RSECTION_TITLE[id] })),
  sectionsTitle: 'Дополнительные блоки',
}
/** Профили видов документа — PROFILES.PAYDOCRU/REQDOCRU/PAYORDRU стенда (index.html:720–722): компоновка одна, отличается заголовок. */
export const RUB_PROFILES: Record<RubType, { title: string; schema: FormSchema }> = {
  PAYDOCRU: { title: 'Платёжное поручение', schema: SCHEMA },
  REQDOCRU: { title: 'Инкассовое поручение', schema: SCHEMA },
  PAYORDRU: { title: 'Платёжный ордер', schema: SCHEMA },
}
export const rubSchemaOf = (d: { type: RubType }): FormSchema => RUB_PROFILES[d.type].schema

/** Вкладки — TABS_RUB стенда (index.html:723): ED244 вместо «Исходного текста», без «Доп. полей» (вопрос В-Д2). */
export const RUB_TABS: DetailTab[] = [
  { id: 'main', label: 'Общие данные' }, { id: 'statuses', label: 'Статусы' }, { id: 'compliance', label: 'Комплаенс' },
  { id: 'linked', label: 'Связанные документы' }, { id: 'tasks', label: 'Задачи' }, { id: 'notif', label: 'Нотификации' },
  { id: 'ed244', label: 'ED244' }, { id: 'stream', label: 'Стриминг' }, { id: 'mpu', label: 'MPU' }, { id: 'audit', label: 'Аудит' },
]

/** Действия — ACTIONS_RUB стенда (index.html:734) без «Редактировать» (спека 2d §4 п. 8): как у валюты, кроме скачивания и форм печати. */
export const RUB_ACTIONS: DetailAction[] = [
  { id: 'refresh', label: 'Обновить', icon: 'refresh', hotkey: 'F5' },
  { id: 'esid', label: 'Создать служебный документ', icon: 'doc' },
  { id: 'down', label: 'Скачать сообщение ED (XML)', icon: 'download' },
  { id: 'print', label: 'Печать', icon: 'print', menu: [
    { label: 'Платёжное поручение', form: 'payment-order' }, { label: 'Инкассовое поручение', form: 'collection-order' },
    { label: 'Платёжный ордер', form: 'payment-ordr' }, { label: 'Мемориальный ордер', form: 'memorial-order' },
  ] },
  { id: 'link', label: 'Скопировать ссылку на документ', icon: 'link' },
  { id: 'ban', label: 'Аннулировать', icon: 'ban', danger: true },
]
