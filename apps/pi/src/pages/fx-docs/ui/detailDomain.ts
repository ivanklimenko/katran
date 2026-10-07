import { trailViewsFor } from '../../../entities/doc-trail'
import { FX_TABS, fxDecisionNote, fxDocDetailDomain, fxExtraView, type FxDoc, type FxDocDetail } from '../../../entities/fx-doc'
import type { DetailDomain, TabView } from '../../../shared/lib/detail'

/**
 * Виды вкладок валюты (спека 2b §3.4): «Доп. поля» — локальная, из детали (fx-doc); общие вкладки истории обработки —
 * виды doc-trail по набору FX_TABS (у валюты «Исходный текст» — source, ED244 нет). «Общие данные» рисует ConfigForm виджета.
 * Собирается здесь: соседние сущности друг друга не видят (FSD), а страница видит обе через index.ts.
 */
const tabViews: Record<string, TabView<FxDocDetail>> = { extra: fxExtraView, ...trailViewsFor(FX_TABS) }

/** decisionNote — тело Prompt решения второй руки (план 2d): его рисует виджет, текст цели знает сущность. */
export const fxDetailDomain: DetailDomain<FxDocDetail, FxDoc> = { ...fxDocDetailDomain, tabViews, decisionNote: fxDecisionNote }
