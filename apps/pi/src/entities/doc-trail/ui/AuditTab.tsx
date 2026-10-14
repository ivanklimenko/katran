import { CodeView, Disclosure } from '@katran/ui'
import type { AuditSections } from '../model/types'
import { accordionOf, keysLabel, type TrailTabProps } from './lib'
import { HeadNote, Stack, TrailEmpty } from './parts'

/** Вкладка «Аудит» (эталон auditHtml, index.html:1188): секция — аккордеон с числом ключей, JSON с подсветкой. По умолчанию — commonSection. */
export function AuditTab({ data, ctx }: TrailTabProps<AuditSections>) {
  const names = Object.keys(data)
  if (!names.length) return <TrailEmpty text="Аудит пуст" />
  const accordion = accordionOf(ctx, ['commonSection'])
  return (
    <Stack>
      {names.map((name) => {
        const section = data[name] ?? {}
        return (
          <Disclosure
            key={name}
            title={name}
            mono
            aside={<HeadNote>{keysLabel(Object.keys(section).length)}</HeadNote>}
            {...accordion(name)}
          >
            <CodeView code={JSON.stringify(section, null, 2)} language="json" label={`Секция аудита ${name}`} />
          </Disclosure>
        )
      })}
    </Stack>
  )
}
