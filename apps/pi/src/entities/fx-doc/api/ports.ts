import { createGridPorts } from '../../../shared/api'
import { parseFxDocDetail } from './detail.mapper'
import { parseFxDoc } from './fxDoc.mapper'

export const fxDocPorts = createGridPorts({ gridId: 'fx-docs', parseRow: parseFxDoc, parseDetail: parseFxDocDetail })
