import { createGridPorts } from '../../../shared/api'
import { parseFxDoc } from './fxDoc.mapper'

export const fxDocPorts = createGridPorts({ gridId: 'fx-docs', parseRow: parseFxDoc })
