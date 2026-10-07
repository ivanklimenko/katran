import { useCallback } from 'react'
import { useUnit } from 'effector-react'
import type { LookupView } from '../../../shared/lib/detail'
import type { Lookup } from '../model/createLookup'

/**
 * Вид справочного запроса по документам (спека 2e §3.3): сущность получает LookupView своего документа, не зная о модели.
 * Записи нет — idle (поповер ещё не открывали или документ обновили).
 */
export function useLookupOf<T>(lookup: Lookup<T>): (docId: string) => LookupView<T> {
  const [data, load, retry, refresh] = useUnit([lookup.$data, lookup.load, lookup.retry, lookup.refresh])
  return useCallback((docId: string): LookupView<T> => {
    const e = data[docId]
    return {
      state: e?.state ?? 'idle',
      value: e?.value ?? null,
      error: e?.error ?? null,
      load: () => { load(docId) },
      retry: () => { retry(docId) },
      refresh: () => { refresh(docId) },
    }
  }, [data, load, retry, refresh])
}
