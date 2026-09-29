import { createPageLifecycle } from '../../../shared/lib/lifecycle'
import { createRegistry } from '../../../widgets/doc-registry'
import { rubDocLayout, rubDocPorts } from '../../../entities/rub-doc'

export const lifecycle = createPageLifecycle()
export const registry = createRegistry({ id: 'rub-docs', layout: rubDocLayout, ports: rubDocPorts, lifecycle })
