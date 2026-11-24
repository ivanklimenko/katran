import { standParam } from '../../../shared/lib/stand'
import type { FxDocDetail } from './detail'

export type FxMappingSources = {
  paths: Record<string, string[]>
  responseKeys: string[]
}

export const fxMappingMode = (): boolean => standParam('mapping') === '1'

export const swiftFieldPath = (tag: string, fallback = false): string =>
  `$.${fallback ? 'mt202Instruction.fallbackFields' : 'fields'}[${JSON.stringify(tag)}]`

export function fxSourceTip(detail: FxDocDetail, ...keys: string[]): string | undefined {
  if (!fxMappingMode()) return undefined
  const sources = detail.mappingSources
  const paths = keys.flatMap((key) => {
    const root = key.match(/^\$\.([^.[\]]+)/)?.[1]
    if (!sources || (root && sources.responseKeys.includes(root))) return [key]
    return sources.paths[key] ?? []
  })
  return [...new Set(paths)].join('\n') || 'Значение отсутствует в источнике'
}

export function fxFieldTip(detail: FxDocDetail, tag: string): string | undefined {
  const fallback = detail.fields[tag] === undefined && detail.mt202Instruction?.fallbackFields[tag] !== undefined
  return fxSourceTip(detail, swiftFieldPath(tag, fallback))
}
