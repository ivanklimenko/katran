import styled from 'styled-components'
import { k } from '@katran/tokens'
import { CodeView, CopyValue, Disclosure, KeyValueList, StatusBadge, Tag, Timestamp, type KeyValueItem } from '@katran/ui'
import { toneOf } from '../model/tone'
import type { MpuMessage } from '../model/types'
import { accordionOf, charsLabel, type TrailTabProps } from './lib'
import { HeadNote, Stack, TrailEmpty } from './parts'

/* карточка сообщения (эталон .ldb + .ah swiftText) */
const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${k.sp1};
`

const itemsOf = (m: MpuMessage): KeyValueItem[] => [
  { key: 'id', label: 'ID', value: <CopyValue value={m.id} tone="mono" /> },
  { key: 'exportStatus', label: 'Статус на экспорте', value: <StatusBadge tone={toneOf(m.exportStatus)}>{m.exportStatus}</StatusBadge> },
  { key: 'type', label: 'Тип', value: <Tag tone="mt">{m.type}</Tag> },
  { key: 'receiver', label: 'Получатель', value: m.receiver, mono: true },
  { key: 'created', label: 'Создано', value: <Timestamp iso={m.created} /> },
  { key: 'exported', label: 'Экспорт', value: m.exported ? <Timestamp iso={m.exported} /> : null },
  { key: 'docReference', label: 'docReference', value: m.docReference, mono: true },
  { key: 'docId', label: 'docId', value: m.docId, mono: true },
]

/**
 * Вкладка «MPU» (эталон mpuHtml, index.html:1251): карточка на сообщение и аккордеон swiftText с длиной.
 * По умолчанию раскрыт swiftText первого сообщения (mkui).
 */
export function MpuTab({ data, ctx }: TrailTabProps<MpuMessage[]>) {
  const first = data[0]
  if (!first) return <TrailEmpty text="Сообщений MPU нет" />
  const accordion = accordionOf(ctx, [first.id])
  return (
    <Stack>
      {data.map((m) => (
        <Card key={m.id} aria-label={`Сообщение MPU ${m.type} ${m.id}`}>
          <KeyValueList columns={2} labelWidth={130} items={itemsOf(m)} />
          <Disclosure
            title="swiftText"
            mono
            empty={!m.swift}
            emptyText="нет"
            aside={<HeadNote>{charsLabel(m.swift)}</HeadNote>}
            {...accordion(m.id)}
          >
            <CodeView code={m.swift} language="swift" label={`swiftText сообщения ${m.id}`} />
          </Disclosure>
        </Card>
      ))}
    </Stack>
  )
}
