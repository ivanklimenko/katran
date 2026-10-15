import { screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { renderK } from '../../../shared/lib/test'
import type { FxDoc } from '../model/fxDoc'
import { FxCellStyles, fxDocLayout } from './layout'

/* Свои элементы ячеек — правило 2 (спека styled §4.7): обычные элементы с классами и FxCellStyles рядом с раскладкой */
const doc = { id: 'f1', docNumber: 812345, refIn: null, refOut: null, vdDt: '2026-09-23', vdKt: '2026-09-24', created: '2026-09-23T10:00:00', direction: 'OUT', dirTxt: 'Исходящий' } as unknown as FxDoc
const cell = (id: string): ReactElement => {
  const col = fxDocLayout.columns.find((c) => c.id === id)
  if (!col) throw new Error(id)
  return <>{col.render(doc)}</>
}

describe('ячейки валютного реестра — правило 2', () => {
  it('номер документа — CopyValue с классом fxNum: 600 поверх font: inherit значения кита (порядок групп, без удвоения)', () => {
    renderK(<><FxCellStyles />{cell('id')}</>)
    const num = screen.getByRole('button', { name: /812345/ })
    expect(num).toHaveClass('k-copy', 'fxNum')
    expect(getComputedStyle(num).fontWeight).toBe('600')
  })

  it('Кт, отличный от Дт, — класс fxKtWarn; направление — обычные span и svg с классами, без styled-обёрток', () => {
    const { container } = renderK(<><FxCellStyles />{cell('created')}{cell('direction')}</>)
    expect(container.querySelectorAll('.fxKtWarn')).toHaveLength(1)
    expect(container.querySelector('.fxDirRow > svg.fxDirIco')).not.toBeNull()
    expect(container.querySelector('.fxDirRow .k-copy.fxDirCode')).not.toBeNull()
  })

  it('правила под корнем провайдера и после правил значения кита в листе стилей', () => {
    renderK(<><FxCellStyles />{cell('id')}</>)
    const selectors = selectorsOf()
    const kit = selectors.findIndex((x) => /\.k-copy(,|$)/.test(x))
    const app = selectors.indexOf(':where([data-k-root]) .fxNum')
    expect(kit).toBeGreaterThanOrEqual(0)
    expect(app).toBeGreaterThan(kit)
  })

  it('перемонтирование (смена раздела): правила снова после правил значения кита, вес 600', () => {
    const first = renderK(<><FxCellStyles />{cell('id')}</>)
    first.unmount()
    expect(selectorsOf().indexOf(':where([data-k-root]) .fxNum')).toBe(-1)
    renderK(<><FxCellStyles />{cell('id')}</>)
    const selectors = selectorsOf()
    const kit = selectors.findIndex((x) => /\.k-copy(,|$)/.test(x))
    expect(kit).toBeGreaterThanOrEqual(0)
    expect(selectors.indexOf(':where([data-k-root]) .fxNum')).toBeGreaterThan(kit)
    expect(getComputedStyle(screen.getByRole('button', { name: /812345/ })).fontWeight).toBe('600')
  })
})

const selectorsOf = (): string[] => [...document.styleSheets].flatMap((s) => [...s.cssRules]).map((r) => (r instanceof CSSStyleRule ? r.selectorText : ''))
