import { createGridPorts } from '../../../shared/api'
import { parseRubDoc } from './rubDoc.mapper'

export const rubDocPorts = createGridPorts({ gridId: 'rub-docs', parseRow: parseRubDoc })
