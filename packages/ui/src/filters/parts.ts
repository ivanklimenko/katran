import { k } from '@katran/tokens'
import { Button, IconButton } from '../button'
import { styled } from '../styled'

/**
 * Части панели фильтров (FilterPanel, FilterField). Модификатор ячейки поля «на две колонки» — атрибутом data-wide
 * (прежде класс .fieldWide) под :where(): специфичность прежнего класса (0,1,0).
 * Переопределения кнопки кита (переключатель «Фильтры», ✕ чипа, «Сбросить») — styled(Button) и styled(IconButton):
 * группа обёртки стоит в листе после группы кнопки и при равной специфичности перебивает её.
 */
export const Panel = styled.div`
  display: grid;
  gap: ${k.sp2};
`

/* Полоса фильтров (эталон .filters стенда pi-constructor): sunk на всю ширину, 45 ≈ min-height
   (h-ctl-l + sp-3) с паддингом и рамкой внутри — border-box: провайдер делает content-box все
   элементы внутри корня (`& *`, изоляция в Root — provider/Root.tsx), и паддинг sp-2 сверху/снизу
   добавлялся бы поверх min-height, раздувая полосу. */
export const Bar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${k.sp2};
  box-sizing: border-box;
  width: 100%;
  min-height: calc(${k.hCtlL} + ${k.sp3});
  padding: ${k.sp2} ${k.sp5};
  background: ${k.sunk};
  border-bottom: 1px solid ${k.line};
`

export const Toggle = styled(Button)`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp2};
`

export const ToggleIcon = styled.span`
  display: inline-grid;
  place-items: center;

  & > svg {
    width: ${k.iconS};
    height: ${k.iconS};
  }
`

/* мелкий текст на полосе sunk — ink2 (как теги; финал 5b, I2) */
export const None = styled.span`
  color: ${k.ink2};
`

export const Chips = styled.ul`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${k.sp1};
  margin: 0;
  padding: 0;
  list-style: none;
`

/* Чип условия (эталон .achip): val-soft, части — поле ink2, оператор mono ink2, значение val 600.
   Ширина не больше тултипа (tip-max, эталон max-width 360): длинное значение обрезается многоточием,
   полный текст — в тултипе чипа (финал 5b, M4). */
export const Chip = styled.li`
  display: inline-flex;
  align-items: center;
  gap: ${k.sp1};
  max-width: ${k.tipMax};
  height: ${k.hCtlS};
  padding: 0 ${k.sp1} 0 ${k.sp2};
  border-radius: ${k.rS};
  background: ${k.valSoft};
  color: ${k.val};
  white-space: nowrap;
`

export const ChipField = styled.span`
  flex: none;
  color: ${k.ink2};
`

/* мелкий текст на val-soft — ink2 (финал 5b, I2) */
export const ChipOp = styled.span`
  flex: none;
  font: 600 ${k.fs3} / 1 ${k.mono};
  color: ${k.ink2};
`

/* значение — val, как на эталоне (.achip .v наследует val чипа; финал 5b, R) */
export const ChipValue = styled.span`
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  color: ${k.val};
`

export const ChipX = styled(IconButton)`
  flex: none;
  color: ${k.muted};
`

/* «Сбросить» — в ряду чипов, тот же рост, что у них (эталон: .fchip высотой под achip). */
export const ChipBtn = styled(Button)`
  height: ${k.hCtlS};
`

export const Body = styled.form`
  display: grid;
  gap: ${k.sp3};
  padding: ${k.sp3};
  border: 1px solid ${k.line};
  border-radius: ${k.rM};
  background: ${k.paper};

  /* Свёрнутое тело: display: grid выше перебил бы атрибут hidden — поля остались бы видны и в Tab-порядке. */
  &[hidden] {
    display: none;
  }
`

export const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${k.filterField}, 1fr));
  gap: ${k.sp2} ${k.sp3};
`

/* Ячейка поля: контролы (корни TagInput/DateRange — inline-grid, поля SearchSelect/MultiSelect — inline-flex)
   становятся элементами сетки и растягиваются на ширину колонки — своей ширины у них нет.
   Период со временем не помещается в колонку минимальной ширины: занимает две колонки сетки (data-wide). */
export const FieldBox = styled.div`
  display: grid;
  gap: ${k.sp1};
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;

  &:where([data-wide]) {
    grid-column: span 2;
  }
`

export const FieldLabel = styled.span`
  padding: 0;
  font: 400 ${k.fs2} / ${k.lh2} ${k.sans};
  color: ${k.muted};
`

export const Actions = styled.div`
  display: flex;
  gap: ${k.sp2};
`
