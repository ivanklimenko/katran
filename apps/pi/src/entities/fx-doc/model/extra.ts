import { formatAmount, formatDate } from '@katran/ui'
import type { FxDocDetail } from './detail'
import { FX_FIELDS } from './swift'

/** Часть значения строки: подпись (71A — с названием поля в подсказке), готовый текст, вид; diff — дата отличается от «Вх». */
export type ExtraPart = { label: string; hint: string | null; value: string; kind: 'text' | 'date' | 'amount'; diff: boolean }
/** Строка группы: номер поля (null — группа по названию, номер не показывается), название, части, длина поля по SWIFT (эталон len) и копирование (UETR). */
export type ExtraRow = { key: string; tag: string | null; name: string; parts: ExtraPart[]; len: number | null; copy: boolean }
/** Группа: byName — слева название (эталон cols:'name'), иначе номер поля (cols:'tag'). */
export type ExtraGroup = { title: string; byName: boolean; rows: ExtraRow[] }

/** Моноширинно — коды и референсы (эталон xtabHtml: /^[A-Z0-9-]{8,}$/, кроме дат). */
export const isCode = (v: string): boolean => /^[A-Z0-9-]{8,}$/.test(v)

const fieldName = (tag: string) => FX_FIELDS[tag]?.label ?? ''
/** Значение поля (эталон resolve 'f.<tag>'): строки через пробел. */
const fieldText = (d: FxDocDetail, tag: string) => (d.fields[tag]?.lines ?? []).join(' ').trim()
/** n-я часть значения по пробелам (эталон 'f.<tag>.<n>'): «EUR 1148300,00» → EUR / 1148300,00. */
const fieldPart = (d: FxDocDetail, tag: string, n: number) => fieldText(d, tag).split(/\s+/)[n] ?? ''

function text(label: string, value: string): ExtraPart {
  const f = FX_FIELDS[label]
  return { label, hint: f ? `${label} · ${f.label}` : null, value, kind: 'text', diff: false }
}

const row = (key: string, tag: string | null, name: string, parts: ExtraPart[], len: number | null = null, copy = false): ExtraRow =>
  ({ key, tag, name, parts, len, copy })

/** Вкладка «Доп. поля» — XTAB эталона (index.html:650–667); данные — только из детали (TAB_LOCAL). */
export function fxExtraGroups(d: FxDocDetail): ExtraGroup[] {
  const vd = d.valueDates
  const date = (i: 0 | 1 | 2 | 3, label = ''): ExtraPart =>
    ({ label, hint: null, value: formatDate(vd[i]), kind: 'date', diff: vd[i] !== vd[0] })
  return [
    {
      title: 'SWIFT-поля', byName: false,
      rows: [
        row('32A', '32A', fieldName('32A'), [date(0, 'Дата'), text('Валюта', d.currency), { ...text('Сумма', formatAmount(d.amount)), kind: 'amount' }]),
        row('33B', '33B', fieldName('33B'), [text('Валюта', fieldPart(d, '33B', 0)), text('Сумма', fieldPart(d, '33B', 1))]),
        row('36', '36', fieldName('36'), [text('Курс', fieldText(d, '36'))]),
        row('71', '71', 'Комиссии', ['71A', '71B', '71F', '71G'].map((t) => text(t, fieldText(d, t)))),
        row('77B', '77B', fieldName('77B'), [text('', fieldText(d, '77B'))]),
      ],
    },
    {
      title: 'Референсы', byName: true,
      rows: [
        row('refIn', null, 'docReference Вх', [text('', fieldText(d, '20'))], 16),
        row('refOut', null, 'docReference Исх', [text('', d.refOut ?? '')], 16),
        row('related', null, 'Связанный reference', [text('', fieldText(d, '21'))], 16),
        row('uetr', null, 'UETR', [text('', d.uetr)], 36, true),
      ],
    },
    {
      title: 'Даты валютирования', byName: true,
      rows: [row('vdIn', null, 'Вх', [date(0)]), row('vdOut', null, 'Исх', [date(1)]), row('vdDt', null, 'по Дт', [date(2)]), row('vdKt', null, 'по Кт', [date(3)])],
    },
  ]
}
