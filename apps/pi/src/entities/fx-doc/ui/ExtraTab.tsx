import type { ReactNode } from 'react'
import styled from 'styled-components'
import { k } from '@katran/tokens'
import { CopyValue, FieldTag, KeyValueList, type KeyValueItem } from '@katran/ui'
import type { LocalTabView } from '../../../shared/lib/detail'
import type { FxDocDetail } from '../model/detail'
import { fxExtraGroups, isCode, type ExtraPart, type ExtraRow } from '../model/extra'
import { Sr } from '../../../shared/ui'

/* «Доп. поля» валюты (эталон .xr .kv/.lbl/.diffd, index.html:283–295): части значения в строке */
const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${k.sp2};
`

const Kv = styled.span`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 ${k.sp3};
  min-width: 0;
`

const PartBox = styled.span`
  white-space: nowrap;
`

const Lbl = styled.span`
  margin-right: ${k.sp1};
  font-size: ${k.fs2};
  color: ${k.muted};
`

/* значение: data-mono — код (эталон .mono), data-diff — дата, отличная от «Вх» (эталон .diffd) */
const V = styled.span`
  color: ${k.val};

  &:where([data-mono]) {
    font: ${k.fs2} / ${k.lh2} ${k.mono};
  }

  &:where([data-diff]) {
    font-weight: 600;
    color: ${k.warn};
  }
`

const NilBox = styled.span`
  color: ${k.faint};
`

function Part({ p }: { p: ExtraPart }) {
  return (
    <PartBox>
      {p.label && <Lbl data-k-tip={p.hint ?? undefined}>{p.label}</Lbl>}
      {p.value
        ? (
          <V data-mono={(p.kind === 'text' && isCode(p.value)) || undefined} data-diff={p.diff || undefined}>
            {p.value}{p.diff && <Sr>— отличается от даты «Вх»</Sr>}
          </V>
        )
        : <NilBox><span aria-hidden="true">—</span><Sr>не заполнено</Sr></NilBox>}
    </PartBox>
  )
}

/** Значение строки: одна часть без подписи — сама (пусто → «—» от KeyValueList, UETR — копированием), иначе части в строку. */
function valueOf(r: ExtraRow): ReactNode {
  const only = r.parts.length === 1 && !r.parts[0]!.label ? r.parts[0]! : null
  if (only && !only.value) return null
  if (only && r.copy) return <CopyValue value={only.value} tone="mono" />
  return <Kv>{r.parts.map((p, i) => <Part key={i} p={p} />)}</Kv>
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
    <Stack>
      {fxExtraGroups(detail).map((g) => (
        <KeyValueList key={g.title} title={g.title} labelWidth={g.byName ? 150 : 40} items={g.rows.map(itemOf)} />
      ))}
    </Stack>
  )
}

/** Локальная вкладка: данные — в детали (эталон TAB_LOCAL.extra). */
export const fxExtraView: LocalTabView<FxDocDetail> = { kind: 'local', render: (d) => <ExtraTab detail={d} /> }
