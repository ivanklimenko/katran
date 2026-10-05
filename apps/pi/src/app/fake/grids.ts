import { fxDocLayout } from '../../entities/fx-doc'
import { rubDocLayout } from '../../entities/rub-doc'
import { STATUS_LABEL } from '../../entities/doc-status'
import { createFxEditStore } from './edits'
import { fakeGrid, type FakeGrid } from './grid'
import { fxDocsMeta, makeFxDocs } from './fx-docs.data'
import { makeFxDocDetail } from './fx-docs.detail'
import { FX_TRAIL_TABS, fxDocTrail } from './fx-docs.trail'
import { rubDocsMeta, makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'
import { RUB_TRAIL_TABS, rubDocTrail } from './rub-docs.trail'

/**
 * Гриды фейка. Правки валюты живут в памяти своего набора: приложению — один набор на сессию (fakeGrids),
 * тестам — свежий на тест (createFakeGrids), чтобы правки одного теста не видел другой (preflight D8).
 */
export function createFakeGrids(): Record<string, FakeGrid> {
  const fx = makeFxDocs()
  // сид правки поля 57 — первый документ с полем 57: первый в реестре — MT199 (Ruling: makeFxDocs()[1])
  const seedId = fx.find((r) => r.type !== 'MT199')?.id ?? null
  return {
    'fx-docs': fakeGrid(fx, fxDocLayout.columns, fxDocsMeta, {
      sortLabels: { status: STATUS_LABEL }, detail: makeFxDocDetail, tabs: { ids: FX_TRAIL_TABS, data: fxDocTrail },
      edits: createFxEditStore({ seedId }),
    }),
    'rub-docs': fakeGrid(makeRubDocs(), rubDocLayout.columns, rubDocsMeta, {
      sortLabels: { status: STATUS_LABEL }, detail: makeRubDocDetail, tabs: { ids: RUB_TRAIL_TABS, data: rubDocTrail },
    }),
  }
}

export const fakeGrids: Record<string, FakeGrid> = createFakeGrids()
