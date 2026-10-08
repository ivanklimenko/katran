import { FX_DETAIL_EXAMPLE, parseFxDocDetail, statusLabelOf } from '../../../entities/fx-doc'
import { fxDetailDomain } from './detailDomain'

const d = parseFxDocDetail(FX_DETAIL_EXAMPLE, 'ответ')

describe('fxDetailDomain.annulInfo (спека 2e §3.5)', () => {
  it('из детали: canAnnul, annul, блокировка, подпись статуса, «№ · сумма валюта»', () => {
    expect(fxDetailDomain.annulInfo?.(d)).toEqual({
      canAnnul: false, annul: d.annul, lockedBy: null, statusLabel: 'Ошибка', subject: '№ 812345 · 1 500.50 USD',
    })
  })

  it('блокировка — lockedBy; подпись статуса — statusLabelOf сущности', () => {
    const locked = { ...d, status: 'DONE' as const, lock: { who: 'Иванова М. П.', since: '2026-09-23T10:00:00' } }
    expect(fxDetailDomain.annulInfo?.(locked)).toMatchObject({ lockedBy: 'Иванова М. П.', statusLabel: 'Обработан' })
    expect(statusLabelOf(locked)).toBe('Обработан')
  })
})
