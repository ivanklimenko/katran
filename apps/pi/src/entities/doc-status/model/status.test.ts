import { laneItems, STATUSES } from './status'

describe('laneItems', () => {
  it('до первого ответа фасетов — без чисел; после — пропущенный статус 0; порядок словаря; глиф', () => {
    expect(laneItems([], false).map((x) => x.count)).toEqual(STATUSES.map(() => undefined))
    const items = laneItems([{ value: 'ERROR', count: 3 }], true)
    expect(items.map((x) => x.value)).toEqual([...STATUSES])
    expect(items.find((x) => x.value === 'ERROR')?.count).toBe(3)
    expect(items.find((x) => x.value === 'DONE')?.count).toBe(0)
    expect(items[0]).toMatchObject({ value: 'IN_PROGRESS', label: 'В работе', tone: 'flow', glyph: '·' })
  })
})
