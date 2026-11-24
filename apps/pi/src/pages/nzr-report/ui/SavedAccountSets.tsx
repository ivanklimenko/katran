import { useEffect, useState } from 'react'
import { useUnit } from 'effector-react'
import { Button, Input, Select } from '@katran/ui'
import { $accountSets, accountSetKey, accountSetSaved, accountSetsOpened } from '../model/accountSets'
import { Bar, Form, Panel } from './styles'

export function SavedAccountSets({ selected, available, onSelect }: {
  selected: string[]; available: Set<string>; onSelect: (ids: string[]) => void
}) {
  const { state, load, save } = useUnit({ state: $accountSets, load: accountSetsOpened, save: accountSetSaved })
  const [name, setName] = useState('')
  const [picked, setPicked] = useState('')
  const [warning, setWarning] = useState('')
  useEffect(() => { load() }, [load])

  const sets = state.sets ?? []
  const alreadySaved = sets.some((set) => accountSetKey(set.name) === accountSetKey(name))

  function choose(key: string) {
    setPicked(key)
    setWarning('')
    const set = sets.find(({ name }) => accountSetKey(name) === key)
    if (!set) return
    const availableIds = set.accountIds.filter((id) => available.has(id))
    if (!availableIds.length) {
      setWarning('Все счета из этого набора отсутствуют в текущем каталоге.')
      return
    }
    if (availableIds.length < set.accountIds.length) {
      setWarning(`Счетов из набора вне текущего каталога: ${set.accountIds.length - availableIds.length}.`)
    }
    onSelect(availableIds)
    setName(set.name)
  }

  return (
    <Panel aria-label="Сохранённые наборы счетов">
      <Bar>
        <Select size="s" aria-label="Сохранённые наборы" value={picked} disabled={!sets.length || state.pending}
          placeholder={sets.length ? 'Выбрать сохранённый набор' : 'Сохранённых наборов пока нет'}
          options={sets.map((set) => ({ value: accountSetKey(set.name), label: `${set.name} · ${set.accountIds.length}` }))}
          onChange={(e) => choose(e.target.value)} />
        <Form onSubmit={(e) => {
          e.preventDefault()
          save({ name: name.trim(), accountIds: selected })
        }}>
          <Input size="s" aria-label="Название набора" placeholder="Название набора" value={name}
            onChange={(e) => setName(e.target.value)} />
          <Button size="s" type="submit" disabled={state.pending || state.sets === null || !selected.length || !name.trim()}>
            {alreadySaved ? 'Обновить набор' : 'Сохранить набор'}
          </Button>
        </Form>
      </Bar>
      {state.pending && <span role="status">Выполняется операция с наборами…</span>}
      {state.error && <Bar>
        <span role="alert">{state.error}</span>
        {state.sets === null && <Button size="s" onClick={() => load()}>Повторить загрузку</Button>}
      </Bar>}
      {state.savedName && <span role="status">Набор «{state.savedName}» сохранён.</span>}
      {warning && <span role="status">{warning}</span>}
    </Panel>
  )
}
