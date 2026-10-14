import { pickStyled, styled } from './styled'

// Поддельная функция styled с фабрикой элемента: как у styled-components (styled('div') и styled.div).
const fakeStyled = Object.assign(() => 'styled()', { div: () => 'styled.div' })

describe('pickStyled — функция styled при любой форме модуля styled-components', () => {
  it.each([
    ['модуль — сама функция', fakeStyled],
    ['функция в default (ESM, бандлеры)', { default: fakeStyled, css: (): string => '' }],
    ['функция в default.default (импорт CJS из ESM в Node)', { default: { default: fakeStyled, css: (): string => '' }, css: (): string => '' }],
  ])('%s', (_name, mod) => {
    const picked = pickStyled<typeof fakeStyled>(mod)
    expect(picked).toBe(fakeStyled)
    expect(typeof picked.div).toBe('function')
  })

  it('функции нет ни в одной форме — понятная ошибка', () => {
    expect(() => pickStyled({ default: { default: {} } })).toThrow(/styled-components/)
  })

  it('экспорт модуля кита — настоящая функция styled', () => {
    expect(typeof styled).toBe('function')
    expect(typeof styled.div).toBe('function')
  })
})
