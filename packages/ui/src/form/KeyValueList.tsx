import { Fragment, type CSSProperties, type ReactNode } from 'react'
import s from './Form.module.css'

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
}

const isEmpty = (v: ReactNode | null): boolean => v === null || v === undefined || v === ''

/**
 * Список «ключ–значение» вкладок деталки (спека 2b §2, эталон .xg/.xr и .kvs, index.html:281–291, 343–345).
 * Разметка — dl: в одну колонку пара dt/dd в строке-div (рамка строки), в две — dt/dd прямо в сетке.
 */
export function KeyValueList({ items, title, labelWidth, columns = 1 }: KeyValueListProps) {
  const width = labelWidth ?? (columns === 1 ? 150 : undefined)
  const style = width === undefined ? undefined : ({ '--k-kv-label': `calc(${width}px * var(--k-density))` } as CSSProperties)
  const pair = (it: KeyValueItem) => {
    const wide = columns === 2 && it.wide === true
    const empty = isEmpty(it.value)
    // подсказка — название поля; без неё обрезанная подпись показывает себя целиком тултипом
    const tip = it.hint ?? (typeof it.label === 'string' ? it.label : undefined)
    return (
      <>
        <dt className={s.kvLabel} data-k-tip={tip} data-k-tip-if={it.hint === undefined && tip !== undefined ? 'truncated' : undefined}>
          {it.label}
          {it.hint !== undefined && <span className={s.sr}>{` · ${it.hint}`}</span>}
        </dt>
        <dd className={s.kvValue} data-empty={empty ? '' : undefined} data-wide={wide ? '' : undefined}>
          {empty
            ? <><span className={s.kvNone} aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></>
            : <span className={[s.kvText, it.mono ? s.kvMono : ''].filter(Boolean).join(' ')}>{it.value}</span>}
          {it.aside !== undefined && <span className={s.kvAside}>{it.aside}</span>}
        </dd>
      </>
    )
  }
  return (
    <div className={[s.kv, columns === 2 ? s.kvPlain : ''].filter(Boolean).join(' ')}>
      {title !== undefined && <h3 className={s.kvTitle}>{title}</h3>}
      {columns === 2
        ? <dl className={s.kvs} style={style}>{items.map((it) => <Fragment key={it.key}>{pair(it)}</Fragment>)}</dl>
        : (
          <dl className={s.kvList} style={style}>
            {items.map((it) => <div key={it.key} className={s.kvRow} data-kv={it.key}>{pair(it)}</div>)}
          </dl>
        )}
    </div>
  )
}
