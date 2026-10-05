import { createEditPorts, createGridPorts } from '../../../shared/api'
import { trailParsersFor } from '../../doc-trail/@x/fx-doc'
import { FX_TABS } from '../model/swift'
import { parseFxDocDetail } from './detail.mapper'
import { parseFxDoc } from './fxDoc.mapper'

/** Вкладки валюты: парсеры doc-trail по FX_TABS (main и extra — в детали, ed244 — не вкладка валюты). */
export const fxDocPorts = createGridPorts({ gridId: 'fx-docs', parseRow: parseFxDoc, parseDetail: parseFxDocDetail, parseTab: trailParsersFor(FX_TABS) })
/** Правка валютного документа (план 2c): POST …/edits отвечает деталью целиком — тем же парсером, что detailFx. */
export const fxEditPorts = createEditPorts({ gridId: 'fx-docs', parseDetail: parseFxDocDetail })
