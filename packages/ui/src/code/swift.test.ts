import { tokenizeSwift } from './swift'

const UETR = '3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b'

describe('tokenizeSwift (эталон swiftHtml)', () => {
  it('заголовки блоков, UETR в {121:}, теги полей в начале строки', () => {
    const src = `{1:F01NRDIRUMMAXXX0000000000}{2:I103VKRBRU8KXXXXN}{3:{121:${UETR}}}{4:\n:20:FX2609220000417\n:32A:260922USD1250000,00\n-}{S:{CHK:1A2B}}`
    expect(tokenizeSwift(src)).toEqual([
      { kind: 'blk', text: '{1:' }, { kind: '', text: 'F01NRDIRUMMAXXX0000000000}' },
      { kind: 'blk', text: '{2:' }, { kind: '', text: 'I103VKRBRU8KXXXXN}' },
      { kind: 'blk', text: '{3:' }, { kind: '', text: '{121:' }, { kind: 'uetr', text: UETR }, { kind: '', text: '}}' },
      { kind: 'blk', text: '{4:' }, { kind: '', text: '\n' },
      { kind: 'tag', text: ':20:' }, { kind: '', text: 'FX2609220000417\n' },
      { kind: 'tag', text: ':32A:' }, { kind: '', text: '260922USD1250000,00\n-}' },
      { kind: 'blk', text: '{S:' }, { kind: '', text: '{CHK:1A2B}}' },
    ])
  })

  it('тег не в начале строки и UETR не той формы не подсвечиваются', () => {
    expect(tokenizeSwift('X :20:ABC\n{121:NOT-A-UETR}')).toEqual([{ kind: '', text: 'X :20:ABC\n{121:NOT-A-UETR}' }])
  })

  it('буква опции — одна заглавная: :50K: — тег, :50KX: — нет', () => {
    expect(tokenizeSwift(':50K:/40817\n:50KX:y').map((t) => [t.kind, t.text])).toEqual([['tag', ':50K:'], ['', '/40817\n:50KX:y']])
  })

  it('пустой текст — пустой список', () => {
    expect(tokenizeSwift('')).toEqual([])
  })
})
