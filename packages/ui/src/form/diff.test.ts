import { diffFieldValues, diffText, editCountLabel } from './diff'

describe('diff', () => {
  it('diffFieldValues: опция, счёт, строки по номеру; равные — []', () => {
    expect(diffFieldValues({ opt: 'A', lines: ['BANK', 'VKRBRU8KXXX'] }, { opt: 'D', acc: '123', lines: ['BANK', 'VKRBRU8K2KD', 'X'] })).toEqual([
      { label: 'опция', was: 'A', now: 'D' }, { label: 'счёт', was: '', now: '123' },
      { label: '2/', was: 'VKRBRU8KXXX', now: 'VKRBRU8K2KD' }, { label: '3/', was: '', now: 'X' },
    ])
    expect(diffFieldValues({ lines: ['A'] }, { lines: ['A'] })).toEqual([])
  })
  it('diffText', () => {
    expect(diffText('A', 'B')).toEqual([{ label: '', was: 'A', now: 'B' }])
    expect(diffText('A', 'A')).toEqual([])
  })
  it('editCountLabel — русское склонение', () => {
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map(editCountLabel)).toEqual(
      ['1 изменение', '2 изменения', '4 изменения', '5 изменений', '11 изменений', '12 изменений', '21 изменение', '22 изменения', '25 изменений'])
  })
})
