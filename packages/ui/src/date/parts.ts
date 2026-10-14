import { IconButton } from '../button'
import { FieldBox, fieldInput } from '../input/parts'
import { styled } from '../styled'
import { MaskedDateField } from './MaskedDateField'
import { k } from '@katran/tokens'

/** Части полей даты, общие для DateInput и DateRange. */

/* поле даты: обёртка для строки горячих кнопок под полем */
export const DateBox = styled.span`
  display: inline-grid;
  gap: ${k.sp1};
  min-width: 0;

  /* период со временем: полный текст двух полей «дд.мм.гггг чч:мм» не режется — ширина не меньше токена */
  &[data-time] {
    min-width: ${k.rangeTimeW};
  }
`

export const DateField = styled(FieldBox)`
  padding-right: 0;
`

/** Строка маски даты — строка ввода поля кита. */
export const DateText = styled(MaskedDateField)`
  ${fieldInput}
`

export const CalBtn = styled(IconButton)`
  flex: none;
  color: ${k.muted};
`

export const Quick = styled.span`
  display: flex;
  flex-wrap: wrap;
  gap: ${k.sp1};
`

export const TimeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${k.sp2};
  padding: ${k.sp1};
  border-top: 1px solid ${k.line};
`
