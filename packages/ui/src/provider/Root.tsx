import styled from 'styled-components'
import { declarations, k } from '@katran/tokens'

/**
 * Корень KatranProvider: объявляет все --k-*, типографику корня и стили живой области.
 * Изоляция от стилей хоста (content-box, типографика контролов) пока — в Provider.module.css, причина там.
 *
 * Переменные объявляются только здесь, не на :root (спека styled §4.4): кит не трогает документ хоста.
 * Размеры — тоже здесь: var(--k-density) в custom property резолвится там, где объявлена, а плотность
 * провайдера стоит инлайном на этом же элементе (STATE §8).
 *
 * Порядок групп styled-components — порядок определения компонентов: этот модуль импортируется раньше
 * модулей компонентов кита, поэтому правила корня стоят в листе раньше их правил и при равной
 * специфичности (0,1,0) проигрывают им.
 */
export const Root = styled.div`
  ${declarations.base}
  ${declarations.sizes}

  /* Светлые цвета — и на корне, и по явному атрибуту на нём или на потомке: при системной тёмной теме
     поддерево с [data-theme='light'] иначе осталось бы без светлой палитры (страница токенов демо) */
  &,
  &[data-theme='light'],
  & [data-theme='light'] {
    ${declarations.light}
  }

  &[data-theme='dark'],
  & [data-theme='dark'] {
    ${declarations.dark}
  }

  /* Системная тема: корень без явной светлой. Потомки без data-theme наследуют значения корня,
     потомок с data-theme='light' получает светлую палитру собственным объявлением выше */
  @media (prefers-color-scheme: dark) {
    &:not([data-theme='light']) {
      ${declarations.dark}
    }
  }

  font-family: ${k.sans};
  font-size: ${k.fs1};
  line-height: ${k.lh1};
  color: ${k.ink};
  background: ${k.paper};
  min-height: 100%;

  /* Живая область провайдера: доступна скринридеру, не видна */
  & > [data-part='live'] {
    position: absolute;
    inline-size: 0;
    block-size: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
`
