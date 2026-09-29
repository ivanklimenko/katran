import { fxDocLayout } from '../../entities/fx-doc'
import { STATUS_LABEL } from '../../entities/doc-status'
import { fakeGrid, type FakeGrid } from './grid'
import { fxDocsMeta, makeFxDocs } from './fx-docs.data'

export const fakeGrids: Record<string, FakeGrid> = {
  'fx-docs': fakeGrid(makeFxDocs(), fxDocLayout.columns, fxDocsMeta, { sortLabels: { status: STATUS_LABEL } }),
}
