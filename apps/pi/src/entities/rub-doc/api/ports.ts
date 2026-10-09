import { createAnnulPorts, createGridPorts, type AnnulPorts } from '../../../shared/api'
import { trailParsersFor } from '../../doc-trail/@x/rub-doc'
import type { RubDocDetail } from '../model/detail'
import { RUB_TABS } from '../model/profiles'
import { parseRubDocDetail } from './detail.mapper'
import { parseRubDoc } from './rubDoc.mapper'

/** Вкладки рубля: парсеры doc-trail по RUB_TABS (main — в детали, source — не вкладка рубля). */
export const rubDocPorts = createGridPorts({ gridId: 'rub-docs', parseRow: parseRubDoc, parseDetail: parseRubDocDetail, parseTab: trailParsersFor(RUB_TABS) })
/** Аннулирование рублёвого документа (2e): команды — void, перезапрос — деталью тем же парсером, что detailFx. */
export const rubAnnulPorts: AnnulPorts<RubDocDetail> = createAnnulPorts('rub-docs', (v) => parseRubDocDetail(v, 'ответ'))
