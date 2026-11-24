import { accountSetKey, type NzrAccountSetsPort, type SavedAccountSet } from '../../pages/nzr-report'

const key = 'katran-pi:nzr-account-sets'

function readSets(): SavedAccountSet[] {
  const raw = localStorage.getItem(key)
  if (raw === null) return []
  const data: unknown = JSON.parse(raw)
  if (!Array.isArray(data) || !data.every(isSavedSet)) throw new Error('Повреждены сохранённые наборы счетов НЗР')
  return data
}

function isSavedSet(value: unknown): value is SavedAccountSet {
  if (value === null || typeof value !== 'object') return false
  const { name, accountIds } = value as Partial<SavedAccountSet>
  return typeof name === 'string' && Array.isArray(accountIds) && accountIds.every((id) => typeof id === 'string')
}

export const demoNzrAccountSets: NzrAccountSetsPort = {
  list: readSets,
  save: (set) => {
    const sets = readSets()
    const index = sets.findIndex(({ name }) => accountSetKey(name) === accountSetKey(set.name))
    if (index < 0) sets.push(set)
    else sets[index] = set
    localStorage.setItem(key, JSON.stringify(sets))
    return sets
  },
}
