import { layoutXml, XML_LINE } from './xml'
import type { CodeLine } from './types'

// строка как текст — для компактных ожиданий; вид кусков проверяется отдельно
const text = (l: CodeLine) => l.tokens.map((t) => t.text).join('')
const shape = (lines: CodeLine[] | null) => (lines ?? []).map((l) => ({ depth: l.depth, align: l.align, text: text(l) }))

describe('layoutXml (эталон xmlHtml, XML_LINE=92)', () => {
  it('порог — 92 знака', () => {
    expect(XML_LINE).toBe(92)
  })

  it('вложенность — глубина строки; пустой элемент — самозакрывающийся; короткий текст — в строке тега', () => {
    expect(shape(layoutXml('<a><b x="1"/><c>t</c><d><e/></d></a>'))).toEqual([
      { depth: 0, align: undefined, text: '<a>' },
      { depth: 1, align: undefined, text: '<b x="1"/>' },
      { depth: 1, align: undefined, text: '<c>t</c>' },
      { depth: 1, align: undefined, text: '<d>' },
      { depth: 2, align: undefined, text: '<e/>' },
      { depth: 1, align: undefined, text: '</d>' },
      { depth: 0, align: undefined, text: '</a>' },
    ])
  })

  it('виды кусков: пунктуация, имя, префикс, атрибут, значение, текст', () => {
    const lines = layoutXml('<ed:ED244 xmlns:ed="urn:cbr-ru:ed:v2.0" EDNo="1"><ed:A>t</ed:A></ed:ED244>')!
    expect(lines[0]!.tokens).toEqual([
      { kind: 'xp', text: '<' }, { kind: 'xns', text: 'ed:' }, { kind: 'xt', text: 'ED244' },
      { kind: '', text: ' ' }, { kind: 'xans', text: 'xmlns:' }, { kind: 'xa', text: 'ed' }, { kind: 'xp', text: '="' }, { kind: 'xv', text: 'urn:cbr-ru:ed:v2.0' }, { kind: 'xp', text: '"' },
      { kind: '', text: ' ' }, { kind: 'xa', text: 'EDNo' }, { kind: 'xp', text: '="' }, { kind: 'xv', text: '1' }, { kind: 'xp', text: '"' },
      { kind: 'xp', text: '>' },
    ])
    expect(lines[1]!.tokens).toEqual([
      { kind: 'xp', text: '<' }, { kind: 'xns', text: 'ed:' }, { kind: 'xt', text: 'A' }, { kind: 'xp', text: '>' },
      { kind: 'xx', text: 't' },
      { kind: 'xp', text: '</' }, { kind: 'xns', text: 'ed:' }, { kind: 'xt', text: 'A' }, { kind: 'xp', text: '>' },
    ])
  })

  it('объявление <?xml?> — первой строкой с атрибутами', () => {
    const lines = layoutXml('<?xml version="1.0" encoding="UTF-8"?>\n<a/>')!
    expect(lines[0]!.tokens).toEqual([
      { kind: 'xp', text: '<?xml' },
      { kind: '', text: ' ' }, { kind: 'xa', text: 'version' }, { kind: 'xp', text: '="' }, { kind: 'xv', text: '1.0' }, { kind: 'xp', text: '"' },
      { kind: '', text: ' ' }, { kind: 'xa', text: 'encoding' }, { kind: 'xp', text: '="' }, { kind: 'xv', text: 'UTF-8' }, { kind: 'xp', text: '"' },
      { kind: 'xp', text: '?>' },
    ])
    expect(shape(lines).slice(1)).toEqual([{ depth: 0, align: undefined, text: '<a/>' }])
  })

  // «голова» тега: 2 × глубина + имя + 2 + Σ(имя атрибута + значение + 4); у <r a="…" b="…"/> на глубине 0 — 13 + |a| + |b|
  it('92 знака — атрибуты в строке тега', () => {
    const a = 'A'.repeat(40)
    const b = 'B'.repeat(39)
    expect(shape(layoutXml(`<r a="${a}" b="${b}"/>`))).toEqual([{ depth: 0, align: undefined, text: `<r a="${a}" b="${b}"/>` }])
  })

  it('93 знака — атрибуты столбиком, выравнивание под первым атрибутом (имя + 2 ch)', () => {
    const a = 'A'.repeat(40)
    const b = 'B'.repeat(40)
    expect(shape(layoutXml(`<r a="${a}" b="${b}"/>`))).toEqual([
      { depth: 0, align: undefined, text: `<r a="${a}"` },
      { depth: 0, align: 3, text: `b="${b}"/>` },
    ])
  })

  it('глубина входит в длину: тот же тег на глубине 1 уходит в столбик на 2 знака раньше', () => {
    const a = 'A'.repeat(40)
    const b = 'B'.repeat(38)
    expect(layoutXml(`<p><r a="${a}" b="${b}"/></p>`)).toHaveLength(4)
    expect(layoutXml(`<p><r a="${a}" b="${'B'.repeat(37)}"/></p>`)).toHaveLength(3)
  })

  it('длинный единственный текст — отдельной строкой глубже тега', () => {
    const long = 'Т'.repeat(90)
    expect(shape(layoutXml(`<a><Purp>${long}</Purp></a>`))).toEqual([
      { depth: 0, align: undefined, text: '<a>' },
      { depth: 1, align: undefined, text: '<Purp>' },
      { depth: 2, align: undefined, text: long },
      { depth: 1, align: undefined, text: '</Purp>' },
      { depth: 0, align: undefined, text: '</a>' },
    ])
  })

  it('смешанное содержимое: текст между элементами — своей строкой; комментарии и инструкции пропускаются; CDATA — текст', () => {
    expect(shape(layoutXml('<!-- до --><a>до<b/><!-- c --><?pi x?><![CDATA[1 < 2]]></a>'))).toEqual([
      { depth: 0, align: undefined, text: '<a>' },
      { depth: 1, align: undefined, text: 'до' },
      { depth: 1, align: undefined, text: '<b/>' },
      { depth: 1, align: undefined, text: '1 < 2' },
      { depth: 0, align: undefined, text: '</a>' },
    ])
  })

  it('значения атрибутов и текст — дословно, сущности раскрыты', () => {
    expect(shape(layoutXml('<a t="&lt;img src=x onerror=1&gt;">&amp;&lt;b&gt;</a>'))).toEqual([
      { depth: 0, align: undefined, text: '<a t="<img src=x onerror=1>">&<b></a>' },
    ])
  })

  it('битый XML и пустая строка — null', () => {
    expect(layoutXml('<a><b></a>')).toBeNull()
    expect(layoutXml('<a>')).toBeNull()
    expect(layoutXml('')).toBeNull()
    expect(layoutXml('{1:F01NRDIRUMMAXXX}')).toBeNull()
  })
})
