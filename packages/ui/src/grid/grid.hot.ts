import { css } from '../styled'
import { k } from '@katran/tokens'

/**
 * Правила записи грида — горячий путь (спека styled §4.3, правило 2): tbody записи, ячейки, клампы, служебная
 * ячейка с номером (GridRecord, GridSkeleton, ord в DataGrid) — обычные элементы с постоянными классами k-<часть>;
 * правила объявлены здесь один раз, их вставляет шаблон корня провайдера (provider/Root.tsx) под `*:where(&)` —
 * префикс специфичности не добавляет.
 *
 * Перенос правил записи из Grid.module.css один к одному: порядок и специфичность прежние. Модификатор-класс
 * выделения (selected) стал атрибутом `data-selected` на tbody в `:where()` — специфичность прежняя
 * (.selected > tr > td — (0,1,2), с :hover — (0,2,2)): метка data-mark ниже по-прежнему перебивает выделение при наведении.
 * Остальной грид (шапка, обёртка, меню состава) — статические styled-компоненты grid/parts.ts.
 */
export const gridHot = css`
  /* padding-top grid-gap — отступ между строкой колонок и сквозной строкой (Г2);
     у первой строки записи он переопределён ниже на grid-pad */
  .k-record > tr > td {
    padding: ${k.gridGap} ${k.sp2} 0;
    vertical-align: top;
    overflow: hidden;
    white-space: nowrap;
  }

  .k-record:where([data-selected]) > tr > td {
    background: ${k.valSoft};
  }

  .k-record > tr:first-child > td {
    padding-top: ${k.gridPad};
  }

  .k-record > tr:last-child > td {
    padding-bottom: ${k.gridPad};
    border-bottom: 1px solid ${k.line};
  }

  /* наведение подсвечивает всю запись (tbody), а не одну её строку */
  .k-record:hover > tr > td {
    background: ${k.hover};
  }

  /* после правила выше: специфичность равна, выделенная запись при наведении остаётся val-soft */
  .k-record:where([data-selected]):hover > tr > td {
    background: ${k.valSoft};
  }

  /* открытые в деталке (спека 2a §3.1, эталон selA/selB grid.html:651–654): A — val, B — warn. После наведения
     и выделения: при равной специфичности метка побеждает их; полоса слева — в конце, после полосы блокировки */
  .k-record[data-mark='a'] > tr > td {
    background: ${k.valSoft};
  }

  .k-record[data-mark='b'] > tr > td {
    background: ${k.warnRow};
  }

  .k-clamp {
    max-height: calc(${k.lh1} * var(--k-lines, 1));
    overflow: hidden;
  }

  /* сквозные строки записи — второй кегль (Г2 спеки 5b §2) */
  .k-record > tr:not(:first-child) .k-clamp {
    font-size: ${k.fs2};
    line-height: ${k.lh2};
  }

  /* скелетон текстовой ячейки резервирует ту же высоту, что и текст записи, а не высоту плашки */
  .k-clamp-skeleton {
    min-height: calc(${k.lh1} * var(--k-lines, 1));
  }

  /* сквозные строки скелетона — та же высота, что у сквозных строк записи (второй кегль выше) */
  .k-record > tr:not(:first-child) .k-clamp-skeleton {
    min-height: calc(${k.lh2} * var(--k-lines, 1));
  }

  .k-cell[data-align='right'] {
    text-align: right;
  }

  .k-lead {
    display: flex;
    align-items: center;
    gap: ${k.sp1};
  }

  /* скелетон служебной ячейки резервирует высоту реальных контролов (чекбокс + кнопка "s") */
  .k-lead-skeleton {
    min-height: ${k.hCtlS};
  }

  .k-ord {
    min-width: ${k.sp5};
    font: 400 ${k.fs3} / ${k.lh3} ${k.mono};
    color: ${k.faint};
    text-align: right;
  }

  .k-span-empty {
    min-height: ${k.lh2};
  }

  .k-filler {
    padding: 0;
  }

  /* состояния записи (эталон 1d57ded): значения приглушены переопределением тонов внутри записи — классы значений не адресуются */
  .k-record[data-state] {
    --k-ink: ${k.muted};
    --k-ink2: ${k.muted};
  }

  /* акцент val не приглушается у записи, открытой в деталке: метка (полоса слева — val) сильнее состояния (Д28) */
  .k-record[data-state]:not([data-mark]) {
    --k-val: ${k.muted};
  }

  /* warn и opt (Кт валютирования, буква опции, теги) приглушаются только в ячейках значений (.k-cell .k-clamp):
     на всей записи переопределение погасило бы и замок заблокированной записи в служебной ячейке —
     он тона warn по спеке (финал 5b, M3) */
  .k-record[data-state] .k-cell .k-clamp {
    --k-warn: ${k.muted};
    --k-opt: ${k.muted};
  }

  /* обесцвечивается только статусная точка (свой атрибут data-st) — Tag и Counter носят data-tone
     и приглушаются переопределением токенов выше, без прозрачности (финал 5b, I1) */
  .k-record[data-state] [data-st] {
    filter: grayscale(1);
    opacity: 0.55;
  }

  .k-record[data-state='locked'] > tr:first-child > td:first-child {
    box-shadow: inset 3px 0 0 ${k.warnSoft};
  }

  .k-record[data-state='inactive']:not([data-mark]) .k-cell,
  .k-record[data-state='inactive']:not([data-mark]) .k-filler {
    background: repeating-linear-gradient(135deg, transparent 0 calc(${k.hatch} * 0.9), ${k.sunk} calc(${k.hatch} * 0.9) ${k.hatch});
  }

  .k-record[data-state='inactive']:not([data-mark]):hover .k-cell,
  .k-record[data-state='inactive']:not([data-mark]):hover .k-filler {
    background: ${k.hover};
  }

  /* полоса открытой в деталке записи (фон — выше, у наведения): после полосы блокировки — при равной специфичности
     метка побеждает её */
  .k-record[data-mark='a'] > tr:first-child > td:first-child {
    box-shadow: inset 3px 0 0 ${k.val};
  }

  .k-record[data-mark='b'] > tr:first-child > td:first-child {
    box-shadow: inset 3px 0 0 ${k.warn};
  }
`
