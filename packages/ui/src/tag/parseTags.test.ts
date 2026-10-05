import { hasSeparator, mergeTags, splitTags, TAG_LIMIT, takeTags } from './parseTags'

describe('splitTags', () => {
  it('values: переносы, ; , пробелы, табуляция — колонка и строка из Excel', () => {
    expect(splitTags('400\n403\r\n406', 'values')).toEqual(['400', '403', '406'])
    expect(splitTags('A1 B2,C3;D4\tE5', 'values')).toEqual(['A1', 'B2', 'C3', 'D4', 'E5'])
    expect(splitTags(' ;, ', 'values')).toEqual([])
  })
  it('values: колонка из Excel с переводом строки в конце, пустыми ячейками и неразрывным пробелом', () => {
    expect(splitTags('400\r\n\r\n403\r\n406\r\n', 'values')).toEqual(['400', '403', '406'])
    expect(splitTags('400\t\t403\t406\r\n407\t408\t409\r\n', 'values')).toEqual(['400', '403', '406', '407', '408', '409'])
    expect(splitTags('  400 403 ', 'values')).toEqual(['400', '403'])
    expect(splitTags('', 'values')).toEqual([])
  })
  it('phrases: кавычки обоих видов, ; и перенос — разделители, запятая и пробел — часть фразы', () => {
    expect(splitTags('"счёт не найден" "инструкция инвалидна"', 'phrases')).toEqual(['счёт не найден', 'инструкция инвалидна'])
    expect(splitTags('«нет покрытия»; лимит превышен', 'phrases')).toEqual(['нет покрытия', 'лимит превышен'])
    expect(splitTags('Оплата, НДС 20 %', 'phrases')).toEqual(['Оплата, НДС 20 %'])
    expect(splitTags('a\nb', 'phrases')).toEqual(['a', 'b'])
    expect(splitTags('"незакрытая фраза', 'phrases')).toEqual(['незакрытая фраза'])
    expect(splitTags('до "в кавычках" после', 'phrases')).toEqual(['до "в кавычках" после'])
  })
  it('phrases: колонка и строка из Excel — фраза на ячейку; ; и перенос внутри кавычек — часть фразы', () => {
    expect(splitTags('счёт не найден\r\nинструкция инвалидна\r\n', 'phrases')).toEqual(['счёт не найден', 'инструкция инвалидна'])
    expect(splitTags('нет покрытия\tлимит превышен', 'phrases')).toEqual(['нет покрытия', 'лимит превышен'])
    expect(splitTags('"a; b" c', 'phrases')).toEqual(['"a; b" c'])
    expect(splitTags('«первая\nвторая»', 'phrases')).toEqual(['первая\nвторая'])
  })
  it('phrases: кавычки делят только цепочку фраз в кавычках через пробел; иначе сегмент — одна фраза с кавычками', () => {
    expect(splitTags('ООО «Ромашка»', 'phrases')).toEqual(['ООО «Ромашка»'])
    expect(splitTags('«a» «b»', 'phrases')).toEqual(['a', 'b'])
    expect(splitTags('«a»  "b"\t«c»', 'phrases')).toEqual(['a', 'b', 'c'])
    expect(splitTags('"a""b"', 'phrases')).toEqual(['"a""b"'])
    expect(splitTags('«a» b', 'phrases')).toEqual(['«a» b'])
    expect(splitTags('«a"', 'phrases')).toEqual(['a"'])
    expect(splitTags('ООО «Ромашка»; ЗАО «Василёк»', 'phrases')).toEqual(['ООО «Ромашка»', 'ЗАО «Василёк»'])
    expect(splitTags('"a" "b', 'phrases')).toEqual(['a', 'b'])
  })
  it('phrases: пустые кавычки и лишние разделители отбрасываются; кавычка другого вида внутри — часть фразы', () => {
    expect(splitTags('"" ; «  » ;;', 'phrases')).toEqual([])
    expect(splitTags('«ООО "Ромашка"»', 'phrases')).toEqual(['ООО "Ромашка"'])
    expect(splitTags('"незакрытая «ёлочка"', 'phrases')).toEqual(['незакрытая «ёлочка'])
    expect(splitTags('лишняя» кавычка', 'phrases')).toEqual(['лишняя» кавычка'])
  })
})

describe('takeTags', () => {
  it('values: готовые чипы до последнего разделителя, хвост остаётся текстом', () => {
    expect(takeTags('123 45', 'values')).toEqual({ tags: ['123'], rest: '45' })
    expect(takeTags('123,', 'values')).toEqual({ tags: ['123'], rest: '' })
    expect(takeTags('123', 'values')).toEqual({ tags: [], rest: '123' })
    expect(takeTags(' ', 'values')).toEqual({ tags: [], rest: '' })
    expect(takeTags('1;2;3', 'values')).toEqual({ tags: ['1', '2'], rest: '3' })
  })
  it('phrases: ; делит, открытая кавычка — ещё не делит', () => {
    expect(takeTags('abc; de', 'phrases')).toEqual({ tags: ['abc'], rest: 'de' })
    expect(takeTags('"a; b', 'phrases')).toEqual({ tags: [], rest: '"a; b' })
    expect(takeTags('abc de', 'phrases')).toEqual({ tags: [], rest: 'abc de' })
  })
  it('phrases: кавычка посреди сегмента ; не держит', () => {
    expect(takeTags('ООО «Ромашка; x', 'phrases')).toEqual({ tags: ['ООО «Ромашка'], rest: 'x' })
    expect(takeTags('ООО «Ромашка»', 'phrases')).toEqual({ tags: [], rest: 'ООО «Ромашка»' })
    expect(takeTags('a; "b; c', 'phrases')).toEqual({ tags: ['a'], rest: '"b; c' })
  })
  it('phrases: закрытая кавычка — ; после неё делит; ; внутри кавычек цепочки — нет', () => {
    expect(takeTags('"a; b"; c', 'phrases')).toEqual({ tags: ['a; b'], rest: 'c' })
    expect(takeTags('«a; b', 'phrases')).toEqual({ tags: [], rest: '«a; b' })
    expect(takeTags('"a" «b;', 'phrases')).toEqual({ tags: [], rest: '"a" «b;' })
  })
})

describe('hasSeparator', () => {
  it('по режиму: у values — пробел, запятая, ;, перенос, табуляция; у phrases — ;, перенос, табуляция или цепочка фраз в кавычках', () => {
    expect(hasSeparator('400 403', 'values')).toBe(true)
    expect(hasSeparator('400', 'values')).toBe(false)
    expect(hasSeparator('Оплата, НДС', 'phrases')).toBe(false)
    expect(hasSeparator('a\nb', 'phrases')).toBe(true)
    expect(hasSeparator('«a» «b»', 'phrases')).toBe(true)
    expect(hasSeparator('«a»', 'phrases')).toBe(false)
    expect(hasSeparator('ООО «Ромашка»', 'phrases')).toBe(false)
  })
})

describe('mergeTags', () => {
  it('повторы: values — точное совпадение, phrases — без учёта регистра', () => {
    expect(mergeTags(['A'], ['a', 'A'], 'values', 500)).toEqual({ value: ['A', 'a'], added: 1, dropped: 0 })
    expect(mergeTags(['Ошибка'], ['ошибка', 'Отказ'], 'phrases', 20)).toEqual({ value: ['Ошибка', 'Отказ'], added: 1, dropped: 0 })
  })
  it('повторы внутри добавляемого не множатся', () => {
    expect(mergeTags([], ['1', '2', '1', '2'], 'values', 500)).toEqual({ value: ['1', '2'], added: 2, dropped: 0 })
    expect(mergeTags([], ['Отказ', 'ОТКАЗ'], 'phrases', 20)).toEqual({ value: ['Отказ'], added: 1, dropped: 0 })
  })
  it('предел: лишние не добавляются и считаются; повторы в лишние не входят', () => {
    expect(mergeTags(['1'], ['2', '3', '4'], 'values', 3)).toEqual({ value: ['1', '2', '3'], added: 2, dropped: 1 })
    expect(mergeTags(['1', '2'], ['1', '3', '3', '4'], 'values', 2)).toEqual({ value: ['1', '2'], added: 0, dropped: 2 })
  })
  it('текущее значение не меняется', () => {
    const cur = ['1']
    mergeTags(cur, ['2'], 'values', 500)
    expect(cur).toEqual(['1'])
  })
  it('пределы по умолчанию: IN контракта — 500, фраз — 20', () => {
    expect(TAG_LIMIT).toEqual({ values: 500, phrases: 20 })
    const many = Array.from({ length: 732 }, (_, i) => String(i))
    expect(mergeTags([], many, 'values', TAG_LIMIT.values)).toMatchObject({ added: 500, dropped: 232 })
  })
})
