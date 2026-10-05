import { tokenizeJson } from './json'

describe('tokenizeJson (эталон jsonHtml)', () => {
  it('ключи, строки, числа, литералы и пунктуация; пробелы и переводы строк — без подсветки', () => {
    const src = JSON.stringify({ id: 'FX1', n: -1.5, e: 2e-7, ok: true, z: null, arr: [1, 'a'] }, null, 2)
    expect(tokenizeJson(src)).toEqual([
      { kind: 'punct', text: '{' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"id"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'str', text: '"FX1"' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"n"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'num', text: '-1.5' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"e"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'num', text: '2e-7' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"ok"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'lit', text: 'true' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"z"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'lit', text: 'null' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n  ' },
      { kind: 'key', text: '"arr"' }, { kind: 'punct', text: ':' }, { kind: '', text: ' ' }, { kind: 'punct', text: '[' }, { kind: '', text: '\n    ' },
      { kind: 'num', text: '1' }, { kind: 'punct', text: ',' }, { kind: '', text: '\n    ' }, { kind: 'str', text: '"a"' }, { kind: '', text: '\n  ' },
      { kind: 'punct', text: ']' }, { kind: '', text: '\n' }, { kind: 'punct', text: '}' },
    ])
  })

  it('экранированные кавычки и двоеточие внутри строки не путают ключ и значение', () => {
    expect(tokenizeJson('{"a\\"b":"x: \\"y\\""}')).toEqual([
      { kind: 'punct', text: '{' }, { kind: 'key', text: '"a\\"b"' }, { kind: 'punct', text: ':' }, { kind: 'str', text: '"x: \\"y\\""' }, { kind: 'punct', text: '}' },
    ])
  })

  it('число в строке и true в ключе — строки, а не число и литерал', () => {
    expect(tokenizeJson('{"true":"42"}').map((t) => t.kind)).toEqual(['punct', 'key', 'punct', 'str', 'punct'])
  })

  it('не JSON — один кусок без подсветки', () => {
    expect(tokenizeJson('{id: 1,}')).toEqual([{ kind: '', text: '{id: 1,}' }])
    expect(tokenizeJson('')).toEqual([{ kind: '', text: '' }])
  })

  it('текст сохраняется дословно: склейка кусков равна исходнику', () => {
    const src = JSON.stringify({ a: { b: [true, false, null, 0, -0.25, 'с кириллицей'] } }, null, 2)
    expect(tokenizeJson(src).map((t) => t.text).join('')).toBe(src)
  })
})
