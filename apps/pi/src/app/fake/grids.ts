import { fxDocLayout } from '../../entities/fx-doc'
import { rubDocLayout } from '../../entities/rub-doc'
import { STATUS_LABEL } from '../../entities/doc-status'
import { fakeGrid, type FakeGrid } from './grid'
import { fxDocsMeta, makeFxDocs } from './fx-docs.data'
import { makeFxDocDetail } from './fx-docs.detail'
import { rubDocsMeta, makeRubDocs } from './rub-docs.data'
import { makeRubDocDetail } from './rub-docs.detail'

export const fakeGrids: Record<string, FakeGrid> = {
  'fx-docs': fakeGrid(makeFxDocs(), fxDocLayout.columns, fxDocsMeta, { sortLabels: { status: STATUS_LABEL }, detail: makeFxDocDetail }),
  'rub-docs': fakeGrid(makeRubDocs(), rubDocLayout.columns, rubDocsMeta, { sortLabels: { status: STATUS_LABEL }, detail: makeRubDocDetail }),
}
