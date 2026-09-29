import { useEffect, useState, type ComponentType } from 'react'
import { KatranProvider } from '@katran/ui'
import { FxDocsPage } from '../pages/fx-docs'
import { RubDocsPage } from '../pages/rub-docs'
import { Shell } from './Shell'
import { parseRoute, startRouting, type Route } from './routes'

const pages: Record<Route, ComponentType> = { 'fx-docs': FxDocsPage, 'rub-docs': RubDocsPage }

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
