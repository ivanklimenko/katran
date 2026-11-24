export const TX_DIRS = ['DEBIT', 'CREDIT'] as const
export const TX_STATES = ['EXECUTED', 'PENDING', 'CANCELED'] as const
export type TxDir = (typeof TX_DIRS)[number]
export type TxState = (typeof TX_STATES)[number]
/** Проводка документа (эталон TX6, index.html:759): направление, состояние, счёт, регистр, время (null — неизвестно), сумма, валюта. */
export type Tx = { dir: TxDir; st: TxState | null; acc: string; reg: string; time: string | null; amount: number; currency: string }
