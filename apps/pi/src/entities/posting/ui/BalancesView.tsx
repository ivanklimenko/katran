import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Button, formatDateTimeFull } from '@katran/ui'
import type { Balances } from '../../../shared/api'
import type { LookupView } from '../../../shared/lib/detail'
import { LookupBody } from './LookupLink'

/* Остатки по счетам: «Счёт · Валюта · Остаток · Доступно» */
const BalAcc = styled.th`
  font: 400 ${k.fs2} / ${k.lh2} ${k.mono};
  color: ${k.val};
`

const BalNum = styled.td`
  font-variant-numeric: tabular-nums;
`

const BalErr = styled.td`
  color: ${k.bad};
`

const Bal = styled.table`
  border-collapse: collapse;

  & th,
  & td {
    padding: ${k.sp1} ${k.sp2};
    border-top: 1px solid ${k.line2};
    text-align: left;
    white-space: nowrap;
  }

  & thead th {
    border-top: 0;
    font: 500 ${k.fs3} / ${k.lh3} ${k.sans};
    color: ${k.muted};
  }

  & td${BalNum},
  & thead th:nth-child(n + 3) {
    text-align: right;
  }
`

const BalFoot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${k.sp3};
  margin-top: ${k.sp2};
  font-size: ${k.fs2};
  color: ${k.muted};
`

/**
 * Поповер «Проверить баланс» (спека 2e §4 п. 7): остатки по счетам проводок. Суммы — строками бека, не форматируются;
 * счёт с ошибкой — текст ошибки на всю ширину строки после счёта. «Обновить» — перезапрос, старая таблица видна до ответа;
 * на время запроса кнопка занята (aria-disabled, а не disabled: фокус на ней не теряется).
 */
export function BalancesView({ view }: { view: LookupView<Balances> }) {
  const busy = view.state === 'loading'
  return (
    <LookupBody view={view} lines={3}>
      {(b) => (
        <>
          <Bal>
            <thead>
              <tr><th scope="col">Счёт</th><th scope="col">Валюта</th><th scope="col">Остаток</th><th scope="col">Доступно</th></tr>
            </thead>
            <tbody>
              {b.items.map((it) => (
                <tr key={it.acc}>
                  <BalAcc scope="row">{it.acc}</BalAcc>
                  {'error' in it
                    ? <BalErr colSpan={3}>{it.error}</BalErr>
                    : (
                      <>
                        <td>{it.ccy}</td>
                        <BalNum>{it.balance}</BalNum>
                        <BalNum>{it.available ?? '—'}</BalNum>
                      </>
                    )}
                </tr>
              ))}
            </tbody>
          </Bal>
          <BalFoot>
            <span>по состоянию на {formatDateTimeFull(b.asOf)}</span>
            <Button size="s" aria-busy={busy || undefined} aria-disabled={busy || undefined} onClick={() => { if (!busy) view.refresh() }}>Обновить</Button>
          </BalFoot>
        </>
      )}
    </LookupBody>
  )
}
