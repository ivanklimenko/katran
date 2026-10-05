import { remoteTab } from './remoteTab'
import type { TabContext } from './types'

const ctx: TabContext = { docId: 'doc-1', openDocument: vi.fn(), announce: vi.fn(), expanded: null, setExpanded: vi.fn() }

describe('remoteTab', () => {
  it('вид удалённой вкладки: kind remote, render получает данные и контекст как есть', () => {
    const seen: unknown[] = []
    const view = remoteTab<{ n: number }[]>({ render: (data, c) => { seen.push(data, c); return `строк: ${data.length}` } })
    expect(view.kind).toBe('remote')
    expect(view.render([{ n: 1 }, { n: 2 }], ctx)).toBe('строк: 2')
    expect(seen).toEqual([[{ n: 1 }, { n: 2 }], ctx])
    expect((seen[1] as TabContext).docId).toBe('doc-1')
    expect('skeletonRows' in view).toBe(false)
  })
  it('skeletonRows — только если задан (у «Задач» — 5)', () => {
    expect(remoteTab({ render: () => null, skeletonRows: 5 }).skeletonRows).toBe(5)
  })
})
