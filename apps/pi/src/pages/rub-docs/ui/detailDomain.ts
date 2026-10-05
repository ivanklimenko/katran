import { trailViewsFor } from '../../../entities/doc-trail'
import { RUB_TABS, rubDocDetailDomain, type RubDoc, type RubDocDetail } from '../../../entities/rub-doc'
import type { DetailDomain, TabView } from '../../../shared/lib/detail'

/** Виды вкладок рубля (спека 2b §3.4): все, кроме «Общих», — виды doc-trail по набору RUB_TABS (ED244 вместо исходного текста). */
const tabViews: Record<string, TabView<RubDocDetail>> = trailViewsFor(RUB_TABS)

export const rubDetailDomain: DetailDomain<RubDocDetail, RubDoc> = { ...rubDocDetailDomain, tabViews }
