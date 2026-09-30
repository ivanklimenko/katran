import type { FieldRef, FormPart } from '@katran/ui'
import { FX_TYPES } from './fxDoc'
import { FX_ACTIONS, FX_DETAIL_TITLE, FX_FIELDS, FX_PROFILES, FX_TABS, fxSchemaOf, swiftPresent } from './swift'

const tagsOf = (p: FormPart): string[] => [
  ...(p.grid ?? []).flatMap((row) => row.filter((r): r is FieldRef => r !== null)),
  ...(p.text ?? []), ...(p.extra ?? []),
].map((r) => (typeof r === 'string' ? r : r.tag).replace(/^B\./, ''))

describe('профили MT (PROFILES стенда)', () => {
  it('у каждого типа реестра есть профиль; все теги схем — в реестре полей', () => {
    for (const t of FX_TYPES) {
      const { schema } = FX_PROFILES[t]
      for (const tag of [...tagsOf(schema), ...(schema.seqB ? tagsOf(schema.seqB) : [])]) expect(FX_FIELDS[tag], `${t}: ${tag}`).toBeDefined()
    }
  })
  it('последовательность B — только у MT202COV; у MT199 нет сетки', () => {
    expect(FX_TYPES.filter((t) => FX_PROFILES[t].schema.seqB)).toEqual(['MT202COV'])
    expect(fxSchemaOf({ type: 'MT199' }).grid).toEqual([])
    expect(fxSchemaOf({ type: 'MT103' }).hero).toEqual(['20', '71A', 'vd', '32A'])
  })
  it('вкладки и действия — порядок эталона', () => {
    expect(FX_TABS.map((t) => t.id)).toEqual(['main', 'extra', 'statuses', 'compliance', 'linked', 'tasks', 'notif', 'source', 'stream', 'mpu', 'audit'])
    expect(FX_ACTIONS.map((a) => a.id)).toEqual(['refresh', 'edit', 'esid', 'down', 'print', 'link', 'ban'])
    expect(FX_ACTIONS[FX_ACTIONS.length - 1]).toMatchObject({ label: 'Аннулировать', danger: true })
    expect(FX_ACTIONS.find((a) => a.id === 'print')?.menu).toHaveLength(3)
  })
  it('заголовок — как на эталоне (В-Д1, index.html:1369)', () => {
    expect(FX_DETAIL_TITLE).toBe('Платёжная инструкция ВАЛЮТА')
  })
})

describe('swiftPresent (эталон cell/full)', () => {
  it('сторона: первая строка и счёт, полный текст — счёт и нумерованные строки', () => {
    expect(swiftPresent('50', { opt: 'F', acc: '40817840500010042371', lines: ['LAVRENTIEV DMITRY OLEGOVICH', 'RU/ MOSCOW, 117279'] })).toEqual({
      main: 'LAVRENTIEV DMITRY OLEGOVICH', second: '40817840500010042371',
      full: ['/40817840500010042371', '1/ LAVRENTIEV DMITRY OLEGOVICH', '2/ RU/ MOSCOW, 117279'],
    })
  })
  it('банк: наименование и BIC последней строкой', () => {
    expect(swiftPresent('57', { opt: 'A', lines: ['VOSTOCHNY KREDIT BANK KHABAROVSK BR', 'VKRBRU8KXXX'] })).toMatchObject({ main: 'VOSTOCHNY KREDIT BANK KHABAROVSK BR', second: 'VKRBRU8KXXX' })
  })
  it('одиночный BIC — только справа', () => {
    expect(swiftPresent('53', { opt: 'A', lines: ['BCLHLV22XXX'] })).toMatchObject({ main: '', second: 'BCLHLV22XXX' })
  })
})
