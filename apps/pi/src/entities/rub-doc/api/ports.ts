import { createGridPorts } from '../../../shared/api'
import { parseRubDocDetail } from './detail.mapper'
import { parseRubDoc } from './rubDoc.mapper'

export const rubDocPorts = createGridPorts({ gridId: 'rub-docs', parseRow: parseRubDoc, parseDetail: parseRubDocDetail })
