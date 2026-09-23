import { resolveSpans, visibleColumns } from './resolveSpans'
import type { ColumnDef, SpanDef } from './types'

const span = (id: string, from: string, to: string): SpanDef<unknown> => ({ id, from, to, render: () => null })
const col = (id: string): ColumnDef<unknown> => ({ id, render: () => null })

describe('resolveSpans', () => {
  const order = ['status', 'id', 'date', 'type', 'dir', 'f50', 'f52', 'f57', 'f59']

  it('сегмент по id колонок → индекс и ширина по видимому порядку', () => {
    expect(resolveSpans([span('reason', 'status', 'id'), span('purpose', 'f50', 'f59')], order)).toEqual([
      { id: 'reason', colStart: 0, colSpan: 2 },
      { id: 'purpose', colStart: 5, colSpan: 4 },
    ])
  })
  it('часть колонок диапазона скрыта → сегмент сжимается', () => {
    const visible = order.filter((c) => c !== 'f52' && c !== 'f57')
    expect(resolveSpans([span('purpose', 'f50', 'f59')], visible, order)).toEqual([{ id: 'purpose', colStart: 5, colSpan: 2 }])
  })
  it('все колонки диапазона скрыты → сегмента нет', () => {
    const visible = order.filter((c) => !['f50', 'f52', 'f57', 'f59'].includes(c))
    expect(resolveSpans([span('purpose', 'f50', 'f59')], visible, order)).toEqual([])
  })
  it('крайняя колонка скрыта → ближайшая видимая внутри диапазона', () => {
    const visible = order.filter((c) => c !== 'f59')
    expect(resolveSpans([span('purpose', 'f50', 'f59')], visible, order)).toEqual([{ id: 'purpose', colStart: 5, colSpan: 3 }])
  })
  it('пользовательский порядок: to левее from → границы нормализуются, накрывается всё между', () => {
    const reordered = ['status', 'f59', 'type', 'f50', 'id']
    expect(resolveSpans([span('purpose', 'f50', 'f59')], reordered)).toEqual([{ id: 'purpose', colStart: 1, colSpan: 3 }])
  })
  it('сегменты одной строки отсортированы по colStart', () => {
    const r = resolveSpans([span('b', 'f50', 'f59'), span('a', 'status', 'id')], order)
    expect(r.map((x) => x.id)).toEqual(['a', 'b'])
  })
})

describe('visibleColumns', () => {
  it('порядок из order, скрытые исключены, неизвестные id в order игнорируются', () => {
    const cols = [col('a'), col('b'), col('c')]
    expect(visibleColumns(['c', 'zzz', 'a', 'b'], ['a'], cols).map((c) => c.id)).toEqual(['c', 'b'])
  })
  it('колонки, которых нет в order, идут в конец в исходном порядке', () => {
    const cols = [col('a'), col('b'), col('c')]
    expect(visibleColumns(['b'], [], cols).map((c) => c.id)).toEqual(['b', 'a', 'c'])
  })
})
