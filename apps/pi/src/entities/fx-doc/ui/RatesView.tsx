import { formatDate } from '@katran/ui'
import type { Rates } from '../../../shared/api'
import type { LookupView } from '../../../shared/lib/detail'
import { LookupBody } from '../../posting/@x/fx-doc'
import s from './detail.module.css'

/**
 * Поповер «Курс» (спека 2e §4 п. 6): курс ЦБ на дату за 1 единицу валюты 32A, рублёвый эквивалент суммы, при конверсии —
 * курс сделки и списанная сумма. Числа — строками бека, не форматируются; дата — formatDate кита.
 */
export function RatesView({ view, ccy }: { view: LookupView<Rates>; ccy: string }) {
  return (
    <LookupBody view={view} lines={2}>
      {(r) => (
        <div className={s.rates}>
          <p>Курс ЦБ на {formatDate(r.cb.date)} — <b className={s.rateNum}>{r.cb.rate}</b> RUB за 1 {ccy}</p>
          <p>Рублёвый эквивалент — <b className={s.rateNum}>{r.cb.rub}</b> RUB</p>
          {r.deal && (
            <p>Курс сделки {r.deal.from}→{r.deal.to} — <b className={s.rateNum}>{r.deal.rate}</b> · списано <b className={s.rateNum}>{r.deal.amount}</b> {r.deal.from}</p>
          )}
        </div>
      )}
    </LookupBody>
  )
}
