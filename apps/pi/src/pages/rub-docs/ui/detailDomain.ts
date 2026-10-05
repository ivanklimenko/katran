import { TRAIL_VIEWS, type TrailTabId } from '../../../entities/doc-trail'
import { RUB_TABS, rubDocDetailDomain, type RubDoc, type RubDocDetail } from '../../../entities/rub-doc'
import type { DetailDomain, TabView } from '../../../shared/lib/detail'

const isTrail = (id: string): id is TrailTabId => id in TRAIL_VIEWS

/** Виды вкладок рубля (спека 2b §3.4): все, кроме «Общих», — виды doc-trail по набору RUB_TABS (ED244 вместо исходного текста). */
const tabViews: Record<string, TabView<RubDocDetail>> = {}
for (const t of RUB_TABS) if (isTrail(t.id)) tabViews[t.id] = TRAIL_VIEWS[t.id]

export const rubDetailDomain: DetailDomain<RubDocDetail, RubDoc> = { ...rubDocDetailDomain, tabViews }
