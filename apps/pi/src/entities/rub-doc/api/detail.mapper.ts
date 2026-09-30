import { arr, contractError, obj, str, strArr, type Obj } from '../../../shared/api'
import { parseTxs } from '../../posting/@x/rub-doc'
import type { RubDocDetail } from '../model/detail'
import { AGENT_KEYS, BUDGET_ROWS, COLLECT_KEYS, ED107_KEYS, PURPOSE_EXTRA_ROWS, RUB_PARTY } from '../model/profiles'
import { parseRubDoc } from './rubDoc.mapper'

/** Объект со строковыми реквизитами по списку ключей; пустой реквизит бек отдаёт ''. */
function strRecord<K extends string>(raw: unknown, keys: readonly K[], path: string): Record<K, string> {
  const o = obj(raw, path)
  const out = {} as Record<K, string>
  for (const k of keys) out[k] = str(o, k, path)
  return out
}

function strMap(raw: unknown, path: string): Record<string, string> {
  const o: Obj = obj(raw, path)
  const out: Record<string, string> = {}
  for (const k of Object.keys(o)) {
    const v = o[k]
    if (typeof v !== 'string') throw contractError(`${path}.${k}: ожидалась строка`)
    out[k] = v
  }
  return out
}

/** Ответ GET /grids/rub-docs/documents/{id} → RubDocDetail. Если бек называет поля иначе — правится только этот файл. */
export function parseRubDocDetail(raw: unknown, path: string): RubDocDetail {
  const o = obj(raw, path)
  const party = obj(o.party, `${path}.party`)
  const ed = obj(o.ed107, `${path}.ed107`)
  return {
    ...parseRubDoc(o, path),
    numDate: str(o, 'numDate', path),
    opCode: str(o, 'opCode', path),
    opName: str(o, 'opName', path),
    scenario: str(o, 'scenario', path),
    sysFrom: str(o, 'sysFrom', path),
    sysTo: str(o, 'sysTo', path),
    party: { s: strRecord(party.s, RUB_PARTY, `${path}.party.s`), r: strRecord(party.r, RUB_PARTY, `${path}.party.r`) },
    purposeExtra: strRecord(o.purposeExtra, PURPOSE_EXTRA_ROWS, `${path}.purposeExtra`),
    agents: arr(o.agents, `${path}.agents`).map((a, i) => strRecord(a, AGENT_KEYS, `${path}.agents[${i}]`)),
    budget: strRecord(o.budget, BUDGET_ROWS, `${path}.budget`),
    ed107: { ...strRecord(ed, ED107_KEYS, `${path}.ed107`), v: strMap(ed.v, `${path}.ed107.v`) },
    collect: strRecord(o.collect, COLLECT_KEYS, `${path}.collect`),
    txAt: str(o, 'txAt', path),
    txs: parseTxs(o.txs, `${path}.txs`),
    tabsOff: strArr(o.tabsOff, `${path}.tabsOff`),
  }
}
