import { useKatran } from '@katran/ui'
import { fxDocLayout } from '../../../entities/fx-doc'
import { DocRegistry } from '../../../widgets/doc-registry'
import { registry } from '../model/registry.model'

export function FxDocsPage() {
  const { announce } = useKatran()
  return (
    <DocRegistry
      registry={registry}
      layout={fxDocLayout}
      title="Валютные документы"
      describe={(d) => `документ ${d.docNumber}`}
      note="87 валютных документов на фейковом сервере с задержкой 0,25–0,65 с. Запись не кликабельна — деталку открывает кнопка; двойной клик — второй документ рядом. Tab попадает в сетку один раз, дальше — стрелки; Enter на ячейке — копировать/открыть."
      bulkActions={[
        { label: 'Экспортировать', onClick: (n) => announce(`Экспорт: выбрано ${n}`) },
        { label: 'Отложить', onClick: (n) => announce(`Отложить: выбрано ${n}`) },
      ]}
      rowState={(d) => (d.lock ? { kind: 'locked', ...d.lock } : d.inactive ? { kind: 'inactive', ...d.inactive } : null)}
      openHint="Открыть деталку · двойной клик или Shift — рядом для сравнения"
    />
  )
}
