import { KatranProvider } from '@katran/ui'
import { Shell } from './Shell'
import { useRoute } from './router'
import { TokensPage } from './pages/TokensPage'
import { ButtonsPage } from './pages/ButtonsPage'
import { InputsPage } from './pages/InputsPage'
import { ValuesPage } from './pages/ValuesPage'
import { OverlaysPage } from './pages/OverlaysPage'
import { StatesPage } from './pages/StatesPage'
import { PaginationPage } from './pages/PaginationPage'
import { TabsPage } from './pages/TabsPage'

const pages = { tokens: TokensPage, buttons: ButtonsPage, inputs: InputsPage, values: ValuesPage, overlays: OverlaysPage, states: StatesPage, pagination: PaginationPage, tabs: TabsPage }

export function App() {
  const route = useRoute()
  const Page = pages[route]
  return (
    <KatranProvider storageKey="katran-demo">
      <Shell route={route}><Page /></Shell>
    </KatranProvider>
  )
}
