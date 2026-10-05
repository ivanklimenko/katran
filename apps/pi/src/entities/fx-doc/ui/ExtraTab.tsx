import type { ReactNode } from 'react'
import { CopyValue, FieldTag, KeyValueList, type KeyValueItem } from '@katran/ui'
import type { LocalTabView } from '../../../shared/lib/detail'
import type { FxDocDetail } from '../model/detail'
import { fxExtraGroups, isCode, type ExtraPart, type ExtraRow } from '../model/extra'
import s from './extra.module.css'

function Part({ p }: { p: ExtraPart }) {
  const cls = [s.v, p.kind === 'text' && isCode(p.value) ? s.mono : '', p.diff ? s.diff : ''].filter(Boolean).join(' ')
  return (
    <span className={s.part}>
      {p.label && <span className={s.lbl} data-k-tip={p.hint ?? undefined}>{p.label}</span>}
      {p.value
        ? <span className={cls}>{p.value}{p.diff && <span className={s.sr}>— отличается от даты «Вх»</span>}</span>
        : <span className={s.nil}><span aria-hidden="true">—</span><span className={s.sr}>не заполнено</span></span>}
    </span>
  )
}

/** Значение строки: одна часть без подписи — сама (пусто → «—» от KeyValueList, UETR — копированием), иначе части в строку. */
function valueOf(r: ExtraRow): ReactNode {
  const only = r.parts.length === 1 && !r.parts[0]!.label ? r.parts[0]! : null
  if (only && !only.value) return null
  if (only && r.copy) return <CopyValue value={only.value} tone="mono" />
  return <span className={s.kv}>{r.parts.map((p, i) => <Part key={i} p={p} />)}</span>
}

const itemOf = (r: ExtraRow): KeyValueItem => ({
  key: r.key,
  // номер поля — подпись, название — подсказкой (FieldTag кита: операторы знают номера); без номера — название
  label: r.tag ? <FieldTag tag={r.tag} /> : r.name,
  hint: r.tag ? r.name : undefined,
  value: valueOf(r),
  aside: r.len ? `${r.len} симв.` : undefined,
})

/** Вкладка «Доп. поля» валюты (эталон xtabHtml, index.html:1072): SWIFT-поля, референсы, даты валютирования. */
export function ExtraTab({ detail }: { detail: FxDocDetail }) {
  return (
    <div className={s.stack}>
      {fxExtraGroups(detail).map((g) => (
        <KeyValueList key={g.title} title={g.title} labelWidth={g.byName ? 150 : 40} items={g.rows.map(itemOf)} />
      ))}
    </div>
  )
}

/** Локальная вкладка: данные — в детали (эталон TAB_LOCAL.extra). */
export const fxExtraView: LocalTabView<FxDocDetail> = { kind: 'local', render: (d) => <ExtraTab detail={d} /> }
