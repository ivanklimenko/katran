import { TRAIL_VIEWS, type TrailTabId } from '../../../entities/doc-trail'
import { FX_TABS, fxDocDetailDomain, fxExtraView, type FxDoc, type FxDocDetail } from '../../../entities/fx-doc'
import type { DetailDomain, TabView } from '../../../shared/lib/detail'

const isTrail = (id: string): id is TrailTabId => id in TRAIL_VIEWS

/**
 * Виды вкладок валюты (спека 2b §3.4): «Доп. поля» — локальная, из детали (fx-doc); общие вкладки истории обработки —
 * виды doc-trail по набору FX_TABS (у валюты «Исходный текст» — source, ED244 нет). «Общие данные» рисует ConfigForm виджета.
 * Собирается здесь: соседние сущности друг друга не видят (FSD), а страница видит обе через index.ts.
 */
const tabViews: Record<string, TabView<FxDocDetail>> = { extra: fxExtraView }
for (const t of FX_TABS) if (isTrail(t.id)) tabViews[t.id] = TRAIL_VIEWS[t.id]

export const fxDetailDomain: DetailDomain<FxDocDetail, FxDoc> = { ...fxDocDetailDomain, tabViews }
