import { FX_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseFxDocDetail } from '../api/detail.mapper'
import type { FxDocDetail } from './detail'
import { FX_CONFIRM_TARGETS, fxEditRule, fxEditableTargets, normalizeFxEdit, swiftFieldInvalid, validateFxEdit, validateRefOut, validateSwiftField } from './rules'
import { FX_FIELDS } from './swift'

const f57 = FX_FIELDS['57']!, f50 = FX_FIELDS['50']!
const X = "недопустимые символы (только латиница, цифры и / - ? : ( ) . , ' +)"

describe('правила SWIFT X (validate() эталона, index.html:1480–1489)', () => {
  it('строка длиннее W — «Строка k: n символов, максимум W» раньше ошибки набора', () => {
    expect(validateSwiftField(f57, { lines: ['A', 'Ж'.repeat(36)] })).toBe('Строка 2: 36 символов, максимум 35')
  })

  it('кириллица, ß и «С» кириллическая — ошибка набора с номером строки; строчные латинские допустимы', () => {
    // Review Focus 5
    expect(validateSwiftField(f57, { lines: ['ПРИВЕТ'] })).toBe(`Строка 1: ${X}`)
    expect(validateSwiftField(f57, { lines: ['OK', 'STRASSE ß'] })).toBe(`Строка 2: ${X}`)
    expect(validateSwiftField(f57, { lines: ['BANK С'] })).toBe(`Строка 1: ${X}`)
    expect(validateSwiftField(f57, { lines: ["abc /-?:().,'+ 09"] })).toBeNull()
  })

  it('счёт стороны: до 34, только латиница и цифры', () => {
    expect(validateSwiftField(f50, { acc: '40817 840', lines: [] })).toBe('Счёт: до 34 символов, только латиница и цифры')
    expect(validateSwiftField(f50, { acc: 'A'.repeat(35), lines: [] })).toBe('Счёт: до 34 символов, только латиница и цифры')
    expect(validateSwiftField(f50, { acc: 'GB29NWBK60161331926819', lines: ['IVANOV'] })).toBeNull()
  })

  it('всего больше N·W — «Всего n символов, максимум N·W» (строк больше N, например с бека); ошибка строки — раньше', () => {
    // Ruling S3: ветка достижима, только когда строк больше N
    const five = new Array<string>(5).fill('A'.repeat(35))
    expect(validateSwiftField(f57, { lines: five })).toBe('Всего 175 символов, максимум 140')
    expect(validateSwiftField(f57, { lines: [...five, 'Ж'] })).toBe(`Строка 6: ${X}`)
    expect(validateSwiftField(FX_FIELDS['72']!, { lines: new Array<string>(6).fill('A'.repeat(35)) })).toBeNull()
  })

  it('20 исх: пусто, «/» в начале и конце, «//», кириллица; 16 знаков', () => {
    const BAD = 'Недопустимый референс: латиница, цифры, / - ? : ( ) . , \' + ; не начинать и не заканчивать «/»'
    expect(validateRefOut('  ')).toBe('Референс не может быть пустым')
    expect(['/ABC', 'ABC/', 'A//B', 'РЕФ', 'A'.repeat(17)].map(validateRefOut)).toEqual([BAD, BAD, BAD, BAD, BAD])
    expect(validateRefOut(' fx2609220000417 ')).toBeNull()
  })

  it('swiftFieldInvalid: виноватые строки (длина или набор) и счёт; «Всего n…» строк не называет (Д64)', () => {
    expect(swiftFieldInvalid(f57, { lines: ['OK', 'ПРИВЕТ', 'A'.repeat(36), 'ok'] })).toEqual({ lines: [1, 2], acc: false })
    expect(swiftFieldInvalid(f50, { acc: '40817 840', lines: ['IVANOV'] })).toEqual({ lines: [], acc: true })
    expect(swiftFieldInvalid(f57, { lines: new Array<string>(5).fill('A'.repeat(35)) })).toEqual({ lines: [], acc: false })
  })

  it('validateFxEdit: поля — по FX_FIELDS базы тега (B.57 как 57); 20 исх; счета — null (список держат SuggestInput и бек)', () => {
    expect(validateFxEdit('field:B.57', { lines: ['ПРИВЕТ'] })).toBe(`Строка 1: ${X}`)
    expect(validateFxEdit('field:70', { lines: ['A'.repeat(36)] })).toBe('Строка 1: 36 символов, максимум 35')
    expect(validateFxEdit('refOut', '')).toBe('Референс не может быть пустым')
    expect(validateFxEdit('accKt', '123')).toBeNull()
    expect(validateFxEdit('valueDate', '2026-09-24')).toBeNull()
    expect(validateFxEdit('valueDate', '24.09.2026')).toBe('Дата валютирования — в формате ГГГГ-ММ-ДД')
  })

  it('normalizeFxEdit: поля — trim+upper, хвостовые пустые прочь, внутренние пустые остаются, acc trim без upper, пустые opt/acc — без ключа', () => {
    expect(normalizeFxEdit('field:57', { opt: '', acc: ' iban1 ', lines: [' bank ', '', ' x ', '', ' '] })).toEqual({ acc: 'iban1', lines: ['BANK', '', 'X'] })
    expect(normalizeFxEdit('field:57', { opt: 'A', acc: '  ', lines: ['a'] })).toEqual({ opt: 'A', lines: ['A'] })
    expect(normalizeFxEdit('refOut', ' fx1 ')).toBe('FX1')
    expect(normalizeFxEdit('accKt', '40817 840-1')).toBe('408178401')
    expect(normalizeFxEdit('valueDate', '2026-09-24')).toBe('2026-09-24')
  })

  it('fxEditRule', () => {
    expect(fxEditRule(f50)).toBe('4 строк по 35 символов, набор SWIFT X, счёт до 34')
    expect(fxEditRule(FX_FIELDS['72']!)).toBe('6 строк по 35 символов, набор SWIFT X')
    expect(FX_CONFIRM_TARGETS).toEqual(['valueDate'])
  })
})

describe('fxEditableTargets — правимое по профилю (спека 2c §1.1)', () => {
  const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
  const of = (patch: Partial<FxDocDetail>) => new Set(fxEditableTargets({ ...d, ...patch }))
  const fields = (...tags: string[]) => tags.map((t) => `field:${t}`)
  const tail = ['refOut', 'accDt', 'accKt']

  it('MT103: 50, 52, 56 (заполнено), 57, 59, 70, 72 + 20 исх, Дт, Кт, дата валютирования', () => {
    expect(of({})).toEqual(new Set([...fields('50', '52', '56', '57', '59', '70', '72'), ...tail, 'valueDate']))
  })

  it('MT103 с пустым 56 — без 56 (hideIfEmpty, Ruling S5); пустое 56 с правками — правится', () => {
    const empty56 = { ...d.fields, '56': { lines: [] } }
    expect(of({ fields: empty56 }).has('field:56')).toBe(false)
    const hist = d.edits['field:57']!.hist
    expect(of({ fields: empty56, edits: { 'field:56': { now: { lines: [] }, hist } } }).has('field:56')).toBe(true)
  })

  it('MT202: 52, 56, 57, 72; MT202COV — то же и B.*; MT199 — без полей и без даты', () => {
    expect(of({ type: 'MT202' })).toEqual(new Set([...fields('52', '56', '57', '72'), ...tail, 'valueDate']))
    const cov = { ...d.fields, 'B.50': d.fields['50']!, 'B.56': d.fields['56']! }
    expect(of({ type: 'MT202COV', fields: cov })).toEqual(new Set([
      ...fields('52', '56', '57', '72', 'B.50', 'B.56', 'B.52', 'B.57', 'B.59', 'B.70', 'B.72'), ...tail, 'valueDate',
    ]))
    expect(of({ type: 'MT199' })).toEqual(new Set(tail))
  })

  it('заблокированный документ — только просмотр: целей нет, бек отклоняет любую правку (Д66)', () => {
    expect(of({ lock: { who: 'Иванова М. П.', since: '2026-09-23T09:00:00' } })).toEqual(new Set())
  })
})
