import { sample } from 'effector'
import { createLookup } from '../../../features/doc-lookups'
import { createBalancesFx, ratesFx } from '../../../shared/api'
import { detail, lifecycle } from './registry.model'

/** Порт остатков валютного реестра — своя копия на экран (подмена в тестах через fork({ handlers })). */
export const fxBalancesFx = createBalancesFx('fx-docs')

/**
 * Справочные запросы валютного документа (спека 2e §3.3, §3.6): «Курс» в сводке 32A и «Проверить баланс» в блоке транзакций.
 * Кэш по документу на время экрана (pageClosed чистит сам createLookup).
 */
export const rates = createLookup({ fx: ratesFx, lifecycle })
export const balances = createLookup({ fx: fxBalancesFx, lifecycle })

// документ обновили («Обновить», 409, аннулирование, правка) — его курсы и остатки устарели; ответ летящего запроса отбрасывается
sample({ clock: [detail.refreshDoc, detail.replaceDetail.map(({ id }) => id)], target: [rates.reset, balances.reset] })
