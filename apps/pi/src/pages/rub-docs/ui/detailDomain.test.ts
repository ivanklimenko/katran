import { RUB_DETAIL_EXAMPLE, parseRubDocDetail, statusLabelOf } from '../../../entities/rub-doc'
import { rubDetailDomain } from './detailDomain'

const d = parseRubDocDetail(RUB_DETAIL_EXAMPLE, 'ответ')

describe('rubDetailDomain.annulInfo (спека 2e §3.5)', () => {
  it('из детали: canAnnul, annul, блокировка, подпись статуса, «№ · сумма RUB»', () => {
    expect(rubDetailDomain.annulInfo?.(d)).toEqual({
      canAnnul: d.canAnnul, annul: d.annul, lockedBy: null, statusLabel: 'Обработан', subject: '№ 3741 · 76 394.81 RUB',
    })
  })

  it('блокировка — lockedBy; подпись статуса — statusLabelOf сущности', () => {
    const locked = { ...d, status: 'IN_PROGRESS' as const, lock: { who: 'Иванова М. П.', since: '2026-09-23T10:00:00' } }
    expect(rubDetailDomain.annulInfo?.(locked)).toMatchObject({ lockedBy: 'Иванова М. П.', statusLabel: 'В работе' })
    expect(statusLabelOf(locked)).toBe('В работе')
  })
})
