import { screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { formatAmount } from '@katran/ui'
import type { TabContext } from '../../../shared/lib/detail'
import { renderK } from '../../../shared/lib/test'
import { FX_DETAIL_EXAMPLE } from '../api/detail.example'
import { parseFxDocDetail } from '../api/detail.mapper'
import { fxExtraGroups, isCode } from '../model/extra'
import { ExtraTab, fxExtraView } from './ExtraTab'

const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')
const shifted = parseFxDocDetail({ ...FX_DETAIL_EXAMPLE, valueDates: ['2026-09-23', '2026-09-23', '2026-09-23', '2026-09-24'] }, 'ответ')

describe('fxExtraGroups (XTAB эталона)', () => {
  it('три группы и строки в порядке эталона', () => {
    const g = fxExtraGroups(d)
    expect(g.map((x) => x.title)).toEqual(['SWIFT-поля', 'Референсы', 'Даты валютирования'])
    expect(g.map((x) => x.byName)).toEqual([false, true, true])
    expect(g[0]!.rows.map((r) => r.key)).toEqual(['32A', '33B', '36', '71', '77B'])
    expect(g[1]!.rows.map((r) => r.name)).toEqual(['docReference Вх', 'docReference Исх', 'Связанный reference', 'UETR'])
    expect(g[1]!.rows.map((r) => r.len)).toEqual([16, 16, 16, 36])
    expect(g[2]!.rows.map((r) => r.name)).toEqual(['Вх', 'Исх', 'по Дт', 'по Кт'])
  })
  it('значения: 32A из даты, валюты и суммы детали; 33B по частям строки; 71 — четыре подполя', () => {
    const [swift] = fxExtraGroups(d)
    const row = (k: string) => swift!.rows.find((r) => r.key === k)!
    expect(row('32A').parts.map((p) => [p.label, p.value])).toEqual([['Дата', '23.09.2026'], ['Валюта', 'USD'], ['Сумма', formatAmount(1500.5)]])
    expect(row('33B').parts.map((p) => p.value)).toEqual(['EUR', '1148300,00'])
    expect(row('36').parts[0]!.value).toBe('1,0886')
    expect(row('71').parts.map((p) => [p.label, p.value])).toEqual([['71A', 'OUR'], ['71B', ''], ['71F', 'USD 35,00'], ['71G', '']])
    expect(row('71').parts[0]!.hint).toBe('71A · Детали расходов')
    expect(row('77B').parts[0]!.value).toBe('')
  })
  it('референсы: Вх — поле 20, Исх — refOut, связанный — 21, UETR копируется', () => {
    const refs = fxExtraGroups({ ...d, refOut: 'VK2609220000417' })[1]!.rows
    expect(refs.map((r) => r.parts[0]!.value)).toEqual(['FX2609220000417', 'VK2609220000417', 'NONREF', 'eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10'])
    expect(refs.map((r) => r.copy)).toEqual([false, false, false, true])
  })
  it('даты: отличные от «Вх» помечены; совпадающие — нет', () => {
    expect(fxExtraGroups(d)[2]!.rows.some((r) => r.parts[0]!.diff)).toBe(false)
    expect(fxExtraGroups(shifted)[2]!.rows.map((r) => r.parts[0]!.diff)).toEqual([false, false, false, true])
  })
  it('isCode: коды от 8 знаков из A–Z, 0–9 и «-»', () => {
    expect(isCode('FX2609220000417')).toBe(true)
    expect(isCode('OUR')).toBe(false)
    expect(isCode('1148300,00')).toBe(false)
    expect(isCode('eb6305c9-1f8c')).toBe(false)
  })
})

describe('ExtraTab', () => {
  it('SWIFT-поля: номер поля с названием в подсказке, подписи частей, пустое — «не заполнено»', () => {
    renderK(<ExtraTab detail={d} />)
    expect(screen.getByText('SWIFT-поля')).toBeInTheDocument()
    expect(screen.getByText('32A')).toBeInTheDocument()
    expect(screen.getByText('1148300,00')).toBeInTheDocument()
    expect(screen.getByText('71A')).toHaveAttribute('data-k-tip', '71A · Детали расходов')
    expect(screen.getByText('OUR')).toBeInTheDocument()
    // 71B, 71G, 77B, docReference Исх (refOut null)
    expect(screen.getAllByText('не заполнено')).toHaveLength(4)
  })
  it('референсы: коды моноширинно, длина поля справа, UETR — копирование', () => {
    renderK(<ExtraTab detail={d} />)
    expect(screen.getByText('FX2609220000417')).toHaveClass('mono')
    expect(screen.getByText('NONREF')).not.toHaveClass('mono')
    expect(screen.getAllByText('16 симв.')).toHaveLength(3)
    expect(screen.getByText('36 симв.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'eb6305c9-1f8c-41e3-a3b2-6d7e9f2a4c10' })).toBeInTheDocument()
  })
  it('даты валютирования: отличная от «Вх» — выделена и озвучена', () => {
    const { unmount } = renderK(<ExtraTab detail={d} />)
    expect(document.querySelector('.diff')).toBeNull()
    unmount()
    renderK(<ExtraTab detail={shifted} />)
    expect(screen.getByText('24.09.2026')).toHaveClass('diff')
    expect(screen.getByText('— отличается от даты «Вх»')).toBeInTheDocument()
  })
  it('fxExtraView — локальный вид, рисует ExtraTab', () => {
    const ctx: TabContext = { docId: 'u1', openDocument: () => undefined, announce: () => undefined, expanded: null, setExpanded: () => undefined }
    expect(fxExtraView.kind).toBe('local')
    renderK(<>{fxExtraView.render(d, ctx)}</>)
    expect(screen.getByText('Даты валютирования')).toBeInTheDocument()
  })
  it('без нарушений axe', async () => {
    const { container } = renderK(<ExtraTab detail={shifted} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
