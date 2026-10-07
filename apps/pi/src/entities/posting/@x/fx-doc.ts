/** Публичный API posting для соседней сущности fx-doc (FSD @x). */
export type { Tx } from '../model/posting'
export { parseTxs } from '../api/posting.mapper'
export { TxBlock } from '../ui/TxBlock'
/** Кнопка-ссылка и содержимое поповера справочного запроса — общие с «Проверить баланс» (поповер «Курс», спека 2e §4 п. 6, 8). */
export { LookupBody, LookupLink } from '../ui/LookupLink'
