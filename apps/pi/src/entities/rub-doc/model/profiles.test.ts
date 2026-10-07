import { RUB_TYPES } from './rubDoc'
import { ED107_GROUPS, RFIELDS, RUB_ACTIONS, RUB_OPERATION, RUB_PARTY, RUB_PROFILES, RUB_SECTIONS, RUB_TABS, rubSchemaOf } from './profiles'

describe('профили рубля (PROFILES/RSECTIONS стенда, index.html:689–738)', () => {
  it('у каждого типа — профиль с одной схемой: сводка, блоки, пять секций по порядку', () => {
    for (const t of RUB_TYPES) {
      const sc = rubSchemaOf({ type: t })
      expect(sc.hero).toEqual(['num', 'op', 'queue', 'sum'])
      expect(sc.blocks).toEqual(['scen', 'tx', 'party', 'purpose'])
      expect(sc.sections?.map((x) => x.id)).toEqual([...RUB_SECTIONS])
      expect(sc.grid).toBeUndefined()
    }
    expect(RUB_PROFILES.REQDOCRU.title).toBe('Инкассовое поручение')
  })
  it('у каждого реквизита сторон и секций есть подпись', () => {
    for (const k of RUB_PARTY) expect(RFIELDS[k]?.label, k).toBeTruthy()
    expect(RFIELDS.b104).toEqual({ no: '104', label: 'Код бюджетной классификации', mono: true })
  })
  it('вкладки: ED244 вместо «Исходного текста», без «Доп. полей»; действия — печать четырёх форм', () => {
    expect(RUB_TABS.map((t) => t.id)).toEqual(['main', 'statuses', 'compliance', 'linked', 'tasks', 'notif', 'ed244', 'stream', 'mpu', 'audit'])
    expect(RUB_ACTIONS.find((a) => a.id === 'down')?.label).toBe('Скачать сообщение ED (XML)')
    expect(RUB_ACTIONS.map((a) => a.id)).toEqual(['refresh', 'esid', 'down', 'print', 'link', 'ban'])
    expect(RUB_ACTIONS.find((a) => a.id === 'print')?.menu).toEqual([
      { label: 'Платёжное поручение', form: 'payment-order' }, { label: 'Инкассовое поручение', form: 'collection-order' },
      { label: 'Платёжный ордер', form: 'payment-ordr' }, { label: 'Мемориальный ордер', form: 'memorial-order' },
    ])
  })
  it('ED107: шесть подгрупп, узлы как на эталоне', () => {
    expect(ED107_GROUPS.map((g) => g.node)).toEqual(['OrderingBank', 'AcctWithInst', 'Beneficiary', 'PrevInstrAgent', 'InstructingAgent', 'InstructedAgent'])
  })
  it('коды операций как на эталоне: 01 и 06, у платёжного ордера кода нет (В-Д3)', () => {
    expect(RUB_OPERATION).toEqual({ PAYDOCRU: '01', REQDOCRU: '06', PAYORDRU: '' })
  })
})
