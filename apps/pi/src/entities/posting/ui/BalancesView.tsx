import { Button, formatDateTimeFull } from '@katran/ui'
import type { Balances } from '../../../shared/api'
import type { LookupView } from '../../../shared/lib/detail'
import { LookupBody } from './LookupLink'
import s from './posting.module.css'

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
          <table className={s.bal}>
            <thead>
              <tr><th scope="col">Счёт</th><th scope="col">Валюта</th><th scope="col">Остаток</th><th scope="col">Доступно</th></tr>
            </thead>
            <tbody>
              {b.items.map((it) => (
                <tr key={it.acc}>
                  <th scope="row" className={s.balAcc}>{it.acc}</th>
                  {'error' in it
                    ? <td colSpan={3} className={s.balErr}>{it.error}</td>
                    : (
                      <>
                        <td>{it.ccy}</td>
                        <td className={s.balNum}>{it.balance}</td>
                        <td className={s.balNum}>{it.available ?? '—'}</td>
                      </>
                    )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className={s.balFoot}>
            <span>по состоянию на {formatDateTimeFull(b.asOf)}</span>
            <Button size="s" aria-busy={busy || undefined} aria-disabled={busy || undefined} onClick={() => { if (!busy) view.refresh() }}>Обновить</Button>
          </div>
        </>
      )}
    </LookupBody>
  )
}
