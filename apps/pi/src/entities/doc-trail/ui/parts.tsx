import type { ReactNode } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { Sr } from '../../../shared/ui'

/*
 * Вкладки истории документа (эталон .tt/.tbar/.tk/.xg, index.html:282–345): содержимое ячеек и тел строк.
 * Сетку, высоту строк, шапку, «№» и пустое состояние таблиц рисует MiniTable кита. Здесь — части, общие для нескольких вкладок.
 */

/** Вкладка столбиком: аккордеоны, карточки, списки ключей. */
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp2};
`

/** Число строк в панели над таблицей (уведомления, задачи). */
export const Count = styled.span`
  margin-right: auto;
  font-size: ${k.fs2};
  color: ${k.muted};
`

/**
 * Текст ячейки в одну строку с многоточием; data-tone — вид текста: muted — приглушённый (эталон .muted), val — значение,
 * mono — значение моноширинно (эталон .monoVal).
 */
export const Cut = styled.span`
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:where([data-tone='muted']) {
    font-size: ${k.fs2};
    color: ${k.muted};
  }

  &:where([data-tone='val']) {
    color: ${k.val};
  }

  &:where([data-tone='mono']) {
    font: ${k.fs2} / ${k.lh2} ${k.mono};
    color: ${k.val};
  }
`

/** Код статуса или события (эталон .tt .code); data-fin — финальный шаг процесса (эталон .fin): зелёным жирным. */
export const Code = styled.span`
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: ${k.fs1} / ${k.lh1} ${k.mono};
  color: ${k.val};

  &:where([data-fin]) {
    font-weight: 600;
    color: ${k.ok};
  }
`

const NilBox = styled.span`
  color: ${k.faint};
`

/** Пустое значение: «—» глазами, «не заполнено» скринридером (как FieldRow и KeyValueList кита). */
export function Nil() {
  return <NilBox><span aria-hidden="true">—</span><Sr>не заполнено</Sr></NilBox>
}

/* ссылка-кнопка (эталон a.lnk); data-mono — моноширинно (ID связанного документа) */
const Lnk = styled.button`
  padding: 0;
  border: 0;
  background: none;
  font: 500 ${k.fs2} / ${k.lh2} ${k.sans};
  color: ${k.val};
  white-space: nowrap;
  cursor: pointer;

  /* модификатор до состояний — порядок по возрастанию специфичности (no-descending-specificity); свойства не пересекаются */
  &:where([data-mono]) {
    font-family: ${k.mono};
    font-weight: 400;
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }

  &:hover:not([aria-disabled='true']) {
    text-decoration: underline;
  }

  /* недоступна, но держит фокус (как Button кита): переотправка документа в полёте */
  &[aria-disabled='true'] {
    opacity: 0.5;
    cursor: default;
  }
`

export type LinkButtonProps = {
  children: ReactNode
  onClick: () => void
  /** Доступное имя, если видимого текста мало («Исходное сообщение, отправка 2»); видимый текст — его начало. */
  label?: string | undefined
  mono?: boolean | undefined
  /** Недоступна (aria-disabled — держит фокус, клик игнорируется): переотправка документа в полёте. */
  disabled?: boolean | undefined
  /** Действие этой кнопки в полёте — aria-busy. */
  busy?: boolean | undefined
}

/** Ссылка-кнопка вкладки (эталон a.lnk): заглушки, переход к связанному документу, переотправка и исходное сообщение нотификации. */
export function LinkButton({ children, onClick, label, mono, disabled = false, busy = false }: LinkButtonProps) {
  return (
    <Lnk
      type="button"
      data-mono={mono ? '' : undefined}
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-busy={busy || undefined}
      onClick={() => { if (!disabled) onClick() }}
    >
      {children}
    </Lnk>
  )
}

const Box = styled.div`
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
`

const Empty = styled.p`
  margin: 0;
  padding: ${k.sp3} ${k.sp2};
  font-size: ${k.fs1};
  color: ${k.muted};
  text-align: center;
`

/** Пустое состояние вкладки без таблицы (эталон .tt .empty): «Аудит пуст», «Комплаенс-проверок нет». */
export function TrailEmpty({ text }: { text: string }) {
  return <Box><Empty>{text}</Empty></Box>
}

/* длина исходника и число ключей в заголовке аккордеона (эталон .au .ah .lbl): занимает свободное место и прижат вправо —
   у шеврона кита тоже margin-left: auto, и с ним свободное место делилось бы пополам (счётчик посередине) */
const Len = styled.span`
  flex: 1 1 auto;
  text-align: right;
  font: ${k.fs3} / ${k.lh3} ${k.mono};
  color: ${k.muted};
  white-space: nowrap;
`

/** Сводка в заголовке аккордеона справа (эталон .au .ah .lbl): длина исходника, число ключей секции. */
export function HeadNote({ children }: { children: ReactNode }) {
  return <Len>{children}</Len>
}
