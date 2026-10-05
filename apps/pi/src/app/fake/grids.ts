import { fxDocLayout } from '../../entities/fx-doc'
import { rubDocLayout } from '../../entities/rub-doc'
import { STATUS_LABEL } from '../../entities/doc-status'
import { fakeGrid, type FakeGrid } from './grid'
import { fxDocsMeta, makeFxDocs } from './fx-docs.data'
import { makeFxDocDetail } from './fx-docs.detail'
import { FX_TRAIL_TABS, fxDocTrail } from './fx-docs.trail'
import { rubDocsMeta, makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'
import { RUB_TRAIL_TABS, rubDocTrail } from './rub-docs.trail'

export const fakeGrids: Record<string, FakeGrid> = {
  'fx-docs': fakeGrid(makeFxDocs(), fxDocLayout.columns, fxDocsMeta, {
    sortLabels: { status: STATUS_LABEL }, detail: makeFxDocDetail, tabs: { ids: FX_TRAIL_TABS, data: fxDocTrail },
  }),
  'rub-docs': fakeGrid(makeRubDocs(), rubDocLayout.columns, rubDocsMeta, {
    sortLabels: { status: STATUS_LABEL }, detail: makeRubDocDetail, tabs: { ids: RUB_TRAIL_TABS, data: rubDocTrail },
  }),
}
