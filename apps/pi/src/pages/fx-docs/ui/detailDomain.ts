import { formatAmount } from '@katran/ui'
import { trailViewsFor } from '../../../entities/doc-trail'
import { FX_TABS, fxDecisionFocus, fxDecisionNote, fxDocDetailDomain, fxExtraView, statusLabelOf, type FxDoc, type FxDocDetail } from '../../../entities/fx-doc'
import type { AnnulInfo, DetailDomain, TabView } from '../../../shared/lib/detail'

/**
 * Виды вкладок валюты (спека 2b §3.4): «Доп. поля» — локальная, из детали (fx-doc); общие вкладки истории обработки —
 * виды doc-trail по набору FX_TABS (у валюты «Исходный текст» — source, ED244 нет). «Общие данные» рисует ConfigForm виджета.
 * Собирается здесь: соседние сущности друг друга не видят (FSD), а страница видит обе через index.ts.
 */
const tabViews: Record<string, TabView<FxDocDetail>> = { extra: fxExtraView, ...trailViewsFor(FX_TABS) }

/** Доменное для аннулирования (спека 2e §3.5): подпись статуса — statusLabelOf сущности, пояснение Prompt — «№ · сумма валюта» как в шапке. */
const annulInfo = (d: FxDocDetail): AnnulInfo => ({
  canAnnul: d.canAnnul, annul: d.annul, lockedBy: d.lock?.who ?? null, statusLabel: statusLabelOf(d),
  subject: `№ ${d.docNumber} · ${formatAmount(d.amount)} ${d.currency}`,
})

/** decisionNote — тело Prompt решения второй руки (план 2d): его рисует виджет, текст цели знает сущность; decisionFocus — карандаш цели после решения. */
export const fxDetailDomain: DetailDomain<FxDocDetail, FxDoc> = {
  ...fxDocDetailDomain, tabViews, decisionNote: fxDecisionNote, decisionFocus: fxDecisionFocus, annulInfo,
}
