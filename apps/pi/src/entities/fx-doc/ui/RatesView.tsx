import styled from 'styled-components'
import { k } from '@katran/tokens'
import { formatDate } from '@katran/ui'
import type { Rates } from '../../../shared/api'
import type { LookupView } from '../../../shared/lib/detail'
import { LookupBody } from '../../posting/@x/fx-doc'

const RatesBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp1};
  white-space: nowrap;

  & p {
    margin: 0;
  }
`

const RateNum = styled.b`
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`

/**
 * Поповер «Курс» (спека 2e §4 п. 6): курс ЦБ на дату за 1 единицу валюты 32A, рублёвый эквивалент суммы, при конверсии —
 * курс сделки и списанная сумма. Числа — строками бека, не форматируются; дата — formatDate кита.
 */
export function RatesView({ view, ccy }: { view: LookupView<Rates>; ccy: string }) {
  return (
    <LookupBody view={view} lines={2}>
      {(r) => (
        <RatesBox>
          <p>Курс ЦБ на {formatDate(r.cb.date)} — <RateNum>{r.cb.rate}</RateNum> RUB за 1 {ccy}</p>
          <p>Рублёвый эквивалент — <RateNum>{r.cb.rub}</RateNum> RUB</p>
          {r.deal && (
            <p>Курс сделки {r.deal.from}→{r.deal.to} — <RateNum>{r.deal.rate}</RateNum> · списано <RateNum>{r.deal.amount}</RateNum> {r.deal.from}</p>
          )}
        </RatesBox>
      )}
    </LookupBody>
  )
}
