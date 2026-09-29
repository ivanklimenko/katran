import { useKatran } from '@katran/ui'
import { fxDocLayout } from '../../../entities/fx-doc'
import { DocRegistry } from '../../../widgets/doc-registry'
import { registry } from '../model/registry.model'

/** note — пояснение над реестром; текст задаёт приложение (у стенда — про фейковый сервер), слайс его не знает. */
export function FxDocsPage({ note }: { note?: string | undefined }) {
  const { announce } = useKatran()
  return (
    <DocRegistry
      registry={registry}
      layout={fxDocLayout}
      title="Валютные документы"
      describe={(d) => `документ ${d.docNumber}`}
      note={note}
      bulkActions={[
        { label: 'Экспортировать', onClick: (n) => announce(`Экспорт: выбрано ${n}`) },
        { label: 'Отложить', onClick: (n) => announce(`Отложить: выбрано ${n}`) },
      ]}
      rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
      openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
    />
  )
}
