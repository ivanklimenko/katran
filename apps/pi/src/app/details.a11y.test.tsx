import { act, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { createEffect } from 'effector'
import { FX_TYPES, fxDocDetailDomain, parseFxDocDetail } from '../entities/fx-doc'
import { RUB_TYPES, parseRubDocDetail, rubDocDetailDomain } from '../entities/rub-doc'
import type { ApiError } from '../shared/api'
import type { DetailDomain } from '../shared/lib/detail'
import { createPageLifecycle } from '../shared/lib/lifecycle'
import { renderK } from '../shared/lib/test'
import { createDetail, DocDetail } from '../widgets/doc-detail'
import { makeFxDocs } from './fake/fx-docs.data'
import { makeFxDocDetail } from './fake/fx-docs.detail'
import { makeRubDocs } from './fake/rub-docs.data'
import { makeRubDocDetail } from './fake/rub-docs.detail'

/** Деталка с загруженным документом под axe (спека 2a §6): реальные домен, данные фейка и маппер. */
async function check<D extends { id: string }, Row>(domain: DetailDomain<D, Row>, doc: D, ready: RegExp) {
  const detailFx = createEffect<string, D, ApiError>(async () => doc)
  const lifecycle = createPageLifecycle()
  const detail = createDetail({ detailFx, lifecycle })
  const { container, unmount } = renderK(<DocDetail detail={detail} domain={domain} />)
  act(() => {
    lifecycle.pageOpened()
    detail.open({ id: doc.id, secondary: false })
  })
  await screen.findByRole('heading', { name: ready })
  expect(await axe(container)).toHaveNoViolations()
  unmount()
}

describe('a11y деталки на реальных профилях обоих реестров (спека 2a §6)', () => {
  it('валюта: каждый тип MT', async () => {
    const rows = makeFxDocs()
    for (const t of FX_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      if (i < 0) continue
      await check(fxDocDetailDomain, parseFxDocDetail(makeFxDocDetail(rows[i]!, i), 'ответ'), new RegExp(`^Поля ${t}$`))
    }
  }, 60_000)
  it('рубль: каждый вид документа', async () => {
    const rows = makeRubDocs()
    for (const t of RUB_TYPES) {
      const i = rows.findIndex((r) => r.type === t)
      await check(rubDocDetailDomain, parseRubDocDetail(makeRubDocDetail(rows[i]!, i), 'ответ'), /^Отправитель \/ Получатель$/)
    }
  }, 60_000)
})
