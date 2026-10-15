import { k } from '@katran/tokens'
import { IconButton } from '../button'
import { Popover } from '../overlay'
import { dimmed } from '../state/dim'
import { styled } from '../styled'

/**
 * Части грида вне горячего пути (спека styled §4.2, правило 1): корень, таблица, шапка, ручка ресайза, уровни
 * сортировки, меню состава колонок, подвал. Запись (tbody, ячейки, служебная ячейка) — обычные элементы горячего
 * пути, их правила — gridHot (grid.hot.ts) в шаблоне корня провайдера.
 *
 * Порядок компонентов — порядок правил прежнего Grid.module.css: группа styled-компонента занимает место в листе
 * при объявлении, поэтому Table объявлена до Th — сброс рамок ячеек (0,1,0) идёт раньше линии шапки той же
 * специфичности. Модификаторы-классы стали атрибутами под :where() (специфичность прежних классов (0,1,0)):
 * приглушение таблицы — data-dim (он уже был на таблице), отсортированная колонка — data-sorted на th.
 */
export const Root = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;

  /* грид сам белый, где бы ни лежал: без фона сквозь него просвечивала бы подложка страницы */
  background: ${k.paper};
`

export const Wrap = styled.div`
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
`

export const Table = styled.table`
  width: max-content;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: ${k.fs1};
  line-height: ${k.lh1};
  color: ${k.ink};

  /* Ячейки без рамок по умолчанию: хост может задавать глобальное «td, th { border }» —
     без сброса рамки протекают в запись (+3 px к 68). Специфичность (0,1,0) перебивает селектор элемента,
     а правила с той же или большей специфичностью (Th ниже; .k-record > tr > td в grid.hot.ts) рисуют свои линии.
     Ячейки записи — обычные элементы горячего пути: правила таблицы адресуют их вложенными селекторами. */
  & :where(td, th) {
    border: 0;
  }

  /* Ширина колонки — полная ширина ячейки с паддингом (ползунок ресайза показывает её же):
     border-box. [data-k-root] поднимает специфичность до (0,2,0) — выше content-box корня провайдера. */
  [data-k-root] & :where(td, th) {
    box-sizing: border-box;
  }

  /* Только ячейки грида: глобальный td[tabindex] красил бы фокус в таблицах хоста. */
  & td[tabindex]:focus-visible,
  & th[tabindex]:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: -2px;
  }

  /* приглушение на время обновления */
  &:where([data-dim]) {
    ${dimmed}
  }
`

/* --- шапка --- */
export const Th = styled.th`
  position: sticky;
  top: 0;
  z-index: ${k.zSticky};
  padding: ${k.sp2} ${k.sp2} ${k.sp2};
  overflow: hidden;
  text-align: left;
  font: 600 ${k.fs1} / ${k.lh1} ${k.sans};
  color: ${k.ink};
  background: ${k.paper};
  border-bottom: 1px solid ${k.line};
  white-space: nowrap;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  /* наведение подсвечивает всю ячейку шапки, а не только кнопку внутри её паддинга — правило на th
     с сортируемой колонкой (атрибут aria-sort есть только когда у колонки есть ключи сортировки) */
  &[aria-sort]:hover {
    background: ${k.hover};
  }

  &:where([data-sorted]) {
    color: ${k.val};
  }
`

export const ThBtn = styled.button`
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: ${k.rS};

  /* Заголовок сортируемой колонки сидит внутри <button>: провайдер сбрасывает типографику контролов
     (Provider.module.css «.root :where(button, input, select, textarea) { text-transform: none }»,
     специфичность (0,1,0)). Вложенный селектор Th ThBtn — (0,2,0) — бьёт сброс провайдера независимо от порядка
     листов. */
  ${Th} & {
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 0;
  }
`

export const ThSub = styled.span`
  display: block;
  min-height: ${k.lh2};
  overflow: hidden;
  font: 400 ${k.fs2} / ${k.lh2} ${k.sans};
  color: ${k.muted};
  text-overflow: ellipsis;
  text-transform: uppercase;
  letter-spacing: 0.5px;

  /* Подзаголовок отсортированной колонки (выбранный ключ) — цвета значения, как заголовок. */
  ${Th}:where([data-sorted]) & {
    color: ${k.val};
  }
`

export const Arrow = styled.span`
  margin-left: ${k.sp1};
  font-size: ${k.fs2};
  color: ${k.faint};
`

/* ручка ресайза — настоящая кнопка: с клавиатуры стрелками */
export const Rz = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  width: ${k.gridRz};
  height: 100%;
  padding: 0;
  border: 0;
  background: none;
  cursor: col-resize;
  z-index: ${k.zSticky};

  &::after {
    content: '';
    position: absolute;
    top: ${k.sp2};
    bottom: ${k.sp2};
    left: 50%;
    border-left: 1px solid ${k.line};
  }

  &:focus-visible {
    outline: 0;
  }

  &:hover::after,
  &:focus-visible::after,
  &[data-active='true']::after {
    border-left: 2px solid ${k.val};
  }
`

export const StateRow = styled.tr`
  & > td {
    padding: 0;
  }
`

/* --- уровни сортировки над таблицей --- */
export const SortBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${k.sp2};
  padding: ${k.sp2};
  background: ${k.paper};
  border-bottom: 1px solid ${k.line};
`

export const SortLbl = styled.span`
  font-size: ${k.fs3};
  color: ${k.muted};
`

export const SortChipWrap = styled.span`
  display: flex;
  align-items: center;
  gap: ${k.sp1};
`

export const SortSep = styled.span`
  color: ${k.faint};
`

export const SortChip = styled.span`
  display: flex;
  align-items: center;
  gap: ${k.sp1};
  padding: ${k.sp1} ${k.sp2};
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
  background: ${k.valSoft};
`

export const SortOrd = styled.span`
  font: 600 ${k.fs3} / 1 ${k.mono};
  color: ${k.muted};
`

export const SortChipBtn = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: 400 ${k.fs2} / 1 ${k.sans};
  color: ${k.ink};
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 2px;
  }
`

export const SortChipX = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font-size: ${k.fs2};
  line-height: 1;
  color: ${k.faint};
  cursor: pointer;

  &:hover {
    color: ${k.ink};
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 2px;
  }
`

/* --- состояния --- */
export const Progress = styled.div`
  position: sticky;
  top: 0;
  z-index: ${k.zSticky};
`

export const Foot = styled.div`
  flex: none;
`

export const Toolbar = styled.div`
  padding: ${k.sp2} 0 0;

  /* обёртка рендерится всегда, когда передан проп toolbar, но сам слот (например BulkBar) может вернуть null
     при пустом выделении — тогда у div нет дочерних узлов, и отступ не должен резервировать место (спека 6.4) */
  &:empty {
    padding: 0;
  }
`

/* --- меню состава колонок --- */
/** Поповер меню — переопределение Popover кита: группа определена позже панели поповера и при равной специфичности (0,1,0) перебивает её отступ и ширину. */
export const ColsMenu = styled(Popover)`
  display: grid;
  gap: ${k.sp2};
  padding: ${k.sp2};
  min-width: ${k.side};
`

export const ColsList = styled.ul`
  max-height: ${k.menuMaxH};
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
`

export const ColsItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  height: ${k.hCtlM};
`

export const ColsName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

export const ColsSplit = styled.li`
  display: flex;
  align-items: center;
  height: ${k.hCtlM};
  padding-left: ${k.sp6};
`

export const LeadHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${k.sp1};
`

/**
 * Кнопка открытия заблокированной записи — тона warn: переопределение IconButton кита, группа обёртки стоит в листе
 * после группы кнопки и при равной специфичности перебивает её цвет. Только у заблокированных записей: кнопка
 * открытия обычной записи — IconButton без своей обёртки (служебная ячейка каждой записи).
 */
export const OpenLocked = styled(IconButton)`
  color: ${k.warn};
`
