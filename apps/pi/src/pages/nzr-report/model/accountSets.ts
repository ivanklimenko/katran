import { attach, createEffect, createEvent, createStore, merge, sample } from 'effector'
import { lifecycle } from './workspace'

export type SavedAccountSet = { name: string; accountIds: string[] }

/** Операции выполняются от имени текущего оператора. save возвращает его список после записи. */
export type NzrAccountSetsPort = {
  list: () => SavedAccountSet[] | Promise<SavedAccountSet[]>
  save: (set: SavedAccountSet) => SavedAccountSet[] | Promise<SavedAccountSet[]>
}

export const accountSetKey = (name: string) => name.trim().toLocaleLowerCase('ru-RU')

const listFx = createEffect<void, SavedAccountSet[]>()
const saveFx = createEffect<SavedAccountSet, SavedAccountSet[]>()
export function configureNzrAccountSets(port: NzrAccountSetsPort) {
  listFx.use(port.list)
  saveFx.use(port.save)
}

export const accountSetsOpened = createEvent()
export const accountSetSaved = createEvent<SavedAccountSet>()

type Operation = { kind: 'list' } | { kind: 'save'; set: SavedAccountSet }
type Request = { visit: number; operation: Operation }
type State = {
  sets: SavedAccountSet[] | null
  pending: boolean
  error: string
  savedName: string
}

const initial: State = { sets: null, pending: false, error: '', savedName: '' }
const $visit = createStore(0).on(lifecycle.pageClosed, (n) => n + 1)
const requestFx = attach({
  effect: createEffect((operation: Operation) => operation.kind === 'list' ? listFx() : saveFx(operation.set)),
  mapParams: ({ operation }: Request) => operation,
})
const succeeded = sample({
  clock: requestFx.done,
  source: $visit,
  filter: (visit, { params }) => visit === params.visit,
  fn: (_, { params, result }) => ({ operation: params.operation, sets: result }),
})
const failed = sample({
  clock: requestFx.fail,
  source: $visit,
  filter: (visit, { params }) => visit === params.visit,
  fn: (_, { params }) => params.operation.kind,
})

export const $accountSets = createStore(initial)
  .on(requestFx, (state) => ({ ...state, pending: true, error: '', savedName: '' }))
  .on(succeeded, (_, { operation, sets }) => ({
    sets, pending: false, error: '', savedName: operation.kind === 'save' ? operation.set.name : '',
  }))
  .on(failed, (state, kind) => ({
    ...state, pending: false,
    error: kind === 'list' ? 'Не удалось загрузить сохранённые наборы.' : 'Не удалось сохранить набор. Повторите попытку.',
  }))
  .reset(lifecycle.pageClosed)

const operations = merge([
  accountSetsOpened.map((): Operation => ({ kind: 'list' })),
  accountSetSaved.map((set): Operation => ({ kind: 'save', set })),
])
sample({
  clock: operations,
  source: { state: $accountSets, open: lifecycle.$opened, visit: $visit },
  filter: ({ state, open }, operation) => open && !state.pending
    && (operation.kind === 'list' || (state.sets !== null && !!accountSetKey(operation.set.name) && operation.set.accountIds.length > 0)),
  fn: ({ visit }, operation): Request => ({ visit, operation }),
  target: requestFx,
})
