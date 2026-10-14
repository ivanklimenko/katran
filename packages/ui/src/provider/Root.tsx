import { styled } from '../styled'
import { declarations, k } from '@katran/tokens'
import { valueHot } from '../value/value.hot'
import { gridHot } from '../grid/grid.hot'
import { dimRule } from '../state/dim'

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
 *
 * Горячий путь грида (спека styled §4.3, правило 2; R16): правила обычных элементов k-<часть> из valueHot и gridHot
 * объявлены здесь под `*:where(&)` — `*:where(.<класс корня>) .k-…`, специфичность как у прежних правил CSS Modules.
 * Корень — статический styled-компонент: его группа в листе одна, стоит до групп компонентов кита и потребителя
 * и вставляется один раз на документ, сколько бы провайдеров ни было смонтировано. Поэтому styled(CopyValue)
 * потребителя при равной специфичности перебивает горячий путь всегда (у createGlobalStyle в styled-components 5
 * группы второго и следующих экземпляров вставлялись в конец листа — после групп потребителя).
 * Там же — правило публичного класса приглушения `dimClass` (k-dim, state/dim.ts): у него нет своего компонента.
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

  /* *:where(&), а не :where(&): селектор с двоеточия в начале stylis считает псевдоклассом самого корня
     (.<класс>:where(…) — специфичность (0,2,0)). Звёздочка специфичности не добавляет: *:where(.<класс>) .k-copy —
     (0,1,0); & stylis заменяет классом компонента (sc-…) или классом стилей — оба стоят на корне */
  *:where(&) {
    ${valueHot}
    ${gridHot}
    ${dimRule}
  }
`
