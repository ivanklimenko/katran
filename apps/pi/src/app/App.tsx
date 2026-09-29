import { useEffect, useState, type ReactElement } from 'react'
import { KatranProvider } from '@katran/ui'
import { FxDocsPage } from '../pages/fx-docs'
import { RubDocsPage } from '../pages/rub-docs'
import { Shell } from './Shell'
import { parseRoute, startRouting, type Route } from './routes'

// Пояснения стенда живут в app: переносимые страницы получают их пропом note (внутри — свой текст или ничего).
const HOW_TO = 'Запись не кликабельна — деталку открывает кнопка; двойной клик — второй документ рядом. Tab попадает в сетку один раз, дальше — стрелки; Enter на ячейке — копировать/открыть.'
const pages: Record<Route, () => ReactElement> = {
  'fx-docs': () => <FxDocsPage note={`87 валютных документов на фейковом сервере с задержкой 0,25–0,65 с. ${HOW_TO}`} />,
  'rub-docs': () => <RubDocsPage note={`87 рублёвых документов на фейковом сервере с задержкой 0,25–0,65 с. ${HOW_TO}`} />,
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute)
  useEffect(() => startRouting(setRoute), [])
  const Page = pages[route]
  return (
    <KatranProvider storageKey="katran-pi">
      <Shell route={route}><Page /></Shell>
    </KatranProvider>
  )
}
