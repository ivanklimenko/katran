import { FX_TABS, parseFxDocDetail, type FxDocDetail } from '../../../entities/fx-doc'
import { ApiError, obj, type Obj } from '../../../shared/api'

const asObject = (value: unknown): Obj | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Obj : undefined

export function readMappingFile(text: string) {
  let json: unknown
  try {
    json = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error('Файл содержит некорректный JSON.')
  }
  const root = asObject(json)
  const hits = asObject(root?.hits)?.hits
  const entries = [json, hits, root?.content].find(Array.isArray) ?? [json]
  const sources = entries.flatMap((entry) => {
    const source = asObject(entry)?._source ?? entry
    const doc = asObject(source)
    const children = doc?.childPaymentInstructionList
    if (!Array.isArray(children)) return [source]
    return doc?.documentSection === undefined && doc?.type === undefined ? children : [source, ...children]
  })
  const documents: FxDocDetail[] = []
  let skipped = 0
  let firstProblem: string | undefined
  const tabsOff = FX_TABS.filter((tab) => tab.id !== 'main').map((tab) => tab.id)
  for (const source of sources) {
    try {
      const raw = obj(source, '$')
      const detail = parseFxDocDetail(raw, '$')
      documents.push({ ...detail, mappingResponse: raw, tabsOff })
    } catch (error) {
      skipped++
      if (error instanceof ApiError) firstProblem ??= error.problem?.detail?.split(':')[0]
    }
  }
  if (documents.length === 0) {
    throw new Error(`В файле нет инструкций по валютному контракту.${firstProblem ? ` Проверьте поле ${firstProblem}.` : ''}`)
  }
  return { documents, skipped }
}
