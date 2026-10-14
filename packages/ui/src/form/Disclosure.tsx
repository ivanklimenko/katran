import { useState, type ReactNode } from 'react'
import { useStableId } from '../compat/useStableId'
import { styled } from '../styled'
import { Counter } from '../value'
import { Hint } from './parts'
import { k } from '@katran/tokens'

export type DisclosureProps = {
  title: string
  /** Правее заголовка: сводка, ссылки, время — интерактивное сюда, не в кнопку заголовка. */
  aside?: ReactNode | undefined
  count?: number | undefined
  /** Управляемый режим; без него — своё состояние от defaultOpen. */
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
  /** Нет данных: пунктирная рамка, бледный заголовок «нет данных», не раскрывается. */
  empty?: boolean | undefined
  /** Вложенный уровень (подгруппы секции): без рамки, заголовок h4. */
  level?: 'block' | 'sub' | undefined
  /** Заголовок моноширинным, без капители: ключ секции аудита, имя исходника (эталон .au .ah, index.html:329–333). */
  mono?: boolean | undefined
  /** Текст справа у пустого блока вместо «нет данных» (исходники эталона — «нет»); aside у пустого не показывается. */
  emptyText?: string | undefined
  children?: ReactNode
  className?: string | undefined
}

const Bh = styled.div`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${k.sp2};
  min-height: ${k.fieldRow};
  padding: 0 ${k.sp2};
`

const BhTitle = styled.h3`
  margin: 0;
  font: 600 ${k.fs2} / ${k.lh2} ${k.sans};
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${k.ink2};
`

/* двойной класс (0,2,0): сброс типографики кнопок провайдера (:where(button), 0,1,0) не должен зависеть от порядка правил в листе */
const BhBtn = styled.button`
  && {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: inherit;
    cursor: pointer;
  }

  &:hover {
    color: ${k.val};
  }

  &:focus-visible {
    outline: 2px solid ${k.val};
    outline-offset: 1px;
  }
`

const Chev = styled.button`
  margin-left: auto;
  padding: 0 ${k.sp1};
  border: 0;
  background: none;
  font-size: ${k.fs3};
  color: ${k.muted};
  cursor: pointer;
`

const Bb = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp1};
  padding: 0 ${k.sp2} ${k.sp1};

  /* display выше перебил бы атрибут hidden */
  &[hidden] {
    display: none;
  }
`

/**
 * Сворачиваемый блок (эталон .blk/.bh/.bb). Модификаторы — атрибутами под :where() (специфичность прежних классов (0,1,0)):
 * уровень — data-level="block|sub", свёрнут — data-shut, пустой — data-empty, моноширинный заголовок — data-mono.
 */
const Blk = styled.div`
  border: 1px solid ${k.line};
  border-radius: ${k.rS};

  &:where([data-shut]) > ${Bh} > ${Chev} {
    transform: rotate(180deg);
  }

  &:where([data-empty]) {
    border-style: dashed;
  }

  &:where([data-empty]) ${BhTitle} {
    color: ${k.faint};
  }

  &:where([data-level='block']) {
    background: ${k.paper};
  }

  &:where([data-level='sub']) {
    border: 0;
    border-radius: 0;
  }

  &:where([data-level='sub']) > ${Bh} {
    min-height: ${k.hField};
    background: ${k.sunk};
  }

  &:where([data-level='sub']) ${BhTitle} {
    font-size: ${k.fs3};
  }

  /* моноширинный заголовок блока (эталон .au .ah, index.html:329–333): 500 12 моно, строка 25, без капители; правила ниже кнопки заголовка и уровня sub */
  &:where([data-mono]) > ${Bh} {
    min-height: ${k.ahRow};
  }

  &:where([data-mono]) ${BhTitle} {
    font: 500 ${k.fsKvs} / ${k.lh1} ${k.mono};
    letter-spacing: 0;
    text-transform: none;
    color: ${k.ink};
  }

  &:where([data-mono]) ${BhBtn}${BhBtn} {
    letter-spacing: 0;
    text-transform: none;
  }
`

/** Сворачиваемый блок (эталон .blk/.bh/.bb, index.html:167–174): кнопка заголовка с aria-expanded и панель. */
export function Disclosure({ title, aside, count, open, defaultOpen = false, onOpenChange, empty, level = 'block', mono, emptyText, children, className }: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen)
  const panel = useStableId()
  const isOpen = open ?? inner
  const set = (v: boolean) => { if (open === undefined) setInner(v); onOpenChange?.(v) }
  const H = level === 'sub' ? 'h4' : 'h3'
  const attrs = { className, 'data-part': 'disclosure', 'data-level': level, 'data-mono': mono ? '' : undefined }
  if (empty) {
    return (
      <Blk {...attrs} data-empty="">
        <Bh>
          <BhTitle as={H}>{title}</BhTitle>
          <Hint>{emptyText ?? 'нет данных'}</Hint>
        </Bh>
      </Blk>
    )
  }
  return (
    <Blk {...attrs} data-shut={isOpen ? undefined : ''}>
      <Bh>
        <BhTitle as={H}>
          <BhBtn type="button" aria-expanded={isOpen} aria-controls={panel} onClick={() => set(!isOpen)}>{title}</BhBtn>
        </BhTitle>
        {count !== undefined && <Counter value={count} />}
        {aside}
        {/* шеврон — дубль кнопки заголовка для мыши (эталон .tg), вне порядка Tab и дерева доступности */}
        <Chev type="button" tabIndex={-1} aria-hidden="true" data-part="chevron" onClick={() => set(!isOpen)}>▲</Chev>
      </Bh>
      <Bb id={panel} hidden={!isOpen}>{children}</Bb>
    </Blk>
  )
}
