import { css, styled } from '../styled'
import { k } from '@katran/tokens'

/**
 * Части поля ввода кита — общие для Input, Select и составных полей (дата, период, выбор, теги).
 * Модификаторы — атрибутами под :where() (специфичность прежних классов (0,1,0)): размер — data-size="s|m|l",
 * ошибка — data-invalid. Составные поля дополняют части через styled(Часть): группа расширения стоит в листе позже
 * и при равной специфичности перебивает правила части — как прежде модуль поля шёл в бандле после Input.module.css.
 */
export const FieldBox = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp1};
  padding: 0 ${k.sp2};
  border: 1px solid ${k.line};
  border-radius: ${k.rM};
  background: ${k.paper};
  color: ${k.ink};
  transition: border-color ${k.tFast};

  &:where([data-invalid]) {
    border-color: ${k.bad};
  }

  &:where([data-size='s']) {
    height: ${k.hCtlS};
    font-size: ${k.fs2};
  }

  &:where([data-size='m']) {
    height: ${k.hCtlM};
    font-size: ${k.fs1};
  }

  &:where([data-size='l']) {
    height: ${k.hCtlL};
    font-size: ${k.fs1};
  }

  &:focus-within {
    border-color: ${k.val};
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }

  &:where([data-invalid]):focus-within {
    border-color: ${k.bad};
    outline-color: ${k.bad};
  }
`

export const Prefix = styled.span`
  display: inline-grid;
  place-items: center;
  color: ${k.muted};

  & > svg {
    width: ${k.iconS};
    height: ${k.iconS};
  }
`

/** Строка ввода и список внутри рамки поля: без своей рамки и фона, типографика рамки. */
const control = css`
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  font: inherit;
  color: inherit;
  height: 100%;
`

/** Правила строки ввода поля — для своих полей на input (маска даты): styled(Поле)`${fieldInput}`. */
export const fieldInput = css`
  ${control}

  &::placeholder {
    color: ${k.faint};
  }
`

export const FieldInput = styled.input`
  ${fieldInput}
`

export const FieldSelect = styled.select`
  ${control}

  cursor: pointer;
  padding-right: ${k.sp1};
`
