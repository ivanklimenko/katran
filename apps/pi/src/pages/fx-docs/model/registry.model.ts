import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createRegistry } from '../../../widgets/doc-registry'
import { fxDocLayout, fxDocPorts } from '../../../entities/fx-doc'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'fx-docs', layout: fxDocLayout, ports: fxDocPorts, lifecycle })
