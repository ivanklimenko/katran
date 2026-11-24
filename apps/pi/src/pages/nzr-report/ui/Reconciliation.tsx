import { useUnit } from 'effector-react'
import { Button, formatAmount } from '@katran/ui'
import { localDate, metricDifference, type Account, type Metrics } from '../model/report'
import { $master, reconciliationRefreshed, reconciliationToggled } from '../model/workspace'
import { Bar, Grow, Muted, Panel, Table, TableScroll } from './styles'

const keys = ['balance', 'documents', 'turnover', 'operations'] as const
const display = (key: keyof Metrics, value: number) => key === 'balance' || key === 'turnover' ? formatAmount(value) : value

export function Reconciliation({ account, asOf, report, collapsed }: {
  account: Account; asOf: string; report: Metrics | null; collapsed: boolean
}) {
  const { master, refresh, toggle } = useUnit({ master: $master, refresh: reconciliationRefreshed, toggle: reconciliationToggled })
  const ready = master.phase === 'ready' && report !== null ? { master: master.data, report } : null
  const deltas = ready && keys.map((key) => metricDifference(key, ready.report, ready.master))
  const status = master.phase === 'error' ? 'Сверка не выполнена'
    : master.phase === 'loading' ? 'Запрос ПП ЛН…'
      : !deltas ? 'Ожидаем данные отчёта' : deltas.some(Boolean) ? 'Есть расхождения' : 'Данные совпадают'

  return (
    <Panel aria-label="Сверка с ПП ЛН">
      <Bar>
        <strong>Сверка ПП ЛН</strong>
        <span role="status">{status}</span>
        <Grow />
        <Button size="s" disabled={master.phase === 'loading'} onClick={refresh}>Обновить сверку</Button>
        <Button size="s" aria-expanded={!collapsed} aria-controls="nzr-reconciliation" onClick={toggle}>
          {collapsed ? 'Развернуть сверку' : 'Свернуть сверку'}
        </Button>
      </Bar>
      <div id="nzr-reconciliation" hidden={collapsed}>
        {master.phase === 'error' && <p>{master.message}</p>}
        {ready && deltas && (
          <>
            <TableScroll>
              <Table aria-label="Сверка активного счёта с ПП ЛН">
                <thead>
                  <tr>
                    <th scope="col">Источник</th><th scope="col" data-number>Доступный баланс, {account.currency}</th>
                    <th scope="col" data-number>Документов на НЗР</th>
                    <th scope="col" data-number>Оборот за {localDate(asOf)}, {account.currency}</th>
                    <th scope="col" data-number>Операций</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">ПП ЛН · мастер</th>{keys.map((k) => <td key={k} data-number>{display(k, ready.master[k])}</td>)}</tr>
                  <tr><th scope="row">Наш отчёт</th>{keys.map((k, i) => {
                    const delta = deltas[i]!
                    return <td key={k} data-number>{display(k, ready.report[k])}{delta !== 0 && <span data-delta> ({delta > 0 ? '+' : '−'}{display(k, Math.abs(delta))})</span>}</td>
                  })}</tr>
                </tbody>
              </Table>
            </TableScroll>
            <Muted>По активному счёту целиком, до фильтров документов. Разница в скобках — наш отчёт минус ПП ЛН.</Muted>
          </>
        )}
      </div>
    </Panel>
  )
}
