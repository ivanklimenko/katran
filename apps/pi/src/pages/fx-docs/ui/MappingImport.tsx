import { useEffect, useRef, useState } from 'react'
import { useUnit } from 'effector-react'
import { Button } from '@katran/ui'
import { k } from '@katran/tokens'
import styled from 'styled-components'
import type { FxDocDetail } from '../../../entities/fx-doc'
import { readMappingFile } from '../model/mappingImport'
import { detail } from '../model/registry.model'

// Один внутренний ключ слота для локального просмотра. ID из файла остаётся внутри документа.
const LOCAL_DOCUMENT = 'local-mapping-preview'

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${k.sp1} ${k.sp2};
  padding: ${k.sp1} 0;
`

const DocumentSelect = styled.select`
  max-width: 100%;
  min-height: ${k.hCtlS};
  padding: 0 ${k.sp1};
  border: 1px solid ${k.line};
  border-radius: ${k.rS};
  background: ${k.paper};
  color: ${k.ink};
  font: inherit;
`

const ErrorText = styled.span`
  color: ${k.bad};
`

export function useMappingImport(marks: Readonly<Record<string, string>>) {
  const input = useRef<HTMLInputElement>(null)
  const generation = useRef(0)
  const [batch, setBatch] = useState<ReturnType<typeof readMappingFile> | null>(null)
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [replace, open] = useUnit([detail.replaceDetail, detail.open])
  useEffect(() => () => { generation.current++ }, [])

  const show = (document: FxDocDetail, index: number) => {
    setSelected(index)
    replace({ id: LOCAL_DOCUMENT, detail: document })
    open({ id: LOCAL_DOCUMENT, secondary: false })
  }
  const load = async (file: File) => {
    const reading = ++generation.current
    setBusy(true)
    setError('')
    try {
      const text = await file.text()
      if (reading !== generation.current) return
      const result = readMappingFile(text)
      setBatch(result)
      show(result.documents[0]!, 0)
    } catch (error) {
      if (reading === generation.current) setError(error instanceof Error ? error.message : 'Не удалось прочитать файл.')
    } finally {
      if (reading === generation.current) setBusy(false)
    }
  }

  return {
    picker: <input ref={input} type="file" accept=".json,application/json" hidden onChange={(event) => {
      const file = event.currentTarget.files?.[0]
      event.currentTarget.value = ''
      if (file) void load(file)
    }} />,
    controls: (
      <Controls>
        <Button size="s" disabled={busy} onClick={() => input.current?.click()}>Открыть JSON</Button>
        {batch && (
          <DocumentSelect aria-label="Документ из файла" value={marks[LOCAL_DOCUMENT] ? selected : ''} onChange={(event) => {
            const index = Number(event.currentTarget.value)
            const document = batch.documents[index]
            if (document) show(document, index)
          }}>
            <option value="" disabled>Выберите документ</option>
            {batch.documents.map((doc, index) => <option value={index} key={index}>{index + 1}. № {doc.docNumber} · {doc.type}</option>)}
          </DocumentSelect>
        )}
        {!!batch?.skipped && <span role="status">Пропущено записей: {batch.skipped}</span>}
        {error && <ErrorText role="alert">{error}</ErrorText>}
      </Controls>
    ),
  }
}
