import { sample } from 'effector'
import { createLookup } from '../../../features/doc-lookups'
import { createBalancesFx } from '../../../shared/api'
import { detail, lifecycle } from './registry.model'

/** Порт остатков рублёвого реестра — своя копия на экран (подмена в тестах через fork({ handlers })). */
export const rubBalancesFx = createBalancesFx('rub-docs')

/**
 * «Проверить баланс» рублёвого документа (спека 2e §3.3, §3.6); «Курса» у рубля нет. Кэш по документу на время экрана
 * (pageClosed чистит сам createLookup).
 */
export const balances = createLookup({ fx: rubBalancesFx, lifecycle })

// документ обновили («Обновить», 409, аннулирование) — его остатки устарели; ответ летящего запроса отбрасывается
sample({ clock: [detail.refreshDoc, detail.replaceDetail.map(({ id }) => id)], target: balances.reset })
