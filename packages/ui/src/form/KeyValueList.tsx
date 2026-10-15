import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { styled } from '../styled'
import { Sr } from './parts'
import { k } from '@katran/tokens'

export type KeyValueItem = {
  key: string
  label: ReactNode
  /** null / '' — «—», для скринридера «не заполнено» (как FieldRow). */
  value: ReactNode | null
  mono?: boolean | undefined
  /** Справа в строке значения: «16 симв.» (эталон .len). */
  aside?: ReactNode | undefined
  /** Тултип подписи (название SWIFT-поля); дублируется скрытым текстом — тултип не видят клавиатура и скринридер. */
  hint?: string | undefined
  /** В две колонки — значение до конца строки (эталон .kvs .span3); в одну колонку не влияет. */
  wide?: boolean | undefined
}

export type KeyValueListProps = {
  items: KeyValueItem[]
  /** Полоса-заголовок группы (эталон .xg h6). */
  title?: string | undefined
  /** Ширина колонки подписи, px при плотности 1: 40 — номер поля, 150 — по названию, 230 — комплаенс. По умолчанию 150; в 2 колонках — по содержимому. */
  labelWidth?: number | undefined
  /** 2 — сетка «подпись, значение, подпись, значение» (эталон .kvs), без рамок строк. */
  columns?: 1 | 2 | undefined
  className?: string | undefined
}

/* список «ключ–значение» вкладок деталки (спека 2b §2, эталон .xg/.xr/.kvs, index.html:281–291, 343–345);
   в две колонки (data-columns="2") — без рамки */
const Kv = styled.div`
  border: 1px solid ${k.line};
  border-radius: ${k.rS};

  &:where([data-columns='2']) {
    border: 0;
    border-radius: 0;
  }
`

const KvTitle = styled.h3`
  margin: 0;
  padding: ${k.sp1} ${k.kvPx};
  border-bottom: 1px solid ${k.line2};
  background: ${k.sunk};
  font: 600 ${k.fsKv} / ${k.lh1} ${k.sans};
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: ${k.ink2};
`

const KvList = styled.dl`
  margin: 0;
`

/* строка 24 с рамкой снизу (эталон .xr, border-box) */
const KvRow = styled.div`
  box-sizing: border-box;
  display: grid;
  grid-template-columns: var(--k-kv-label) minmax(0, 1fr);
  gap: 0 ${k.kvPx};
  align-items: center;
  min-height: ${k.kvRow};
  padding: 0 ${k.kvPx};
  border-bottom: 1px solid ${k.line2};

  &:last-child {
    border-bottom: 0;
  }
`

/* две пары в строке (эталон .kvs): подпись — по содержимому, если ширину не задали */
const Kvs = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: var(--k-kv-label, auto) minmax(0, 1fr) var(--k-kv-label, auto) minmax(0, 1fr);
  gap: ${k.kvsGap} ${k.kvPx};
  align-items: baseline;
  font-size: ${k.fsKvs};

  /* значение до конца строки (эталон .kvs .span3) */
  & > [data-wide] {
    grid-column: 2 / -1;
  }
`

const KvLabel = styled.dt`
  min-width: 0;
  overflow: hidden;
  font-size: ${k.fsKv};
  color: ${k.muted};
  text-overflow: ellipsis;
  white-space: nowrap;
`

const KvValue = styled.dd`
  display: flex;
  flex-wrap: wrap;
  gap: 0 ${k.kvGap};
  align-items: baseline;
  min-width: 0;
  margin: 0;
  color: ${k.val};
`

/* значение — элемент flex-строки: сжимается до ширины колонки, и обрезка с многоточием внутри (.cut потребителя) срабатывает;
   моноширинное — data-mono */
const KvText = styled.span`
  min-width: 0;

  &:where([data-mono]) {
    font-family: ${k.mono};
    font-size: ${k.fsKvs};
    letter-spacing: -0.01em;
  }
`

const KvNone = styled.span`
  color: ${k.faint};
`

const KvAside = styled.span`
  margin-left: auto;
  font-size: ${k.fs3};
  color: ${k.faint};
`

const isEmpty = (v: ReactNode | null): boolean => v === null || v === undefined || v === ''

/**
 * Список «ключ–значение» вкладок деталки (спека 2b §2, эталон .xg/.xr и .kvs, index.html:281–291, 343–345).
 * Разметка — dl: в одну колонку пара dt/dd в строке-div (рамка строки), в две — dt/dd прямо в сетке.
 */
export function KeyValueList({ items, title, labelWidth, columns = 1, className }: KeyValueListProps) {
  const width = labelWidth ?? (columns === 1 ? 150 : undefined)
  const style = width === undefined ? undefined : ({ '--k-kv-label': `calc(${width}px * ${k.density})` } as CSSProperties)
  const pair = (it: KeyValueItem) => {
    const wide = columns === 2 && it.wide === true
    const empty = isEmpty(it.value)
    // подсказка — название поля; без неё обрезанная подпись показывает себя целиком тултипом
    const tip = it.hint ?? (typeof it.label === 'string' ? it.label : undefined)
    return (
      <>
        <KvLabel data-k-tip={tip} data-k-tip-if={it.hint === undefined && tip !== undefined ? 'truncated' : undefined}>
          {it.label}
          {it.hint !== undefined && <Sr>{` · ${it.hint}`}</Sr>}
        </KvLabel>
        <KvValue data-empty={empty ? '' : undefined} data-wide={wide ? '' : undefined}>
          {empty
            ? <><KvNone aria-hidden="true">—</KvNone><Sr>не заполнено</Sr></>
            : <KvText data-mono={it.mono ? '' : undefined}>{it.value}</KvText>}
          {it.aside !== undefined && <KvAside>{it.aside}</KvAside>}
        </KvValue>
      </>
    )
  }
  return (
    <Kv className={className} data-columns={columns}>
      {title !== undefined && <KvTitle>{title}</KvTitle>}
      {columns === 2
        ? <Kvs style={style}>{items.map((it) => <Fragment key={it.key}>{pair(it)}</Fragment>)}</Kvs>
        : (
          <KvList style={style}>
            {items.map((it) => <KvRow key={it.key} data-kv={it.key}>{pair(it)}</KvRow>)}
          </KvList>
        )}
    </Kv>
  )
}
