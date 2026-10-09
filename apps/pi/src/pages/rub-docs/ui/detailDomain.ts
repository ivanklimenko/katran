import { formatAmount } from '@katran/ui'
import { trailViewsFor } from '../../../entities/doc-trail'
import { RUB_TABS, rubDocDetailDomain, statusLabelOf, type RubDoc, type RubDocDetail } from '../../../entities/rub-doc'
import type { AnnulInfo, DetailDomain, TabView } from '../../../shared/lib/detail'

/** Виды вкладок рубля (спека 2b §3.4): все, кроме «Общих», — виды doc-trail по набору RUB_TABS (ED244 вместо исходного текста). */
const tabViews: Record<string, TabView<RubDocDetail>> = trailViewsFor(RUB_TABS)

/** Доменное для аннулирования (спека 2e §3.5): подпись статуса — statusLabelOf сущности, пояснение Prompt — «№ · сумма RUB» как в сводке. */
const annulInfo = (d: RubDocDetail): AnnulInfo => ({
  canAnnul: d.canAnnul, annul: d.annul, lockedBy: d.lock?.who ?? null, statusLabel: statusLabelOf(d),
  subject: `№ ${d.docNumber} · ${formatAmount(d.amount)} RUB`,
})

export const rubDetailDomain: DetailDomain<RubDocDetail, RubDoc> = { ...rubDocDetailDomain, tabViews, annulInfo }
