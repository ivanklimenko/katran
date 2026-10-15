import { screen } from '@testing-library/react'
import { renderK } from '../../../shared/lib/test'
import type { RubDoc } from '../model/rubDoc'
import { RubCellStyles, rubDocLayout } from './layout'

/* Свои элементы ячеек — правило 2 (спека styled §4.7): обычные элементы с классами и RubCellStyles рядом с раскладкой */
const doc = { id: 'r1', docNumber: '4711', uuid: 'u1', txId: 't1', docRef: '', initiator: 'IS1', source: 'IS2', destination: 'IS3' } as unknown as RubDoc
const render = (id: string) => rubDocLayout.columns.find((c) => c.id === id)?.render(doc)

describe('ячейки рублёвого реестра — правило 2', () => {
  it('номер документа — 600 поверх font: inherit значения кита; системы — подписи rubSrTag и значения rubMono', () => {
    const { container } = renderK(<><RubCellStyles />{render('id')}{render('systems')}</>)
    const num = screen.getByRole('button', { name: /4711/ })
    expect(num).toHaveClass('k-copy', 'rubNum')
    expect(getComputedStyle(num).fontWeight).toBe('600')
    expect([...container.querySelectorAll('.rubSrTag')].map((e) => e.textContent)).toEqual(['I:', 'S:', 'D:'])
    expect(container.querySelectorAll('.k-copy.rubMono')).toHaveLength(3)
  })
})
