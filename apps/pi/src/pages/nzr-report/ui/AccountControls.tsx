import { useRef, useState } from 'react'
import { Button, Checkbox, Dialog, Input, Pagination, Select, formatAmount, formatDateTimeFull } from '@katran/ui'
import { filterAccounts, toggleIds, type Account, type AccountCatalog } from '../model/report'
import { SavedAccountSets } from './SavedAccountSets'
import { Bar, Monospace, Muted, SwitcherList, Table, TableScroll } from './styles'

const PAGE_SIZE = 10

export function AccountSetDialog({ accounts, chosen, snapshot, onApply, onClose }: {
  accounts: Account[]; chosen: string[]; snapshot?: AccountCatalog['snapshot']; onApply: (ids: string[]) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(() => new Set(chosen))
  const [query, setQuery] = useState('')
  const [currency, setCurrency] = useState('')
  const [nonzero, setNonzero] = useState(true)
  const [ascending, setAscending] = useState(false)
  const [page, setPage] = useState(1)
  const search = useRef<HTMLInputElement>(null)
  const selected = accounts.filter((a) => draft.has(a.id)).map((a) => a.id)
  const filtered = filterAccounts(accounts, query, currency, nonzero, ascending)
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageChecked = pageRows.filter((a) => draft.has(a.id)).length
  const setChecked = (ids: string[], checked: boolean) => setDraft((s) => toggleIds(s, ids, checked))

  return (
    <Dialog open title="Набор счетов НЗР" onClose={onClose} size="l" initialFocus={() => search.current}
      footer={<>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="primary" onClick={() => onApply(selected)}>Применить набор</Button>
      </>}
    >
      <SavedAccountSets selected={selected} available={new Set(accounts.map((a) => a.id))} onSelect={(ids) => setDraft(new Set(ids))} />
      <Bar>
        <Input ref={search} type="search" aria-label="Поиск счетов НЗР" placeholder="Номер счёта или название" value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
        <Select aria-label="Валюта счетов" value={currency} placeholder="Все валюты"
          options={[...new Set(accounts.map((a) => a.currency))].map((code) => ({ value: code, label: code }))}
          onChange={(e) => { setCurrency(e.target.value); setPage(1) }} />
        <Checkbox label="Только ненулевые" checked={nonzero} onChange={(e) => { setNonzero(e.target.checked); setPage(1) }} />
      </Bar>
      <p><Muted>
        {snapshot && <>Снимок регистра · {formatDateTimeFull(snapshot.takenAt)}. Период обновления {snapshot.intervalMinutes} мин. </>}
        Суммы в валюте счёта.
      </Muted></p>
      <Bar>
        <Button size="s" disabled={!filtered.length} onClick={() => setChecked(filtered.map((a) => a.id), true)}>Выбрать все найденные · {filtered.length}</Button>
        <Button size="s" disabled={!draft.size} onClick={() => setDraft(new Set())}>Снять выбор</Button>
        <span>Выбрано {draft.size} из {accounts.length}</span>
      </Bar>
      <TableScroll>
        <Table aria-label="Счета НЗР для включения в набор">
          <thead>
            <tr>
              <th scope="col"><Checkbox aria-label="Выбрать счета на странице" disabled={!pageRows.length}
                checked={pageRows.length > 0 && pageChecked === pageRows.length} indeterminate={pageChecked > 0 && pageChecked < pageRows.length}
                onChange={(e) => setChecked(pageRows.map((a) => a.id), e.target.checked)} /></th>
              <th scope="col">Счёт НЗР</th><th scope="col">Валюта</th>
              <th scope="col" data-number aria-sort={ascending ? 'ascending' : 'descending'}>
                <Button size="s" onClick={() => { setAscending(!ascending); setPage(1) }}>Доступный остаток {ascending ? '↑' : '↓'}</Button>
              </th>
              <th scope="col">Название</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((a) => (
              <tr key={a.id}>
                <td><Checkbox aria-label={`Включить счёт ${a.id} ${a.currency}`} checked={draft.has(a.id)}
                  onChange={(e) => setChecked([a.id], e.target.checked)} /></td>
                <td><Monospace>{a.id}</Monospace></td><td>{a.currency}</td><td data-number>{formatAmount(a.balance)}</td><td>{a.name}</td>
              </tr>
            ))}
            {!pageRows.length && <tr><td colSpan={5} data-empty>Счета не найдены</td></tr>}
          </tbody>
        </Table>
      </TableScroll>
      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
    </Dialog>
  )
}

export function AccountSwitcher({ accounts, active, onActivate, onClose }: {
  accounts: Account[]; active: string; onActivate: (id: string) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const found = accounts.filter((a) => `${a.id} ${a.currency} ${a.name}`.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <Dialog open title="Перейти к счёту" onClose={onClose}>
      <Input type="search" aria-label="Найти счёт в наборе" placeholder="Номер, валюта или название" value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(1) }} />
      <SwitcherList>
        {found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((a) => (
          <Button key={a.id} aria-current={a.id === active ? 'true' : undefined} onClick={() => onActivate(a.id)}>
            <Monospace>{a.id}</Monospace> · {a.currency} · {a.name}
          </Button>
        ))}
        {!found.length && <p>Счета не найдены</p>}
      </SwitcherList>
      <Pagination page={page} pageSize={PAGE_SIZE} total={found.length} onPage={setPage} />
    </Dialog>
  )
}
